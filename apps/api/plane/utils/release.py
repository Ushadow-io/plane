# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.db.models import WorkspaceMember


def validate_release_references(workspace_id, tag=None, lead=None):
    """
    Tenancy check for the FKs hanging off a Release.

    Release.tag and Release.lead are plain PrimaryKeyRelatedFields, and DRF
    resolves those against the *whole* table unless told otherwise. Without this
    check a member of one workspace can PATCH a release with the UUID of another
    workspace's ReleaseTag and have it attach -- the tag's version string and
    git_tag then render back to them, leaking a private version number across a
    tenant boundary. The same applies to lead, which would surface an unrelated
    user's name and avatar inside the workspace.

    Returns a dict of field -> message, empty when everything is in-tenant.
    """
    errors = {}

    if tag is not None and tag.workspace_id != workspace_id:
        errors["tag"] = "The selected tag does not belong to this workspace."

    if (
        lead is not None
        and not WorkspaceMember.objects.filter(workspace_id=workspace_id, member=lead, is_active=True).exists()
    ):
        errors["lead"] = "The selected lead is not an active member of this workspace."

    return errors
