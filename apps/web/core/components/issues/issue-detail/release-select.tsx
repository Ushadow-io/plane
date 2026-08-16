/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useState } from "react";
import useSWR from "swr";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn } from "@plane/utils";
import { useRelease } from "@/hooks/store/use-release";

type Props = {
  workspaceSlug: string;
  issueId: string;
  disabled?: boolean;
  className?: string;
};

/**
 * The Releases property on a work item.
 *
 * Multi-select, because a work item legitimately ships in more than one release
 * -- a fix that goes out in both v1.4.1 and v1.5.0 belongs to both. Modelling it
 * as a single value would force a choice that has no correct answer.
 *
 * Releases are workspace-scoped, so this deliberately does NOT take a projectId:
 * every release in the workspace is selectable regardless of which project the
 * work item lives in.
 */
export const IssueReleaseSelect = observer(function IssueReleaseSelect(props: Props) {
  const { workspaceSlug, issueId, disabled = false, className } = props;
  const {
    fetchReleases,
    fetchReleasesForWorkItem,
    setReleasesForWorkItem,
    getReleaseIdsForWorkItem,
    getReleaseById,
    currentWorkspaceReleaseIds,
  } = useRelease();
  const [isOpen, setIsOpen] = useState(false);

  useSWR(
    workspaceSlug ? `WORKSPACE_RELEASES_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchReleases(workspaceSlug) : null
  );
  useSWR(
    workspaceSlug && issueId ? `WORK_ITEM_RELEASES_${workspaceSlug}_${issueId}` : null,
    workspaceSlug && issueId ? () => fetchReleasesForWorkItem(workspaceSlug, issueId) : null
  );

  const selectedIds = getReleaseIdsForWorkItem(issueId);
  const availableIds = currentWorkspaceReleaseIds ?? [];

  const toggle = async (releaseId: string) => {
    const next = selectedIds.includes(releaseId)
      ? selectedIds.filter((id) => id !== releaseId)
      : [...selectedIds, releaseId];
    try {
      await setReleasesForWorkItem(workspaceSlug, issueId, next);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Could not update releases." });
    }
  };

  const label =
    selectedIds.length === 0
      ? "None"
      : selectedIds
          .map((id) => getReleaseById(id)?.name)
          .filter(Boolean)
          .join(", ");

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex w-full items-center justify-between rounded px-2 py-1 text-left text-13",
          selectedIds.length === 0 ? "text-placeholder" : "text-primary",
          disabled ? "cursor-not-allowed" : "hover:bg-layer-1"
        )}
      >
        <span className="truncate">{label}</span>
      </button>

      {isOpen && !disabled && (
        <>
          {/* Click-away layer: the dropdown lives inside a scrollable sidebar,
              so a document-level listener would fight the panel's own handlers. */}
          <button
            type="button"
            aria-label="Close releases dropdown"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="shadow-lg absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-subtle-1 bg-layer-2 p-1">
            {availableIds.length === 0 ? (
              <p className="px-2 py-1.5 text-12 text-tertiary">No releases in this workspace yet.</p>
            ) : (
              availableIds.map((releaseId) => {
                const release = getReleaseById(releaseId);
                if (!release) return null;
                const checked = selectedIds.includes(releaseId);
                return (
                  <button
                    key={releaseId}
                    type="button"
                    onClick={() => toggle(releaseId)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-13 hover:bg-layer-1"
                  >
                    <input type="checkbox" checked={checked} readOnly className="pointer-events-none" />
                    <span className="truncate text-primary">{release.name}</span>
                    {release.is_latest && <span className="text-11 text-tertiary">latest</span>}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
});
