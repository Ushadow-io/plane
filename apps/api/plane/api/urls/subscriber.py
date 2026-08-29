# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import WorkItemSubscriberAPIEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/subscribers/",
        WorkItemSubscriberAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-subscribers",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/subscribers/<uuid:subscriber_id>/",
        WorkItemSubscriberAPIEndpoint.as_view(http_method_names=["delete"]),
        name="work-item-subscriber",
    ),
]
