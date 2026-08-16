# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction
from django.db.models import Count, Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import (
    ReleaseChangelogSerializer,
    ReleaseSerializer,
    ReleaseTagSerializer,
    ReleaseWriteSerializer,
)
from plane.db.models import (
    Description,
    Issue,
    ProjectMember,
    Release,
    ReleaseChangelog,
    ReleaseTag,
    ReleaseWorkItem,
    Workspace,
)
from .. import BaseAPIView, BaseViewSet


def accessible_project_ids(user, slug):
    """
    Projects the user can actually read within a workspace.

    Releases are workspace-scoped but the work items inside them are not: a
    release can legitimately contain work from a project the viewer has no
    access to. Every read of release scope is filtered through this, so a guest
    sees the release and its progress bar but only the work items they are
    entitled to. Without it, release scope would be a workspace-wide read
    channel that bypasses project membership entirely.
    """
    return ProjectMember.objects.filter(
        member=user,
        workspace__slug=slug,
        is_active=True,
    ).values_list("project_id", flat=True)


class ReleaseViewSet(BaseViewSet):
    model = Release
    serializer_class = ReleaseSerializer
    search_fields = ["name"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ReleaseWriteSerializer
        return ReleaseSerializer

    def get_queryset(self):
        # Counters are annotated rather than computed per instance: a workspace
        # with 50 releases would otherwise issue 150 extra COUNT queries.
        # deleted_at is checked explicitly on the join because soft-deleted
        # scope rows remain in the table and would inflate every total.
        live_scope = Q(release_work_items__deleted_at__isnull=True) & Q(
            release_work_items__work_item__deleted_at__isnull=True
        )
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("description", "tag", "lead", "workspace")
            .annotate(
                total_work_items=Count("release_work_items", filter=live_scope, distinct=True),
                completed_work_items=Count(
                    "release_work_items",
                    filter=live_scope & Q(release_work_items__work_item__state__group="completed"),
                    distinct=True,
                ),
                cancelled_work_items=Count(
                    "release_work_items",
                    filter=live_scope & Q(release_work_items__work_item__state__group="cancelled"),
                    distinct=True,
                ),
                pending_work_items=Count(
                    "release_work_items",
                    filter=live_scope
                    & ~Q(release_work_items__work_item__state__group__in=["completed", "cancelled"]),
                    distinct=True,
                ),
            )
            .order_by("-created_at")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.kwargs.get("slug"):
            context["workspace"] = Workspace.objects.get(slug=self.kwargs["slug"])
        return context

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        return Response(
            ReleaseSerializer(self.get_queryset(), many=True).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug):
        serializer = ReleaseWriteSerializer(data=request.data, context=self.get_serializer_context())
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        # Re-read through the annotated queryset so the response carries the
        # same progress counters a list/retrieve would return.
        release = self.get_queryset().get(pk=serializer.instance.pk)
        return Response(ReleaseSerializer(release).data, status=status.HTTP_201_CREATED)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        return Response(
            ReleaseSerializer(self.get_queryset().get(pk=pk)).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        release = Release.objects.get(pk=pk, workspace__slug=slug)
        serializer = ReleaseWriteSerializer(
            release, data=request.data, partial=True, context=self.get_serializer_context()
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(
            ReleaseSerializer(self.get_queryset().get(pk=pk)).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        release = Release.objects.get(pk=pk, workspace__slug=slug)
        release.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReleaseWorkItemEndpoint(BaseAPIView):
    """Manage the scope of a release -- which work items ship in it."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, release_id):
        from plane.app.serializers import IssueSerializer

        work_items = Issue.issue_objects.filter(
            issue_releases__release_id=release_id,
            issue_releases__deleted_at__isnull=True,
            workspace__slug=slug,
            project_id__in=accessible_project_ids(request.user, slug),
        ).select_related("state", "project", "workspace")
        return Response(IssueSerializer(work_items, many=True).data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, release_id):
        requested = request.data.get("work_items", [])
        if not requested:
            return Response({"error": "No work items provided"}, status=status.HTTP_400_BAD_REQUEST)

        release = Release.objects.get(pk=release_id, workspace__slug=slug)

        # Only work items the caller can actually see may be added. Silently
        # dropping the rest would hide a permission problem, so the count of
        # what was skipped is returned to the caller.
        allowed = set(
            Issue.issue_objects.filter(
                pk__in=requested,
                workspace__slug=slug,
                project_id__in=accessible_project_ids(request.user, slug),
            ).values_list("pk", flat=True)
        )

        existing = set(
            ReleaseWorkItem.objects.filter(release=release, work_item_id__in=allowed).values_list(
                "work_item_id", flat=True
            )
        )

        created = ReleaseWorkItem.objects.bulk_create(
            [
                ReleaseWorkItem(release=release, work_item_id=wid, workspace_id=release.workspace_id)
                for wid in allowed - existing
            ],
            batch_size=100,
        )
        return Response(
            {
                "added": len(created),
                "already_present": len(existing),
                "skipped_no_access": len(requested) - len(allowed),
            },
            status=status.HTTP_201_CREATED,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def delete(self, request, slug, release_id, work_item_id):
        ReleaseWorkItem.objects.filter(
            release_id=release_id,
            work_item_id=work_item_id,
            workspace__slug=slug,
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReleaseChangelogEndpoint(BaseAPIView):
    """The rich-text changelog document attached to a release."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, release_id):
        changelog = ReleaseChangelog.objects.filter(release_id=release_id, workspace__slug=slug).first()
        if changelog is None:
            return Response({"description_html": "<p></p>", "description_json": {}}, status=status.HTTP_200_OK)
        return Response(ReleaseChangelogSerializer(changelog).data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, release_id):
        release = Release.objects.get(pk=release_id, workspace__slug=slug)

        with transaction.atomic():
            changelog = ReleaseChangelog.objects.select_for_update().filter(release=release).first()
            if changelog is None:
                description = Description.objects.create(workspace_id=release.workspace_id)
                changelog = ReleaseChangelog.objects.create(
                    release=release, changelog=description, workspace_id=release.workspace_id
                )

            document = changelog.changelog
            if "description_html" in request.data:
                document.description_html = request.data["description_html"]
            if "description_json" in request.data:
                document.description_json = request.data["description_json"]
            document.save()

        return Response(ReleaseChangelogSerializer(changelog).data, status=status.HTTP_200_OK)


class ReleaseTagViewSet(BaseViewSet):
    model = ReleaseTag
    serializer_class = ReleaseTagSerializer
    search_fields = ["version", "git_tag"]

    def get_queryset(self):
        return super().get_queryset().filter(workspace__slug=self.kwargs.get("slug")).order_by("-created_at")

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        return Response(ReleaseTagSerializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = ReleaseTagSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(workspace=workspace)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        tag = ReleaseTag.objects.get(pk=pk, workspace__slug=slug)
        serializer = ReleaseTagSerializer(tag, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        ReleaseTag.objects.filter(pk=pk, workspace__slug=slug).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
