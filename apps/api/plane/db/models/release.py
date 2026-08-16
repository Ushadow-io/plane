# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

# Module imports
from .base import BaseModel
from ..mixins import ChangeTrackerMixin


class ReleaseStatus(models.TextChoices):
    UNRELEASED = "unreleased", "Unreleased"
    RELEASED = "released", "Released"
    CANCELLED = "cancelled", "Cancelled"


class ReleaseTag(BaseModel):
    """
    A version identifier shared across releases, e.g. ``v2.3.0``.

    Modelled as its own table rather than a column on Release because a tag is
    the join point to the source repository: ``git_tag`` and ``commit_hash``
    are what release-notes automation writes back after cutting a build. Keeping
    them off Release means the plan (a release) and the artefact (a git tag) can
    be created independently and associated later, which is the actual workflow.
    """

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="release_tags")
    version = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    commit_hash = models.CharField(max_length=255, blank=True, null=True)
    git_tag = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "version"],
                condition=Q(deleted_at__isnull=True),
                name="release_tag_unique_version_per_workspace_when_not_deleted",
            )
        ]
        verbose_name = "Release Tag"
        verbose_name_plural = "Release Tags"
        db_table = "release_tags"
        ordering = ("-created_at",)

    def __str__(self):
        return self.version


class Release(ChangeTrackerMixin, BaseModel):
    """
    A workspace-level version container.

    Deliberately *not* a ``WorkspaceBaseModel``: that base carries a nullable
    ``project`` FK, and a release spans projects by definition. A release
    grouping work from three projects has no single project to point at, so the
    column would be permanently null and invite the wrong query.
    """

    TRACKED_FIELDS = ["status"]

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="releases")
    name = models.CharField(max_length=255)
    description = models.ForeignKey(
        "db.Description",
        on_delete=models.SET_NULL,
        related_name="release_description",
        null=True,
    )
    status = models.CharField(
        max_length=255,
        choices=ReleaseStatus.choices,
        default=ReleaseStatus.UNRELEASED,
    )
    tag = models.ForeignKey(
        "db.ReleaseTag",
        on_delete=models.SET_NULL,
        related_name="releases",
        null=True,
        blank=True,
    )
    lead = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="release_leads",
        null=True,
    )
    target_date = models.DateField(null=True, blank=True)
    release_date = models.DateField(null=True, blank=True)
    is_latest = models.BooleanField(default=False)
    is_prerelease = models.BooleanField(default=False)
    work_items = models.ManyToManyField(
        "db.Issue",
        blank=True,
        related_name="releases",
        through="ReleaseWorkItem",
        through_fields=("release", "work_item"),
    )
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name"],
                condition=Q(deleted_at__isnull=True),
                name="release_unique_name_per_workspace_when_not_deleted",
            )
        ]
        verbose_name = "Release"
        verbose_name_plural = "Releases"
        db_table = "releases"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        from .description import Description

        # A release always has somewhere to write its overview. Created lazily
        # here rather than enforced NOT NULL at the DB level so that a release
        # can be minted by automation (the release-notes tool, an importer)
        # without every caller having to know about the Description table.
        if self.description_id is None:
            self.description = Description.objects.create(workspace_id=self.workspace_id)

        # release_date is a historical fact, so it is stamped once and never
        # cleared. Contrast Issue.completed_at, which is reset to None whenever
        # a work item leaves the completed group -- correct for "is this done
        # right now?", wrong for "what shipped in v1.4?". Re-opening a shipped
        # release for a hotfix must not erase the date it originally shipped.
        #
        # Creation is always evaluated, not just transitions: ChangeTrackerMixin
        # baselines in __init__, so Release(status="released") reports no change
        # and automation minting an already-shipped release would get a null date.
        if (self._state.adding or self.has_changed("status")) and (
            self.status == ReleaseStatus.RELEASED and self.release_date is None
        ):
            self.release_date = timezone.now().date()

        with transaction.atomic():
            super(Release, self).save(*args, **kwargs)

            # At most one release per workspace carries the latest flag.
            if self.is_latest:
                Release.objects.filter(workspace_id=self.workspace_id, is_latest=True).exclude(pk=self.pk).update(
                    is_latest=False
                )

        # Re-baseline the change tracker so a second save() in the same request
        # does not re-fire the status transition above.
        self._track_fields()

    def __str__(self):
        return f"{self.name} <{self.workspace.name}>"


class ReleaseWorkItem(BaseModel):
    """
    Membership of a work item in a release's scope.

    A work item may belong to more than one release (a fix that ships in both
    ``v1.4.1`` and ``v1.5.0``), so this is a plain many-to-many with no
    uniqueness on work_item alone.
    """

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="release_work_items")
    release = models.ForeignKey("db.Release", on_delete=models.CASCADE, related_name="release_work_items")
    work_item = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="issue_releases")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["release", "work_item"],
                condition=Q(deleted_at__isnull=True),
                name="release_work_item_unique_pair_when_not_deleted",
            )
        ]
        verbose_name = "Release Work Item"
        verbose_name_plural = "Release Work Items"
        db_table = "release_work_items"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.release.name} <{self.work_item.name}>"


class ReleaseChangelog(BaseModel):
    """
    The rich-text changelog document for a release.

    Held in its own table pointing at a Description rather than as a second FK
    on Release, so the overview and the changelog are independently versioned by
    DescriptionVersion -- editing the changelog does not churn the overview's
    history.
    """

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="release_changelogs")
    release = models.ForeignKey("db.Release", on_delete=models.CASCADE, related_name="changelogs")
    changelog = models.ForeignKey("db.Description", on_delete=models.CASCADE, related_name="release_changelog")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["release"],
                condition=Q(deleted_at__isnull=True),
                name="release_changelog_unique_release_when_not_deleted",
            )
        ]
        verbose_name = "Release Changelog"
        verbose_name_plural = "Release Changelogs"
        db_table = "release_changelogs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"changelog <{self.release.name}>"
