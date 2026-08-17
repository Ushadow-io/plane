# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction
from django.shortcuts import get_object_or_404

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import WorkspaceDefaultDisplayPropertiesSerializer
from plane.db.models import (
    CycleUserProperties,
    ModuleUserProperties,
    ProjectUserProperty,
    Workspace,
    WorkspaceUserProperties,
)
from plane.app.views.base import BaseAPIView

# Every table holding a member's own copy of the display properties. All four are seeded from
# the workspace default when a row is first created, and all four are rewritten by the apply
# action, so a member sees one consistent set of properties wherever they look.
USER_PROPERTY_MODELS = (
    ProjectUserProperty,
    CycleUserProperties,
    ModuleUserProperties,
    WorkspaceUserProperties,
)


class WorkspaceDefaultDisplayPropertiesEndpoint(BaseAPIView):
    """The display properties new member rows start from.

    Read by any member so the client can show what the workspace standard is; only an admin
    can change it. Changing it does NOT touch anybody's existing rows -- see the apply
    endpoint below for that.
    """

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        workspace = get_object_or_404(Workspace, slug=slug)
        serializer = WorkspaceDefaultDisplayPropertiesSerializer(workspace)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def patch(self, request, slug):
        workspace = get_object_or_404(Workspace, slug=slug)

        # Merge rather than replace, so a client can toggle a single property without having
        # to send -- and therefore without being able to clobber -- the other fifteen.
        submitted = request.data.get("default_display_properties", {})
        if not isinstance(submitted, dict):
            return Response(
                {"error": "default_display_properties must be an object."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        merged = {**workspace.default_display_properties, **submitted}

        serializer = WorkspaceDefaultDisplayPropertiesSerializer(
            workspace, data={"default_display_properties": merged}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkspaceDefaultDisplayPropertiesApplyEndpoint(BaseAPIView):
    """Force every member's display properties in this workspace back to the default.

    Deliberately destructive and deliberately explicit: saving the default alone leaves
    existing members alone, and this is the only thing that overwrites what they have chosen
    for themselves. There is no undo -- a member's previous selection is not stored anywhere
    else -- so the client asks for confirmation before calling it.
    """

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug):
        workspace = get_object_or_404(Workspace, slug=slug)
        defaults = workspace.default_display_properties

        updated = {}
        with transaction.atomic():
            for model in USER_PROPERTY_MODELS:
                updated[model._meta.db_table] = model.objects.filter(workspace=workspace).update(
                    display_properties=defaults
                )

        return Response(
            {"display_properties": defaults, "updated": updated},
            status=status.HTTP_200_OK,
        )
