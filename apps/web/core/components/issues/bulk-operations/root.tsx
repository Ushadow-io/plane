/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Trash2, X } from "lucide-react";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TBulkOperationsPayload, TIssuePriorities } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";

type Props = {
  className?: string;
  selectionHelpers: TSelectionHelper;
};

export const IssueBulkOperationsRoot = observer(function IssueBulkOperationsRoot(props: Props) {
  const { className, selectionHelpers } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const storeType = useIssueStoreType();
  const { issues, issueMap } = useIssues(storeType);
  const { isSelectionActive, selectedEntityIds } = useMultipleSelectStore();
  // states
  const [isApplying, setIsApplying] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isSelectionActive || selectionHelpers.isSelectionDisabled || !workspaceSlug) return null;

  // State ids only make sense within one project, so bulk state changes are grouped and
  // applied per project. Priority is a fixed, project-agnostic enum, so it can always apply.
  const projectGroups = new Map<string, string[]>();
  selectedEntityIds.forEach((issueId) => {
    const projectId = issueMap?.[issueId]?.project_id;
    if (!projectId) return;
    projectGroups.set(projectId, [...(projectGroups.get(projectId) ?? []), issueId]);
  });
  const projectIds = Array.from(projectGroups.keys());
  const singleProjectId = projectIds.length === 1 ? projectIds[0] : undefined;

  const applyToSelection = async (properties: TBulkOperationsPayload["properties"]) => {
    if (projectGroups.size === 0) return;
    setIsApplying(true);
    try {
      await Promise.all(
        Array.from(projectGroups.entries()).map(([projectId, issueIds]) =>
          issues.bulkUpdateProperties(workspaceSlug, projectId, { issue_ids: issueIds, properties })
        )
      );
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Updated",
        message: `${selectedEntityIds.length} work item${selectedEntityIds.length === 1 ? "" : "s"} updated`,
      });
    } catch (_error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Could not update the selected work items",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleBulkDelete = async () => {
    if (projectGroups.size === 0) return;
    setIsDeleting(true);
    const deletedCount = selectedEntityIds.length;
    try {
      await Promise.all(
        Array.from(projectGroups.entries()).map(([projectId, issueIds]) =>
          issues.removeBulkIssues(workspaceSlug, projectId, issueIds)
        )
      );
      selectionHelpers.handleClearSelection();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Deleted",
        message: `${deletedCount} work item${deletedCount === 1 ? "" : "s"} deleted`,
      });
    } catch (_error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Could not delete the selected work items",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  return (
    <>
      <AlertModalCore
        isOpen={isDeleteConfirmOpen}
        handleClose={() => setIsDeleteConfirmOpen(false)}
        handleSubmit={handleBulkDelete}
        isSubmitting={isDeleting}
        title="Delete work items"
        content={
          <>
            {`Are you sure you want to delete `}
            <span className="font-medium break-words text-primary">
              {selectedEntityIds.length} work item{selectedEntityIds.length === 1 ? "" : "s"}
            </span>
            {`? All of the data related to ${selectedEntityIds.length === 1 ? "it" : "them"} will be permanently removed. This action cannot be undone.`}
          </>
        }
      />
      <div className={cn("sticky bottom-0 left-0 z-[2] grid place-items-center px-3.5 pb-3.5", className)}>
        <div className="flex h-12 items-center gap-3 rounded-md border-[0.5px] border-subtle bg-surface-1 px-3.5 shadow-raised-200">
          <span className="text-caption-sm-medium whitespace-nowrap text-secondary">
            {selectedEntityIds.length} selected
          </span>
          <div className="bg-subtle h-5 w-px" />
          <div className="h-7">
            <PriorityDropdown
              value={null}
              onChange={(priority: TIssuePriorities) => applyToSelection({ priority })}
              buttonVariant="border-with-text"
              disabled={isApplying}
            />
          </div>
          {singleProjectId && (
            <div className="h-7">
              <StateDropdown
                value={null}
                onChange={(stateId) => stateId && applyToSelection({ state_id: stateId })}
                projectId={singleProjectId}
                buttonVariant="border-with-text"
                disabled={isApplying}
              />
            </div>
          )}
          <div className="bg-subtle h-5 w-px" />
          <button
            type="button"
            onClick={() => setIsDeleteConfirmOpen(true)}
            disabled={isApplying}
            className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption-sm-regular text-danger-primary hover:bg-danger-subtle disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            type="button"
            onClick={selectionHelpers.handleClearSelection}
            disabled={isApplying}
            className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption-sm-regular text-secondary hover:bg-layer-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>
    </>
  );
});
