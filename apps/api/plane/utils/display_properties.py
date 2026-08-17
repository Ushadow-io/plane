# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.


def workspace_default_display_properties(workspace=None, workspace_id=None, slug=None):
    """The display properties a newly created user-property row should start from.

    Every per-user row -- project, cycle, module and workspace-level -- is seeded from this
    rather than from the model field default, because a JSONField default is a module-level
    callable that cannot see which workspace the row belongs to.

    Pass an already-fetched `workspace` where the caller has one; the id and slug forms cost a
    lookup, and callers sit on the get_or_create path of endpoints hit on every board load.

    A missing workspace falls back to the built-in defaults rather than raising: seeding is a
    convenience on top of row creation, and a lookup failure should not stop a member from
    opening a project. The imports are deferred because plane.db.models imports plane.utils.
    """
    from plane.db.models import Workspace
    from plane.db.models.issue import get_default_display_properties

    if workspace is not None:
        properties = workspace.default_display_properties
    elif workspace_id is not None or slug is not None:
        lookup = {"pk": workspace_id} if workspace_id is not None else {"slug": slug}
        properties = Workspace.objects.filter(**lookup).values_list("default_display_properties", flat=True).first()
    else:
        properties = None

    # A workspace predating the field, or one whose JSON has been emptied, still gets a usable set.
    return properties if isinstance(properties, dict) and properties else get_default_display_properties()
