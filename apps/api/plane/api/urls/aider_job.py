# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import AiderJobClaimAPIEndpoint, AiderJobDetailAPIEndpoint, AiderJobQueueAPIEndpoint

urlpatterns = [
    path("workspaces/<str:slug>/aider-jobs/", AiderJobQueueAPIEndpoint.as_view(), name="aider-jobs"),
    path("workspaces/<str:slug>/aider-jobs/<uuid:pk>/", AiderJobDetailAPIEndpoint.as_view(), name="aider-job"),
    path(
        "workspaces/<str:slug>/aider-jobs/<uuid:pk>/claim/",
        AiderJobClaimAPIEndpoint.as_view(),
        name="aider-job-claim",
    ),
]
