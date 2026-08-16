/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Loader } from "@plane/ui";
import { useRelease } from "@/hooks/store/use-release";

type Props = {
  workspaceSlug: string;
  releaseId: string;
  canEdit: boolean;
};

export const ReleaseScope = observer(function ReleaseScope(props: Props) {
  const { workspaceSlug, releaseId, canEdit } = props;
  const { fetchReleaseWorkItems, getWorkItemsForRelease, removeWorkItem } = useRelease();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { isLoading } = useSWR(
    workspaceSlug && releaseId ? `RELEASE_WORK_ITEMS_${workspaceSlug}_${releaseId}` : null,
    workspaceSlug && releaseId ? () => fetchReleaseWorkItems(workspaceSlug, releaseId) : null
  );

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
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-14 font-medium text-primary">Nothing in scope yet</p>
        <p className="max-w-md text-13 text-tertiary">
          Add work items to this release to track what is shipping in it. You can also let the release-notes tooling
          propose everything completed since your last release.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-4">
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
