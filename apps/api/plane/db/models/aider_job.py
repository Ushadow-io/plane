# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models

# Module imports
from .project import ProjectBaseModel


class AiderJobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"


class AiderJob(ProjectBaseModel):
    """
    A request to let aider fix a work item and open a PR.

    Plane never runs aider itself. The row is a queue entry: an external
    aider-runner (tools/aider-runner) polls the API-key surface for queued jobs,
    claims one, and writes back branch / PR URL / error. Pull rather than push
    so the runner can live on a laptop with no inbound network, and move into
    the cluster later without any change here.
    """

    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="aider_jobs")
    instructions = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=AiderJobStatus.choices, default=AiderJobStatus.QUEUED)
    branch = models.CharField(max_length=255, blank=True, default="")
    pr_url = models.URLField(max_length=1024, blank=True, default="")
    error = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Aider Job"
        verbose_name_plural = "Aider Jobs"
        db_table = "aider_jobs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue_id} [{self.status}]"
