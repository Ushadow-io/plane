/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  IRelease,
  IReleaseChangelog,
  IReleaseTag,
  ISearchIssueResponse,
  TIssue,
  TProjectIssuesSearchParams,
  TReleaseScopeResult,
} from "@plane/types";
import { APIService } from "@/services/api.service";

/**
 * Releases are workspace-scoped: a release groups work from several projects,
 * so there is deliberately no project-scoped variant of any of these calls.
 */
export class ReleaseService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getReleases(workspaceSlug: string): Promise<IRelease[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/releases/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getReleaseDetails(workspaceSlug: string, releaseId: string): Promise<IRelease> {
    return this.get(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createRelease(workspaceSlug: string, data: Partial<IRelease>): Promise<IRelease> {
    return this.post(`/api/workspaces/${workspaceSlug}/releases/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateRelease(workspaceSlug: string, releaseId: string, data: Partial<IRelease>): Promise<IRelease> {
    return this.patch(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteRelease(workspaceSlug: string, releaseId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getReleaseWorkItems(workspaceSlug: string, releaseId: string): Promise<TIssue[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/work-items/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async addWorkItemsToRelease(
    workspaceSlug: string,
    releaseId: string,
    workItemIds: string[]
  ): Promise<TReleaseScopeResult> {
    return this.post(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/work-items/`, {
      work_items: workItemIds,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async removeWorkItemFromRelease(workspaceSlug: string, releaseId: string, workItemId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/work-items/${workItemId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /** The same association from the work item's side — returns release ids. */
  async getReleasesForWorkItem(workspaceSlug: string, workItemId: string): Promise<string[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/work-items/${workItemId}/releases/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /** Sets the whole list, not a delta — the property is a multi-select. */
  async setReleasesForWorkItem(
    workspaceSlug: string,
    workItemId: string,
    releaseIds: string[]
  ): Promise<{ releases: string[]; added: number; removed: number }> {
    return this.post(`/api/workspaces/${workspaceSlug}/work-items/${workItemId}/releases/`, {
      releases: releaseIds,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getChangelog(workspaceSlug: string, releaseId: string): Promise<IReleaseChangelog> {
    return this.get(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/changelog/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateChangelog(
    workspaceSlug: string,
    releaseId: string,
    data: Partial<IReleaseChangelog>
  ): Promise<IReleaseChangelog> {
    return this.post(`/api/workspaces/${workspaceSlug}/releases/${releaseId}/changelog/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Work-item search across the whole workspace.
   *
   * The stock picker falls back to a project-scoped search service and simply
   * does nothing when no projectId is given -- it returns before searching, so
   * the box stays empty with no error. Releases span projects and therefore
   * pass no projectId, so they must supply this instead.
   */
  async searchWorkItems(workspaceSlug: string, params: TProjectIssuesSearchParams): Promise<ISearchIssueResponse[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/search-issues/`, { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getReleaseTags(workspaceSlug: string): Promise<IReleaseTag[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/release-tags/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createReleaseTag(workspaceSlug: string, data: Partial<IReleaseTag>): Promise<IReleaseTag> {
    return this.post(`/api/workspaces/${workspaceSlug}/release-tags/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
