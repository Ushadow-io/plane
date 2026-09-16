# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import WorkItemAiderJobEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/aider-jobs/",
        WorkItemAiderJobEndpoint.as_view(),
        name="work-item-aider-jobs",
    ),
]
