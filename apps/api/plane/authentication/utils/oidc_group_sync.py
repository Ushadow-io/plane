# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Reconcile Plane workspace membership against an OIDC provider's group claim.

The policy, in one place:

* **Elevate, never demote.** A mapped role raises an existing membership but
  never lowers it - somebody deliberately promoted inside Plane keeps that
  promotion.
* **Revoke only what we granted.** Every membership sync creates is recorded in
  :class:`OIDCWorkspaceGrant`. When a group disappears from the claim only the
  matching grant is withdrawn; memberships created through Plane's own invite
  UI are never touched.
* **Never lock a workspace out.** The workspace owner, and the last remaining
  active admin, are skipped by revocation even when their grant has lapsed.

Revocation deactivates (``is_active = False``) rather than deletes, matching how
Plane removes members elsewhere, so the row and its history survive.

Nothing here may break sign-in: a malformed map or a missing workspace must cost
the user their group-derived access, never their login. Everything is therefore
wrapped and logged rather than raised.
"""

# Python imports
import json
import logging
import os

# Django imports
from django.db import DatabaseError, transaction

# Module imports
from plane.db.models import OIDCWorkspaceGrant, Workspace, WorkspaceMember
from plane.db.models.project import ROLE
from plane.license.utils.instance_value import get_configuration_value

logger = logging.getLogger("plane.authentication")

# Accepted spellings for a role in the mapping config. Names are the documented
# form; the raw integers are accepted too so an operator who reads them out of
# the database is not told they are wrong.
ROLE_NAMES = {role.name: role.value for role in ROLE}
ROLE_VALUES = {role.value for role in ROLE}


def _parse_role(raw):
    """Return a valid Plane role integer, or None if the value is unusable."""
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int) and raw in ROLE_VALUES:
        return raw
    if isinstance(raw, str):
        key = raw.strip().upper()
        if key in ROLE_NAMES:
            return ROLE_NAMES[key]
        if key.isdigit() and int(key) in ROLE_VALUES:
            return int(key)
    return None


def get_group_workspace_map():
    """Parse OIDC_GROUP_WORKSPACE_MAP, returning {} when unset or malformed."""
    (raw,) = get_configuration_value(
        [
            {
                "key": "OIDC_GROUP_WORKSPACE_MAP",
                "default": os.environ.get("OIDC_GROUP_WORKSPACE_MAP", ""),
            }
        ]
    )
    if not raw or not str(raw).strip():
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("OIDC_GROUP_WORKSPACE_MAP is not valid JSON; group sync skipped")
        return {}
    if not isinstance(parsed, dict):
        logger.warning("OIDC_GROUP_WORKSPACE_MAP must be a JSON object; group sync skipped")
        return {}
    return parsed


def resolve_desired_grants(groups, mapping):
    """
    Collapse the claim's groups into one target role per workspace slug.

    Two groups can name the same workspace; the strongest role wins, so adding
    someone to an extra group can only ever widen their access here.
    Returns {workspace_slug: (role, group_that_won)}.
    """
    desired = {}
    for group in groups or []:
        if not isinstance(group, str):
            continue
        for entry in mapping.get(group, []) or []:
            if not isinstance(entry, dict):
                continue
            slug = entry.get("workspace")
            role = _parse_role(entry.get("role"))
            if not slug or role is None:
                logger.warning("Ignoring malformed OIDC group mapping entry for group %r", group)
                continue
            current = desired.get(slug)
            if current is None or role > current[0]:
                desired[slug] = (role, group)
    return desired


def _is_last_active_admin(workspace, user):
    """True when removing this user would leave the workspace with no admin."""
    return (
        WorkspaceMember.objects.filter(workspace=workspace, role=ROLE.ADMIN.value, is_active=True)
        .exclude(member=user)
        .count()
        == 0
    )


def sync_oidc_workspace_groups(user, groups):
    """
    Bring `user`'s workspace membership in line with their OIDC groups.

    Safe to call on every login; it is idempotent. Never raises.
    """
    try:
        mapping = get_group_workspace_map()
        if not mapping:
            return

        desired = resolve_desired_grants(groups, mapping)

        with transaction.atomic():
            granted_slugs = set()

            for slug, (role, group) in desired.items():
                workspace = Workspace.objects.filter(slug=slug).first()
                if workspace is None:
                    logger.warning("OIDC group mapping references unknown workspace %r", slug)
                    continue

                member = WorkspaceMember.objects.filter(workspace=workspace, member=user).first()
                if member is None:
                    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
                else:
                    # Elevate only. A membership deactivated earlier - whether by
                    # this sync or by an admin - is reinstated, because the group
                    # is current authorisation and should win over a stale removal.
                    updates = []
                    if role > member.role:
                        member.role = role
                        updates.append("role")
                    if not member.is_active:
                        member.is_active = True
                        updates.append("is_active")
                    if updates:
                        member.save(update_fields=updates)

                OIDCWorkspaceGrant.objects.update_or_create(
                    user=user,
                    workspace=workspace,
                    defaults={"group": group, "role": role},
                )
                granted_slugs.add(slug)

            # Withdraw grants whose group is no longer claimed. Only rows this
            # sync created appear here, so manual invites are untouched.
            stale = OIDCWorkspaceGrant.objects.filter(user=user).exclude(workspace__slug__in=granted_slugs)
            for grant in stale.select_related("workspace"):
                workspace = grant.workspace
                if workspace.owner_id == user.id:
                    logger.info("Keeping workspace owner %s in %s despite lapsed group", user.id, workspace.slug)
                    continue
                member = WorkspaceMember.objects.filter(workspace=workspace, member=user, is_active=True).first()
                if member and member.role == ROLE.ADMIN.value and _is_last_active_admin(workspace, user):
                    logger.info("Keeping last admin %s in %s despite lapsed group", user.id, workspace.slug)
                    continue
                if member:
                    member.is_active = False
                    member.save(update_fields=["is_active"])
                grant.delete()
    except DatabaseError:
        logger.exception("OIDC workspace group sync failed")
    except Exception:
        logger.exception("OIDC workspace group sync failed unexpectedly")
