# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models

# Module imports
from .base import BaseModel


class OIDCWorkspaceGrant(BaseModel):
    """
    Record of a workspace membership that OIDC group sync created.

    Sync needs to tell its own grants apart from memberships a human created
    through Plane's invite UI: losing a group must revoke the former and leave
    the latter alone. Without this ledger the two are indistinguishable, and
    sync would either strip manual invites or never revoke anything.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="oidc_workspace_grants",
    )
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="oidc_workspace_grants",
    )
    # The claim value that produced this grant, e.g. "psyclo/admin". Kept for
    # operator debugging - "why does this person have access?" is otherwise
    # unanswerable once the mapping config has moved on.
    group = models.CharField(max_length=255)
    role = models.PositiveSmallIntegerField()

    class Meta:
        unique_together = ["user", "workspace"]
        verbose_name = "OIDC Workspace Grant"
        verbose_name_plural = "OIDC Workspace Grants"
        db_table = "oidc_workspace_grants"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user.email} <{self.workspace.slug}> via {self.group}"
