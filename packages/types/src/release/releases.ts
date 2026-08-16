/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TReleaseStatus = "unreleased" | "released" | "cancelled";

/**
 * A version tag -- the join point between a release and the source repository.
 * Separate from IRelease because a tag is shared: several releases can point at
 * the same version, and CI writes git_tag/commit_hash back after cutting a build.
 */
export interface IReleaseTag {
  id: string;
  workspace: string;
  version: string;
  description: string | null;
  commit_hash: string | null;
  git_tag: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface IRelease {
  id: string;
  workspace: string;
  name: string;
  status: TReleaseStatus;
  lead: string | null;
  tag: string | null;
  tag_detail: IReleaseTag | null;
  target_date: string | null;
  /**
   * The date this release actually shipped. Stamped once when the release first
   * enters the "released" status and never cleared afterwards -- unlike a work
   * item's completed_at, which resets whenever the item leaves the completed
   * group. A shipped release that is re-opened for a hotfix keeps this date.
   */
  release_date: string | null;
  is_latest: boolean;
  is_prerelease: boolean;
  description: string | null;
  description_html: string;
  description_json: object;
  external_source: string | null;
  external_id: string | null;
  // Server-annotated progress counters. Deliberately NOT permission-filtered:
  // every viewer sees the same totals even if they cannot enumerate every item.
  total_work_items: number;
  completed_work_items: number;
  cancelled_work_items: number;
  pending_work_items: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface IReleaseChangelog {
  id?: string;
  release?: string;
  description_html: string;
  description_json: object;
}

export type TReleaseScopeResult = {
  added: number;
  already_present: number;
  /**
   * Work items the caller asked to add but cannot see. Surfaced rather than
   * silently dropped so a permission problem does not look like success.
   */
  skipped_no_access: number;
};
