# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from datetime import timedelta

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import AiderJob, AiderJobStatus, Issue

# A runner that dies mid-job never marks it failed. After this long an active
# job stops blocking a new delegation, so a crash cannot wedge a work item.
STALE_AFTER = timedelta(hours=2)


def serialize_aider_job(job):
    return {
        "id": str(job.id),
        "issue": str(job.issue_id),
        "project": str(job.project_id),
        "instructions": job.instructions,
        "status": job.status,
        "branch": job.branch,
        "pr_url": job.pr_url,
        "error": job.error,
        "created_by": str(job.created_by_id) if job.created_by_id else None,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


class WorkItemAiderJobEndpoint(BaseAPIView):
    """Delegate a work item to aider from the UI (session auth)."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, issue_id):
        jobs = AiderJob.objects.filter(workspace__slug=slug, project_id=project_id, issue_id=issue_id)[:10]
        return Response([serialize_aider_job(j) for j in jobs], status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, issue_id):
        issue = Issue.objects.filter(workspace__slug=slug, project_id=project_id, pk=issue_id).first()
        if issue is None:
            return Response({"error": "Work item not found"}, status=status.HTTP_404_NOT_FOUND)

        active = AiderJob.objects.filter(
            issue=issue,
            status__in=[AiderJobStatus.QUEUED, AiderJobStatus.RUNNING],
            updated_at__gte=timezone.now() - STALE_AFTER,
        ).first()
        if active:
            return Response(
                {"error": "aider is already working on this work item", "job": serialize_aider_job(active)},
                status=status.HTTP_409_CONFLICT,
            )

        job = AiderJob.objects.create(
            issue=issue,
            project_id=project_id,
            instructions=(request.data.get("instructions") or "").strip(),
        )
        return Response(serialize_aider_job(job), status=status.HTTP_201_CREATED)
