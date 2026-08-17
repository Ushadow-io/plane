# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.db.models import FilteredRelation

from plane.db.models import Issue
from plane.utils.grouper import issue_queryset_grouper
from plane.utils.order_queryset import RELEASE_GROUP_KEY


@pytest.mark.unit
class TestReleaseGroupingKeepsUnreleasedWorkItems:
    """Regression tests for release grouping dropping unreleased work items.

    Release membership (ReleaseWorkItem) is soft-deleted, so the tombstones have
    to be excluded from the group. Doing that with `.filter()` — the way the
    label/module/assignee entries in GROUP_FILTER_MAPPER do — silently removes
    every work item that has NO release row at all: Django promotes the join to
    LEFT OUTER for the `deleted_at__isnull=True` test, then demotes it back to
    INNER once `.values()` selects release_id from that same join. The symptom
    is a board that is short by however many items are unreleased, with those
    items missing from the "None" column too, so nothing looks obviously wrong.

    These tests assert on the compiled SQL because the join type IS the bug.
    """

    def _sql(self, group_by, sub_group_by=None):
        queryset = issue_queryset_grouper(Issue.objects.all(), group_by, sub_group_by)
        fields = [f for f in (group_by, sub_group_by) if f]
        return str(queryset.values(*fields).query)

    @staticmethod
    def _filtered_relations(queryset):
        # Django keeps FilteredRelation aliases in Query._filtered_relations,
        # NOT in .annotations alongside ordinary annotations.
        return queryset.query._filtered_relations or {}

    def test_release_group_is_annotated_as_a_filtered_relation(self):
        queryset = issue_queryset_grouper(Issue.objects.all(), RELEASE_GROUP_KEY, None)
        alias = RELEASE_GROUP_KEY.split("__")[0]
        relations = self._filtered_relations(queryset)
        assert alias in relations
        assert isinstance(relations[alias], FilteredRelation)

    def test_annotation_is_added_when_release_is_the_sub_group(self):
        queryset = issue_queryset_grouper(Issue.objects.all(), "priority", RELEASE_GROUP_KEY)
        assert RELEASE_GROUP_KEY.split("__")[0] in self._filtered_relations(queryset)

    def test_annotation_is_absent_when_release_is_not_grouped_on(self):
        queryset = issue_queryset_grouper(Issue.objects.all(), "priority", "labels__id")
        assert RELEASE_GROUP_KEY.split("__")[0] not in self._filtered_relations(queryset)

    def test_release_join_is_left_outer(self):
        # The whole point: an INNER JOIN here drops unreleased work items.
        sql = self._sql(RELEASE_GROUP_KEY)
        assert "LEFT OUTER JOIN" in sql
        assert 'INNER JOIN "release_work_items"' not in sql

    def test_release_join_stays_left_outer_when_sub_grouped(self):
        sql = self._sql(RELEASE_GROUP_KEY, "labels__id")
        assert 'INNER JOIN "release_work_items"' not in sql

    def test_tombstones_are_excluded_in_the_join_condition_not_the_where(self):
        # The soft-delete check has to sit in the ON clause; in WHERE it would
        # filter out the NULL row that an unreleased work item produces.
        sql = self._sql(RELEASE_GROUP_KEY)
        on_clause = sql.split("LEFT OUTER JOIN", 1)[1].split("WHERE", 1)[0]
        assert "deleted_at" in on_clause
