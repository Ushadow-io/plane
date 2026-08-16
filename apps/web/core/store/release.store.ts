/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// plane imports
import type { IRelease, IReleaseChangelog, IReleaseTag, TIssue, TReleaseScopeResult } from "@plane/types";
// services
import { ReleaseService } from "@/services/release.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IReleaseStore {
  // observables
  releaseMap: Record<string, IRelease>;
  releaseTagMap: Record<string, IReleaseTag>;
  releaseWorkItemsMap: Record<string, TIssue[]>;
  changelogMap: Record<string, IReleaseChangelog>;
  loader: boolean;
  // computed
  currentWorkspaceReleaseIds: string[] | null;
  // computed actions
  getReleaseById: (releaseId: string) => IRelease | null;
  getWorkItemsForRelease: (releaseId: string) => TIssue[];
  getProgressPercentage: (releaseId: string) => number;
  // fetch actions
  fetchReleases: (workspaceSlug: string) => Promise<IRelease[]>;
  fetchReleaseDetails: (workspaceSlug: string, releaseId: string) => Promise<IRelease>;
  fetchReleaseWorkItems: (workspaceSlug: string, releaseId: string) => Promise<TIssue[]>;
  fetchChangelog: (workspaceSlug: string, releaseId: string) => Promise<IReleaseChangelog>;
  fetchReleaseTags: (workspaceSlug: string) => Promise<IReleaseTag[]>;
  // crud actions
  createRelease: (workspaceSlug: string, data: Partial<IRelease>) => Promise<IRelease>;
  updateRelease: (workspaceSlug: string, releaseId: string, data: Partial<IRelease>) => Promise<IRelease>;
  deleteRelease: (workspaceSlug: string, releaseId: string) => Promise<void>;
  // scope actions
  addWorkItems: (workspaceSlug: string, releaseId: string, workItemIds: string[]) => Promise<TReleaseScopeResult>;
  removeWorkItem: (workspaceSlug: string, releaseId: string, workItemId: string) => Promise<void>;
  updateChangelog: (
    workspaceSlug: string,
    releaseId: string,
    data: Partial<IReleaseChangelog>
  ) => Promise<IReleaseChangelog>;
}

export class ReleaseStore implements IReleaseStore {
  // observables
  releaseMap: Record<string, IRelease> = {};
  releaseTagMap: Record<string, IReleaseTag> = {};
  releaseWorkItemsMap: Record<string, TIssue[]> = {};
  changelogMap: Record<string, IReleaseChangelog> = {};
  loader = false;
  // root store
  rootStore;
  // services
  releaseService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      releaseMap: observable,
      releaseTagMap: observable,
      releaseWorkItemsMap: observable,
      changelogMap: observable,
      loader: observable.ref,
      currentWorkspaceReleaseIds: computed,
      fetchReleases: action,
      fetchReleaseDetails: action,
      fetchReleaseWorkItems: action,
      fetchChangelog: action,
      fetchReleaseTags: action,
      createRelease: action,
      updateRelease: action,
      deleteRelease: action,
      addWorkItems: action,
      removeWorkItem: action,
      updateChangelog: action,
    });

    this.rootStore = _rootStore;
    this.releaseService = new ReleaseService();

    this.createRelease = this.createRelease.bind(this);
    this.updateRelease = this.updateRelease.bind(this);
  }

  /**
   * Releases for the current workspace, newest first.
   *
   * Ordered by created_at rather than release_date because most releases are
   * unreleased and therefore have no release_date -- sorting on it would bury
   * every release still being planned, which is exactly the set the list is for.
   */
  get currentWorkspaceReleaseIds() {
    const currentWorkspace = this.rootStore.workspaceRoot.currentWorkspace;
    if (!currentWorkspace) return null;

    return Object.values(this.releaseMap ?? {})
      .filter((release) => release.workspace === currentWorkspace.id)
      .toSorted((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((release) => release.id);
  }

  getReleaseById = computedFn((releaseId: string) => this.releaseMap?.[releaseId] ?? null);

  getWorkItemsForRelease = computedFn((releaseId: string) => this.releaseWorkItemsMap?.[releaseId] ?? []);

  /**
   * Completion as a percentage, counting cancelled work as resolved.
   *
   * Cancelled items are included in the numerator on purpose: a release whose
   * remaining scope was all cancelled is finished, and excluding them would
   * leave the bar permanently short of 100% with no way for a user to clear it.
   */
  getProgressPercentage = computedFn((releaseId: string) => {
    const release = this.releaseMap?.[releaseId];
    if (!release || !release.total_work_items) return 0;
    const resolved = release.completed_work_items + release.cancelled_work_items;
    return Math.round((resolved / release.total_work_items) * 100);
  });

  async fetchReleases(workspaceSlug: string) {
    try {
      runInAction(() => {
        this.loader = true;
      });
      const response = await this.releaseService.getReleases(workspaceSlug);
      runInAction(() => {
        response.forEach((release) => set(this.releaseMap, [release.id], release));
        this.loader = false;
      });
      return response;
    } catch (error) {
      runInAction(() => {
        this.loader = false;
      });
      throw error;
    }
  }

  async fetchReleaseDetails(workspaceSlug: string, releaseId: string) {
    const response = await this.releaseService.getReleaseDetails(workspaceSlug, releaseId);
    runInAction(() => set(this.releaseMap, [response.id], response));
    return response;
  }

  async fetchReleaseWorkItems(workspaceSlug: string, releaseId: string) {
    const response = await this.releaseService.getReleaseWorkItems(workspaceSlug, releaseId);
    runInAction(() => set(this.releaseWorkItemsMap, [releaseId], response));
    return response;
  }

  async fetchChangelog(workspaceSlug: string, releaseId: string) {
    const response = await this.releaseService.getChangelog(workspaceSlug, releaseId);
    runInAction(() => set(this.changelogMap, [releaseId], response));
    return response;
  }

  async fetchReleaseTags(workspaceSlug: string) {
    const response = await this.releaseService.getReleaseTags(workspaceSlug);
    runInAction(() => response.forEach((tag) => set(this.releaseTagMap, [tag.id], tag)));
    return response;
  }

  async createRelease(workspaceSlug: string, data: Partial<IRelease>) {
    const response = await this.releaseService.createRelease(workspaceSlug, data);
    runInAction(() => set(this.releaseMap, [response.id], response));
    return response;
  }

  async updateRelease(workspaceSlug: string, releaseId: string, data: Partial<IRelease>) {
    const original = this.releaseMap[releaseId];
    try {
      // Optimistic: release edits are single-field dropdown changes and the
      // round trip is visible on a list of them.
      runInAction(() => set(this.releaseMap, [releaseId], { ...original, ...data }));
      const response = await this.releaseService.updateRelease(workspaceSlug, releaseId, data);
      runInAction(() => set(this.releaseMap, [releaseId], response));
      return response;
    } catch (error) {
      runInAction(() => set(this.releaseMap, [releaseId], original));
      throw error;
    }
  }

  async deleteRelease(workspaceSlug: string, releaseId: string) {
    await this.releaseService.deleteRelease(workspaceSlug, releaseId);
    runInAction(() => {
      delete this.releaseMap[releaseId];
      delete this.releaseWorkItemsMap[releaseId];
      delete this.changelogMap[releaseId];
    });
  }

  async addWorkItems(workspaceSlug: string, releaseId: string, workItemIds: string[]) {
    const response = await this.releaseService.addWorkItemsToRelease(workspaceSlug, releaseId, workItemIds);
    // Re-read rather than patch locally: the server decides which items were
    // actually added (some may be inaccessible) and owns the progress counters.
    await Promise.all([
      this.fetchReleaseWorkItems(workspaceSlug, releaseId),
      this.fetchReleaseDetails(workspaceSlug, releaseId),
    ]);
    return response;
  }

  async removeWorkItem(workspaceSlug: string, releaseId: string, workItemId: string) {
    await this.releaseService.removeWorkItemFromRelease(workspaceSlug, releaseId, workItemId);
    runInAction(() =>
      set(
        this.releaseWorkItemsMap,
        [releaseId],
        (this.releaseWorkItemsMap[releaseId] ?? []).filter((item) => item.id !== workItemId)
      )
    );
    await this.fetchReleaseDetails(workspaceSlug, releaseId);
  }

  async updateChangelog(workspaceSlug: string, releaseId: string, data: Partial<IReleaseChangelog>) {
    const response = await this.releaseService.updateChangelog(workspaceSlug, releaseId, data);
    runInAction(() => set(this.changelogMap, [releaseId], response));
    return response;
  }
}
