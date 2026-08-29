# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse, extend_schema

# Module imports
from plane.api.views.base import BaseAPIView
from plane.db.models import Issue, IssueSubscriber, ProjectMember, User
from plane.utils.openapi import (
    FORBIDDEN_RESPONSE,
    PROJECT_ID_PARAMETER,
    PROJECT_NOT_FOUND_RESPONSE,
    UNAUTHORIZED_RESPONSE,
    WORKSPACE_SLUG_PARAMETER,
)
from plane.utils.permissions import ProjectAdminPermission, ProjectEntityPermission


class WorkItemSubscriberAPIEndpoint(BaseAPIView):
    """Manage who is notified about a work item, over the API-key surface.

    Upstream exposes issue subscribers only on the session-authenticated app API
    (`/api/workspaces/.../issues/<id>/issue-subscribers/`), where `subscribe`
    can only ever act on `request.user`. That is unusable for an integration:
    an API token acts as its own bot user, so there is no way for an external
    system to say "notify THIS person about THIS work item".

    We need exactly that. Bug reports filed from the Psyclo apps land in Intake
    as work items owned by the token user, and a reporter who ticked "allow
    Psyclopedia to contact me" has to receive Plane's own comment notification
    email so the thread can be two-way. See the notification recipient filter in
    `plane/bgtasks/notification_task.py` -- a subscriber is only mailed if they
    are ALSO an active `ProjectMember`, which is why that is validated here
    rather than left to fail silently later.
    """

    permission_classes = [ProjectEntityPermission]

    def get_permissions(self):
        # Reading who is subscribed is ordinary project-entity access; changing
        # someone else's notifications is not, so writes require project admin.
        if self.request.method == "GET":
            return [ProjectEntityPermission()]
        return [ProjectAdminPermission()]

    @extend_schema(
        operation_id="get_work_item_subscribers",
        summary="List work item subscribers",
        description="Retrieve the users subscribed to notifications for a work item.",
        tags=["Work Items"],
        parameters=[WORKSPACE_SLUG_PARAMETER, PROJECT_ID_PARAMETER],
        responses={
            200: OpenApiResponse(description="List of subscriber user ids"),
            401: UNAUTHORIZED_RESPONSE,
            403: FORBIDDEN_RESPONSE,
            404: PROJECT_NOT_FOUND_RESPONSE,
        },
    )
    def get(self, request, slug, project_id, issue_id):
        subscriber_ids = IssueSubscriber.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).values_list("subscriber_id", flat=True)
        return Response(
            [str(subscriber_id) for subscriber_id in subscriber_ids],
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        operation_id="create_work_item_subscriber",
        summary="Subscribe a user to a work item",
        description=(
            "Subscribe a user to notifications for a work item. Accepts either "
            "`subscriber` (a user id) or `email`. The user must already be an "
            "active member of the project, otherwise Plane will not send them "
            "notifications."
        ),
        tags=["Work Items"],
        parameters=[WORKSPACE_SLUG_PARAMETER, PROJECT_ID_PARAMETER],
        responses={
            201: OpenApiResponse(description="Subscriber created"),
            200: OpenApiResponse(description="Subscriber already existed"),
            400: OpenApiResponse(description="Invalid subscriber"),
            401: UNAUTHORIZED_RESPONSE,
            403: FORBIDDEN_RESPONSE,
            404: PROJECT_NOT_FOUND_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, issue_id):
        issue = Issue.objects.filter(workspace__slug=slug, project_id=project_id, pk=issue_id).first()
        if issue is None:
            return Response({"error": "Work item does not exist"}, status=status.HTTP_404_NOT_FOUND)

        # `email` is accepted alongside `subscriber` because the calling system
        # generally knows the person by address, not by their Plane user id, and
        # would otherwise have to page the whole member list to translate it.
        subscriber_id = request.data.get("subscriber")
        email = request.data.get("email")
        if subscriber_id:
            user = User.objects.filter(pk=subscriber_id).first()
        elif email:
            user = User.objects.filter(email__iexact=str(email).strip()).first()
        else:
            return Response(
                {"error": "Either subscriber or email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user is None:
            return Response({"error": "User does not exist"}, status=status.HTTP_400_BAD_REQUEST)

        # Enforced here, not merely documented: a subscriber who is not an
        # active project member is dropped by the notification task's recipient
        # filter, so accepting one would create a row that looks correct and
        # silently never delivers anything.
        if not ProjectMember.objects.filter(project_id=project_id, member=user, is_active=True).exists():
            return Response(
                {"error": "User is not an active member of this project"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _, created = IssueSubscriber.objects.get_or_create(
            issue_id=issue_id,
            subscriber=user,
            defaults={"project_id": project_id, "workspace_id": issue.workspace_id},
        )
        return Response(
            {"subscriber": str(user.id), "created": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @extend_schema(
        operation_id="delete_work_item_subscriber",
        summary="Unsubscribe a user from a work item",
        description="Remove a user's subscription to a work item's notifications.",
        tags=["Work Items"],
        parameters=[WORKSPACE_SLUG_PARAMETER, PROJECT_ID_PARAMETER],
        responses={
            204: OpenApiResponse(description="Subscriber removed"),
            401: UNAUTHORIZED_RESPONSE,
            403: FORBIDDEN_RESPONSE,
            404: PROJECT_NOT_FOUND_RESPONSE,
        },
    )
    def delete(self, request, slug, project_id, issue_id, subscriber_id):
        subscription = IssueSubscriber.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            issue_id=issue_id,
            subscriber_id=subscriber_id,
        ).first()
        if subscription is None:
            return Response({"error": "Subscription does not exist"}, status=status.HTTP_404_NOT_FOUND)
        subscription.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
