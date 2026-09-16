# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.views.base import BaseAPIView
from plane.app.views.aider.base import serialize_aider_job
from plane.db.models import AiderJob, AiderJobStatus
from plane.utils.permissions import WorkspaceOwnerPermission


def runner_payload(job):
    """Everything the runner needs, so it makes no follow-up API calls."""
    data = serialize_aider_job(job)
    data.update(
        {
            "workspace_slug": job.workspace.slug,
            "project_identifier": job.project.identifier,
            "sequence_id": job.issue.sequence_id,
            "name": job.issue.name,
            "description": job.issue.description_stripped or "",
            "requested_by": job.created_by.display_name if job.created_by else "",
        }
    )
    return data


class AiderJobQueueAPIEndpoint(BaseAPIView):
    """Queue for an external aider-runner.

    Workspace admin only: whoever holds this token can read every queued work
    item in the workspace and write PR links onto them.
    """

    permission_classes = [WorkspaceOwnerPermission]

    def jobs(self, slug):
        return AiderJob.objects.filter(workspace__slug=slug).select_related("issue", "project", "workspace", "created_by")

    def get(self, request, slug):
        qs = self.jobs(slug)
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        return Response([runner_payload(j) for j in qs.order_by("created_at")[:50]], status=status.HTTP_200_OK)


class AiderJobClaimAPIEndpoint(AiderJobQueueAPIEndpoint):
    def post(self, request, slug, pk):
        # Conditional UPDATE so two runners can never both claim one job.
        claimed = self.jobs(slug).filter(pk=pk, status=AiderJobStatus.QUEUED).update(
            status=AiderJobStatus.RUNNING, started_at=timezone.now(), updated_at=timezone.now()
        )
        if not claimed:
            return Response({"error": "Job is not queued"}, status=status.HTTP_409_CONFLICT)
        return Response(runner_payload(self.jobs(slug).get(pk=pk)), status=status.HTTP_200_OK)


class AiderJobDetailAPIEndpoint(AiderJobQueueAPIEndpoint):
    WRITABLE = ("status", "branch", "pr_url", "error")

    def patch(self, request, slug, pk):
        job = self.jobs(slug).filter(pk=pk).first()
        if job is None:
            return Response({"error": "Job not found"}, status=status.HTTP_404_NOT_FOUND)
        for field in self.WRITABLE:
            if field in request.data:
                setattr(job, field, request.data[field] or "")
        if job.pr_url and not job.pr_url.startswith("https://"):
            return Response({"error": "pr_url must be an https URL"}, status=status.HTTP_400_BAD_REQUEST)
        if job.status not in AiderJobStatus.values:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        if job.status in (AiderJobStatus.DONE, AiderJobStatus.FAILED) and job.finished_at is None:
            job.finished_at = timezone.now()
        job.save()
        return Response(runner_payload(job), status=status.HTTP_200_OK)
