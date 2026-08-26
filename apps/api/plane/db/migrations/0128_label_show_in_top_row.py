# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0127_label_logo_props")]

    operations = [
        migrations.AddField(
            model_name="label",
            name="show_in_top_row",
            field=models.BooleanField(default=False),
        )
    ]
