/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useMemo, useRef } from "react";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { observer } from "mobx-react";
// plane constants
import { SPREADSHEET_SELECT_GROUP, SPREADSHEET_PROPERTY_LIST } from "@plane/constants";
// types
import type { TIssue, IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
// components
import { MultipleSelectGroup } from "@/components/core/multiple-select";
import { IssueBulkOperationsRoot } from "@/components/issues/bulk-operations";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useBulkOperationStatus } from "@/hooks/use-bulk-operation-status";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import { QuickAddIssueRoot, SpreadsheetAddIssueButton } from "../quick-add";
import type { TSpreadsheetColumnKey } from "./column-order";
import { applyColumnOrder, reorderColumn } from "./column-order";
import { SpreadsheetTable } from "./spreadsheet-table";

type Props = {
  displayProperties: IIssueDisplayProperties;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayFilterUpdate: (data: Partial<IIssueDisplayFilterOptions>) => void;
  issueIds: string[] | undefined;
  quickActions: TRenderQuickActions;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  openIssuesListModal?: (() => void) | null;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  canEditProperties: (projectId: string | undefined) => boolean;
  canLoadMoreIssues: boolean;
  loadMoreIssues: () => void;
  enableQuickCreateIssue?: boolean;
  disableIssueCreation?: boolean;
  isWorkspaceLevel?: boolean;
  isEpic?: boolean;
};

export const SpreadsheetView = observer(function SpreadsheetView(props: Props) {
  const {
    displayProperties,
    displayFilters,
    handleDisplayFilterUpdate,
    issueIds,
    quickActions,
    updateIssue,
    quickAddCallback,
    canEditProperties,
    enableQuickCreateIssue,
    disableIssueCreation,
    canLoadMoreIssues,
    loadMoreIssues,
    isWorkspaceLevel = false,
    isEpic = false,
  } = props;
  // refs
  const containerRef = useRef<HTMLTableElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  // store hooks
  const { currentProjectDetails } = useProject();
  // plane web hooks
  const isBulkOperationsEnabled = useBulkOperationStatus();

  const isEstimateEnabled: boolean = currentProjectDetails?.estimate !== null;

  const availableColumnsList = useMemo(
    () =>
      isWorkspaceLevel
        ? SPREADSHEET_PROPERTY_LIST
        : SPREADSHEET_PROPERTY_LIST.filter((property) => {
            if (property === "cycle" && !currentProjectDetails?.cycle_view) return false;
            if (property === "modules" && !currentProjectDetails?.module_view) return false;
            return true;
          }),
    [isWorkspaceLevel, currentProjectDetails?.cycle_view, currentProjectDetails?.module_view]
  );

  const spreadsheetColumnsList = useMemo(
    () => applyColumnOrder(displayFilters.column_order, availableColumnsList),
    [displayFilters.column_order, availableColumnsList]
  );

  const handleColumnReorder = useCallback(
    (sourceProperty: TSpreadsheetColumnKey, destinationProperty: TSpreadsheetColumnKey, edge: Edge | null) => {
      const reordered = reorderColumn(spreadsheetColumnsList, sourceProperty, destinationProperty, edge);
      if (reordered === spreadsheetColumnsList) return;
      handleDisplayFilterUpdate({ column_order: reordered });
    },
    [spreadsheetColumnsList, handleDisplayFilterUpdate]
  );

  if (!issueIds || issueIds.length === 0) return <></>;
  return (
    <div className="relative flex h-full w-full flex-col overflow-x-hidden bg-layer-1 whitespace-nowrap text-secondary">
      <div ref={portalRef} className="spreadsheet-menu-portal" />
      <MultipleSelectGroup
        containerRef={containerRef}
        entities={{
          [SPREADSHEET_SELECT_GROUP]: issueIds,
        }}
        disabled={!isBulkOperationsEnabled || isEpic}
      >
        {(helpers) => (
          <>
            <div ref={containerRef} className="vertical-scrollbar horizontal-scrollbar scrollbar-lg h-full w-full">
              <SpreadsheetTable
                displayProperties={displayProperties}
                displayFilters={displayFilters}
                handleDisplayFilterUpdate={handleDisplayFilterUpdate}
                issueIds={issueIds}
                isEstimateEnabled={isEstimateEnabled}
                portalElement={portalRef}
                quickActions={quickActions}
                updateIssue={updateIssue}
                canEditProperties={canEditProperties}
                containerRef={containerRef}
                canLoadMoreIssues={canLoadMoreIssues}
                loadMoreIssues={loadMoreIssues}
                spreadsheetColumnsList={spreadsheetColumnsList}
                onColumnReorder={handleColumnReorder}
                selectionHelpers={helpers}
                isEpic={isEpic}
              />
            </div>
            <div className="border-t border-subtle">
              <div className="sticky bottom-0 left-0 z-5">
                {enableQuickCreateIssue && !disableIssueCreation && (
                  <QuickAddIssueRoot
                    layout={EIssueLayoutTypes.SPREADSHEET}
                    QuickAddButton={SpreadsheetAddIssueButton}
                    quickAddCallback={quickAddCallback}
                    isEpic={isEpic}
                  />
                )}
              </div>
            </div>
            <IssueBulkOperationsRoot selectionHelpers={helpers} />
          </>
        )}
      </MultipleSelectGroup>
    </div>
  );
});
