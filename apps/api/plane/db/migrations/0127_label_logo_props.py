# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0126_oidc_workspace_grant")]

    operations = [
        migrations.AddField(
            model_name="label",
            name="logo_props",
            field=models.JSONField(default=dict),
        )
    ]
