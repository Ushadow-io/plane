# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import Release, ReleaseTag
from plane.utils.release import validate_release_references
from .base import BaseSerializer


class ReleaseTagAPISerializer(BaseSerializer):
    class Meta:
        model = ReleaseTag
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class ReleaseAPISerializer(BaseSerializer):
    description_html = serializers.CharField(source="description.description_html", read_only=True)
    tag_detail = ReleaseTagAPISerializer(source="tag", read_only=True)

    completed_work_items = serializers.IntegerField(read_only=True)
    cancelled_work_items = serializers.IntegerField(read_only=True)
    pending_work_items = serializers.IntegerField(read_only=True)
    total_work_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Release
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "description",
            "work_items",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]

    def validate(self, data):
        workspace_id = self.context.get("workspace_id")

        # tag and lead are resolved by DRF against the whole table, so they must
        # be confirmed in-tenant before they are allowed to attach.
        reference_errors = validate_release_references(workspace_id, tag=data.get("tag"), lead=data.get("lead"))
        if reference_errors:
            raise serializers.ValidationError(reference_errors)

        # external_id/external_source are how an importer or a CI job claims
        # ownership of a release it created. Enforcing uniqueness here rather
        # than at the DB level keeps the error a 400 with a readable message
        # instead of a 500 from an IntegrityError.
        external_id = data.get("external_id")
        external_source = data.get("external_source")
        if external_id and external_source:
            existing = Release.objects.filter(
                workspace_id=workspace_id,
                external_id=external_id,
                external_source=external_source,
            )
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {"error": "A release with the same external id and source already exists."}
                )
        return data
