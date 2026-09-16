/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TAiderJobStatus = "queued" | "running" | "done" | "failed";

export type TAiderJob = {
  id: string;
  issue: string;
  project: string;
  instructions: string;
  status: TAiderJobStatus;
  branch: string;
  pr_url: string;
  error: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

/** Queue work items for the external aider-runner (tools/aider-runner). */
export class AiderService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async listJobs(workspaceSlug: string, projectId: string, issueId: string): Promise<TAiderJob[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/aider-jobs/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async delegate(workspaceSlug: string, projectId: string, issueId: string, instructions: string): Promise<TAiderJob> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/aider-jobs/`, {
      instructions,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
