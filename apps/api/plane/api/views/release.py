# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re
from datetime import datetime, time

# Django imports
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.serializers import IssueSerializer, ReleaseAPISerializer, ReleaseTagAPISerializer
from plane.app.permissions import WorkspaceEntityPermission
from plane.db.models import (
    Description,
    Issue,
    ProjectMember,
    Release,
    ReleaseChangelog,
    ReleaseStatus,
    ReleaseTag,
    ReleaseWorkItem,
    Workspace,
)
from .base import BaseAPIView


def _accessible_project_ids(user, slug):
    """Projects the caller may read. See the app-layer twin for the rationale."""
    return ProjectMember.objects.filter(member=user, workspace__slug=slug, is_active=True).values_list(
        "project_id", flat=True
    )


def _annotate_progress(queryset):
    live_scope = Q(release_work_items__deleted_at__isnull=True) & Q(
        release_work_items__work_item__deleted_at__isnull=True
    )
    return queryset.annotate(
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
            filter=live_scope & ~Q(release_work_items__work_item__state__group__in=["completed", "cancelled"]),
            distinct=True,
        ),
    )


class ReleaseAPIMixin:
    permission_classes = [WorkspaceEntityPermission]

    @property
    def workspace_slug(self):
        return self.kwargs.get("slug")

    def get_queryset(self):
        return _annotate_progress(
            Release.objects.filter(workspace__slug=self.workspace_slug).select_related(
                "description", "tag", "lead", "workspace"
            )
        ).order_by("-created_at")


class ReleaseListCreateAPIEndpoint(ReleaseAPIMixin, BaseAPIView):
    """List and create workspace releases."""

    serializer_class = ReleaseAPISerializer
    model = Release

    def get(self, request, slug):
        releases = self.get_queryset()

        if status_filter := request.GET.get("status"):
            releases = releases.filter(status__in=[s for s in status_filter.split(",") if s])
        if (is_latest := request.GET.get("is_latest")) is not None:
            releases = releases.filter(is_latest=is_latest.lower() == "true")

        return self.paginate(
            request=request,
            queryset=releases,
            on_results=lambda data: ReleaseAPISerializer(data, many=True, fields=self.fields, expand=self.expand).data,
        )

    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = ReleaseAPISerializer(data=request.data, context={"workspace_id": workspace.id})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(workspace_id=workspace.id)
        return Response(
            ReleaseAPISerializer(self.get_queryset().get(pk=serializer.instance.pk)).data,
            status=status.HTTP_201_CREATED,
        )


class ReleaseDetailAPIEndpoint(ReleaseAPIMixin, BaseAPIView):
    """Retrieve, update or delete a single release."""

    serializer_class = ReleaseAPISerializer
    model = Release

    def get(self, request, slug, pk):
        return Response(ReleaseAPISerializer(self.get_queryset().get(pk=pk)).data, status=status.HTTP_200_OK)

    def patch(self, request, slug, pk):
        release = Release.objects.get(pk=pk, workspace__slug=slug)
        serializer = ReleaseAPISerializer(
            release, data=request.data, partial=True, context={"workspace_id": release.workspace_id}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(ReleaseAPISerializer(self.get_queryset().get(pk=pk)).data, status=status.HTTP_200_OK)

    def delete(self, request, slug, pk):
        Release.objects.get(pk=pk, workspace__slug=slug).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReleaseWorkItemAPIEndpoint(ReleaseAPIMixin, BaseAPIView):
    """Read and manage the scope of a release."""

    serializer_class = IssueSerializer
    model = ReleaseWorkItem

    def get(self, request, slug, release_id):
        work_items = Issue.issue_objects.filter(
            issue_releases__release_id=release_id,
            issue_releases__deleted_at__isnull=True,
            workspace__slug=slug,
            project_id__in=_accessible_project_ids(request.user, slug),
        ).select_related("state", "project", "workspace")
        return self.paginate(
            request=request,
            queryset=work_items,
            on_results=lambda data: IssueSerializer(data, many=True, fields=self.fields, expand=self.expand).data,
        )

    def post(self, request, slug, release_id):
        requested = request.data.get("work_items", [])
        if not requested:
            return Response({"error": "No work items provided"}, status=status.HTTP_400_BAD_REQUEST)

        release = Release.objects.get(pk=release_id, workspace__slug=slug)
        allowed = set(
            Issue.issue_objects.filter(
                pk__in=requested,
                workspace__slug=slug,
                project_id__in=_accessible_project_ids(request.user, slug),
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

    def delete(self, request, slug, release_id, work_item_id):
        ReleaseWorkItem.objects.filter(release_id=release_id, work_item_id=work_item_id, workspace__slug=slug).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReleaseCandidateAPIEndpoint(ReleaseAPIMixin, BaseAPIView):
    """
    Work items completed since the previous release -- the "what should go in
    this version?" question, answered server-side.

    This exists because the naive client-side version of this query is subtly
    wrong. Issue.completed_at is cleared whenever a work item leaves the
    completed group, so a ticket that shipped and was later reopened silently
    disappears from any window query run afterwards. Candidates are therefore a
    *proposal* only: the durable record is the ReleaseWorkItem row written by
    POSTing to the scope endpoint, which survives reopening.

    Window defaults to (previous release's release_date, this release's
    release_date or now]. Both ends are overridable via ?since= and ?until=.
    """

    serializer_class = IssueSerializer
    model = Issue

    def _parse(self, raw):
        """
        Parse an ISO-8601 bound, or raise ValueError for the caller to 400 on.

        The offset is un-mangled before parsing: "+" is the encoding for a space
        in a query string, so an un-escaped ?since=...T10:00:00+00:00 arrives as
        "...T10:00:00 00:00". Requiring %2B would be technically defensible and
        practically a trap, since every hand-rolled client hits it and the
        failure looks like a server fault rather than a bad request.
        """
        if not raw:
            return None
        normalised = re.sub(r"\s(\d{2}:\d{2})$", r"+\1", raw.strip()).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalised)
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed)
        return parsed

    def get(self, request, slug, release_id):
        release = Release.objects.get(pk=release_id, workspace__slug=slug)

        try:
            since = self._parse(request.GET.get("since"))
            until = self._parse(request.GET.get("until"))
        except ValueError:
            return Response(
                {"error": "since and until must be ISO-8601 timestamps, e.g. 2026-08-01T00:00:00Z"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if since is None:
            # Most recent shipped release that is not this one. Ordered by
            # release_date rather than created_at: releases are frequently
            # created out of order (a v1.4.1 hotfix minted after v1.5 exists).
            previous = (
                Release.objects.filter(
                    workspace__slug=slug,
                    status=ReleaseStatus.RELEASED,
                    release_date__isnull=False,
                )
                .exclude(pk=release.pk)
                .order_by("-release_date")
                .first()
            )
            if previous:
                since = timezone.make_aware(datetime.combine(previous.release_date, time.min))

        if until is None:
            until = (
                timezone.make_aware(datetime.combine(release.release_date, time.max))
                if release.release_date
                else timezone.now()
            )

        candidates = Issue.issue_objects.filter(
            workspace__slug=slug,
            state__group="completed",
            completed_at__isnull=False,
            completed_at__lte=until,
            project_id__in=_accessible_project_ids(request.user, slug),
        )
        if since:
            candidates = candidates.filter(completed_at__gt=since)

        if request.GET.get("exclude_assigned", "true").lower() == "true":
            candidates = candidates.exclude(
                issue_releases__release_id=release.pk,
                issue_releases__deleted_at__isnull=True,
            )

        if project_id := request.GET.get("project_id"):
            candidates = candidates.filter(project_id=project_id)

        candidates = candidates.select_related("state", "project", "workspace").order_by("completed_at")

        return self.paginate(
            request=request,
            queryset=candidates,
            on_results=lambda data: IssueSerializer(data, many=True, fields=self.fields, expand=self.expand).data,
        )


class ReleaseChangelogAPIEndpoint(ReleaseAPIMixin, BaseAPIView):
    """The rich-text changelog document attached to a release."""

    model = ReleaseChangelog

    def get(self, request, slug, release_id):
        changelog = ReleaseChangelog.objects.filter(release_id=release_id, workspace__slug=slug).first()
        if changelog is None:
            return Response({"description_html": "<p></p>", "description_json": {}}, status=status.HTTP_200_OK)
        return Response(
            {
                "id": str(changelog.id),
                "release": str(changelog.release_id),
                "description_html": changelog.changelog.description_html,
                "description_json": changelog.changelog.description_json,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, slug, release_id):
        release = Release.objects.get(pk=release_id, workspace__slug=slug)
        with transaction.atomic():
            changelog = ReleaseChangelog.objects.select_for_update().filter(release=release).first()
            if changelog is None:
                changelog = ReleaseChangelog.objects.create(
                    release=release,
                    changelog=Description.objects.create(workspace_id=release.workspace_id),
                    workspace_id=release.workspace_id,
                )
            document = changelog.changelog
            if "description_html" in request.data:
                document.description_html = request.data["description_html"]
            if "description_json" in request.data:
                document.description_json = request.data["description_json"]
            document.save()

        return Response(
            {
                "id": str(changelog.id),
                "release": str(changelog.release_id),
                "description_html": changelog.changelog.description_html,
                "description_json": changelog.changelog.description_json,
            },
            status=status.HTTP_200_OK,
        )


class ReleaseTagAPIEndpoint(BaseAPIView):
    """
    Version tags -- the join point between a release and the source repository.

    POST is upsert-by-version so a CI job can call it unconditionally on every
    build without first checking whether the tag already exists.
    """

    permission_classes = [WorkspaceEntityPermission]
    serializer_class = ReleaseTagAPISerializer
    model = ReleaseTag

    @property
    def workspace_slug(self):
        return self.kwargs.get("slug")

    def get_queryset(self):
        return ReleaseTag.objects.filter(workspace__slug=self.workspace_slug).order_by("-created_at")

    def get(self, request, slug):
        tags = self.get_queryset()
        if version := request.GET.get("version"):
            tags = tags.filter(version=version)
        return self.paginate(
            request=request,
            queryset=tags,
            on_results=lambda data: ReleaseTagAPISerializer(data, many=True).data,
        )

    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        version = request.data.get("version")
        if not version:
            return Response({"error": "version is required"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            tag = ReleaseTag.objects.select_for_update().filter(workspace=workspace, version=version).first()
            serializer = (
                ReleaseTagAPISerializer(tag, data=request.data, partial=True)
                if tag
                else (ReleaseTagAPISerializer(data=request.data))
            )
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            serializer.save(workspace_id=workspace.id)

        return Response(serializer.data, status=status.HTTP_200_OK if tag else status.HTTP_201_CREATED)
