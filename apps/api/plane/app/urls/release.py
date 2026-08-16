# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    ReleaseChangelogEndpoint,
    ReleaseTagViewSet,
    ReleaseViewSet,
    ReleaseWorkItemEndpoint,
)

# Releases are workspace-scoped by design: a release groups work from several
# projects, so there is deliberately no /projects/<id>/releases/ variant.
urlpatterns = [
    path(
        "workspaces/<str:slug>/releases/",
        ReleaseViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-releases",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:pk>/",
        ReleaseViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-releases",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:release_id>/work-items/",
        ReleaseWorkItemEndpoint.as_view(),
        name="release-work-items",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:release_id>/work-items/<uuid:work_item_id>/",
        ReleaseWorkItemEndpoint.as_view(),
        name="release-work-items",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:release_id>/changelog/",
        ReleaseChangelogEndpoint.as_view(),
        name="release-changelog",
    ),
    path(
        "workspaces/<str:slug>/release-tags/",
        ReleaseTagViewSet.as_view({"get": "list", "post": "create"}),
        name="release-tags",
    ),
    path(
        "workspaces/<str:slug>/release-tags/<uuid:pk>/",
        ReleaseTagViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="release-tags",
    ),
]
