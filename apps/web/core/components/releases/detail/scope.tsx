/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ISearchIssueResponse } from "@plane/types";
import { Loader } from "@plane/ui";
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
import { useRelease } from "@/hooks/store/use-release";

type Props = {
  workspaceSlug: string;
  releaseId: string;
  canEdit: boolean;
};

export const ReleaseScope = observer(function ReleaseScope(props: Props) {
  const { workspaceSlug, releaseId, canEdit } = props;
  const { fetchReleaseWorkItems, getWorkItemsForRelease, removeWorkItem, addWorkItems } = useRelease();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!workspaceSlug || !releaseId) return;
    let cancelled = false;
    setIsLoading(true);
    fetchReleaseWorkItems(workspaceSlug, releaseId).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, releaseId, fetchReleaseWorkItems]);

  const workItems = getWorkItemsForRelease(releaseId);

  const handleRemove = async (workItemId: string) => {
    setRemovingId(workItemId);
    try {
      await removeWorkItem(workspaceSlug, releaseId, workItemId);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Could not remove the work item." });
    } finally {
      setRemovingId(null);
    }
  };

  const handleAdd = async (data: ISearchIssueResponse[]) => {
    if (!data.length) return;
    try {
      const result = await addWorkItems(
        workspaceSlug,
        releaseId,
        data.map((item) => item.id)
      );
      // The server decides what actually landed: items in projects this user
      // cannot see are refused. Reporting only "added" would make a partial
      // result look like a complete one.
      if (result.skipped_no_access > 0) {
        setToast({
          type: TOAST_TYPE.WARNING,
          title: "Partially added",
          message: `${result.added} added. ${result.skipped_no_access} skipped — you do not have access to their project.`,
        });
      } else {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Added",
          message: `${result.added} work item${result.added === 1 ? "" : "s"} added to this release.`,
        });
      }
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Could not add the work items." });
    }
  };

  const picker = (
    <ExistingIssuesListModal
      workspaceSlug={workspaceSlug}
      isOpen={isPickerOpen}
      handleClose={() => setIsPickerOpen(false)}
      searchParams={{ target_date: undefined }}
      handleOnSubmit={handleAdd}
      selectedWorkItemIds={workItems.map((item) => item.id)}
      // Releases span projects, so the picker must be able to as well --
      // without this it would silently scope the search to one project and a
      // cross-project release would be impossible to assemble from here.
      workspaceLevelToggle
    />
  );

  if (isLoading) {
    return (
      <Loader className="flex flex-col gap-2 py-6">
        <Loader.Item height="40px" />
        <Loader.Item height="40px" />
        <Loader.Item height="40px" />
      </Loader>
    );
  }

  if (workItems.length === 0) {
    return (
      <>
        {picker}
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-14 font-medium text-primary">Nothing in scope yet</p>
          <p className="max-w-md text-13 text-tertiary">
            Add work items to this release to track what is shipping in it. You can also let the release-notes tooling
            propose everything completed since your last release.
          </p>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => setIsPickerOpen(true)}>
              Add work items
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col py-4">
      {picker}
      {canEdit && (
        <div className="flex justify-end pb-2">
          <Button variant="secondary" size="sm" onClick={() => setIsPickerOpen(true)}>
            Add work items
          </Button>
        </div>
      )}
      {/*
        Only work items in projects the viewer belongs to are returned by the
        API, so this list can legitimately be shorter than the release's
        progress counters suggest. That is intentional, not a bug.
      */}
      {workItems.map((workItem) => (
        <div
          key={workItem.id}
          className="group flex items-center justify-between gap-4 border-b border-subtle-1 px-1 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-mono shrink-0 text-11 text-tertiary">{workItem.sequence_id}</span>
            <span className="truncate text-13 text-primary">{workItem.name}</span>
          </div>
          {canEdit && (
            <Button
              variant="link"
              size="sm"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              loading={removingId === workItem.id}
              onClick={() => handleRemove(workItem.id)}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
    </div>
  );
});
