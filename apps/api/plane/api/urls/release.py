# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    ReleaseCandidateAPIEndpoint,
    ReleaseChangelogAPIEndpoint,
    ReleaseDetailAPIEndpoint,
    ReleaseListCreateAPIEndpoint,
    ReleaseTagAPIEndpoint,
    ReleaseWorkItemAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/releases/",
        ReleaseListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="releases",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:pk>/",
        ReleaseDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="releases-detail",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:release_id>/work-items/",
        ReleaseWorkItemAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="release-work-items",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:release_id>/work-items/<uuid:work_item_id>/",
        ReleaseWorkItemAPIEndpoint.as_view(http_method_names=["delete"]),
        name="release-work-items-detail",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:release_id>/candidates/",
        ReleaseCandidateAPIEndpoint.as_view(http_method_names=["get"]),
        name="release-candidates",
    ),
    path(
        "workspaces/<str:slug>/releases/<uuid:release_id>/changelog/",
        ReleaseChangelogAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="release-changelog",
    ),
    path(
        "workspaces/<str:slug>/release-tags/",
        ReleaseTagAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="release-tags",
    ),
]
