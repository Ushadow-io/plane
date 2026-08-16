# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third Party imports
from rest_framework import serializers

# Module imports
from plane.db.models import (
    Description,
    Release,
    ReleaseChangelog,
    ReleaseTag,
    ReleaseWorkItem,
    User,
)
from .base import BaseSerializer, DynamicBaseSerializer


class ReleaseTagSerializer(BaseSerializer):
    class Meta:
        model = ReleaseTag
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class ReleaseWriteSerializer(BaseSerializer):
    """
    Write path for releases.

    ``description_html`` / ``description_json`` are surfaced as flat fields even
    though they live on a related Description row, so the editor component can
    PATCH a release the same way it patches any other rich-text entity and does
    not need to know the Description table exists.
    """

    lead_id = serializers.PrimaryKeyRelatedField(
        source="lead", queryset=User.objects.all(), required=False, allow_null=True
    )
    tag_id = serializers.PrimaryKeyRelatedField(
        source="tag", queryset=ReleaseTag.objects.all(), required=False, allow_null=True
    )
    description_html = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description_json = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Release
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "description",
            "work_items",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]

    def _write_description(self, release, validated_data):
        """Push flat rich-text fields down onto the related Description row."""
        html = validated_data.pop("description_html", None)
        json_body = validated_data.pop("description_json", None)
        if html is None and json_body is None:
            return

        description = release.description
        if description is None:
            description = Description.objects.create(workspace_id=release.workspace_id)
            release.description = description
            release.save(update_fields=["description"])

        if html is not None:
            description.description_html = html
        if json_body is not None:
            description.description_json = json_body
        description.save()

    def create(self, validated_data):
        html = validated_data.pop("description_html", None)
        json_body = validated_data.pop("description_json", None)
        workspace = self.context["workspace"]

        release = Release.objects.create(**validated_data, workspace=workspace)
        self._write_description(release, {"description_html": html, "description_json": json_body})
        return release

    def update(self, instance, validated_data):
        self._write_description(instance, validated_data)
        return super().update(instance, validated_data)


class ReleaseSerializer(DynamicBaseSerializer):
    """
    Read path for releases.

    The three progress counters are annotated by the viewset queryset rather
    than computed per-instance -- a list of 50 releases would otherwise fan out
    into 150 COUNT queries.
    """

    description_html = serializers.CharField(source="description.description_html", read_only=True)
    description_json = serializers.JSONField(source="description.description_json", read_only=True)
    tag_detail = ReleaseTagSerializer(source="tag", read_only=True)

    completed_work_items = serializers.IntegerField(read_only=True)
    cancelled_work_items = serializers.IntegerField(read_only=True)
    pending_work_items = serializers.IntegerField(read_only=True)
    total_work_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Release
        fields = [
            "id",
            "name",
            "status",
            "workspace",
            "lead",
            "tag",
            "tag_detail",
            "target_date",
            "release_date",
            "is_latest",
            "is_prerelease",
            "description",
            "description_html",
            "description_json",
            "external_source",
            "external_id",
            "completed_work_items",
            "cancelled_work_items",
            "pending_work_items",
            "total_work_items",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = fields


class ReleaseLiteSerializer(BaseSerializer):
    """Minimal shape for embedding a release inside a work item's payload."""

    class Meta:
        model = Release
        fields = ["id", "name", "status", "target_date", "release_date", "is_latest"]
        read_only_fields = fields


class ReleaseWorkItemSerializer(BaseSerializer):
    class Meta:
        model = ReleaseWorkItem
        fields = ["id", "release", "work_item", "workspace", "created_at", "created_by"]
        read_only_fields = fields


class ReleaseChangelogSerializer(BaseSerializer):
    description_html = serializers.CharField(source="changelog.description_html", read_only=True)
    description_json = serializers.JSONField(source="changelog.description_json", read_only=True)

    class Meta:
        model = ReleaseChangelog
        fields = [
            "id",
            "release",
            "changelog",
            "workspace",
            "description_html",
            "description_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
