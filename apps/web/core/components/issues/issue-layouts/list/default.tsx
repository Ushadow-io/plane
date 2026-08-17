/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { observer } from "mobx-react";
// plane constants
import { ALL_ISSUES } from "@plane/constants";
// types
import type {
  GroupByColumnTypes,
  TGroupedIssues,
  TIssue,
  IIssueDisplayProperties,
  TIssueMap,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  IGroupByColumn,
  TIssueKanbanFilters,
  TSubGroupedIssues,
} from "@plane/types";
// components
import { MultipleSelectGroup } from "@/components/core/multiple-select";
// hooks
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// plane web components
import { IssueBulkOperationsRoot } from "@/components/issues/bulk-operations";
// plane web hooks
import { useBulkOperationStatus } from "@/hooks/use-bulk-operation-status";
// utils
import type { GroupDropLocation } from "../utils";
import { getGroupByColumns, isWorkspaceLevel, isSubGrouped, getVisibleDisplayProperties } from "../utils";
import { ListGroup } from "./list-group";
import { ListSubGroupedGroup } from "./list-sub-grouped-group";
import type { TRenderQuickActions } from "./list-view-types";

export interface IList {
  groupedIssueIds: TGroupedIssues;
  issuesMap: TIssueMap;
  group_by: TIssueGroupByOptions | null;
  sub_group_by?: TIssueGroupByOptions | null;
  orderBy: TIssueOrderByOptions | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  enableIssueQuickAdd: boolean;
  showEmptyGroup?: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  disableIssueCreation?: boolean;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  isCompletedCycle?: boolean;
  // subGroupId is only supplied by the nested (sub-grouped) list path.
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  handleCollapsedGroups: (value: string, toggle?: "group_by" | "sub_group_by") => void;
  collapsedGroups: TIssueKanbanFilters;
  isEpic?: boolean;
}

export const List = observer(function List(props: IList) {
  const {
    groupedIssueIds,
    issuesMap,
    group_by,
    sub_group_by,
    orderBy,
    updateIssue,
    quickActions,
    displayProperties,
    enableIssueQuickAdd,
    showEmptyGroup,
    canEditProperties,
    quickAddCallback,
    disableIssueCreation,
    handleOnDrop,
    addIssuesToView,
    isCompletedCycle = false,
    loadMoreIssues,
    handleCollapsedGroups,
    collapsedGroups,
    isEpic = false,
  } = props;

  const storeType = useIssueStoreType();
  // plane web hooks
  const isBulkOperationsEnabled = useBulkOperationStatus();

  const containerRef = useRef<HTMLDivElement | null>(null);

  const groups = getGroupByColumns({
    groupBy: group_by as GroupByColumnTypes,
    includeNone: true,
    isWorkspaceLevel: isWorkspaceLevel(storeType),
    isEpic: isEpic,
  });

  // A grouped/sub-grouped column already shows its field's value in the header,
  // so hide that same field's column on every row inside it.
  const visibleDisplayProperties = getVisibleDisplayProperties(displayProperties, group_by, sub_group_by);

  // Inner-level columns, only built when the payload is actually nested.
  // `isSubGrouped` inspects the shape rather than trusting the prop, so a
  // sub_group_by that the server has not nested yet cannot break the render.
  const isNested = !!sub_group_by && isSubGrouped(groupedIssueIds);
  const subGroups = isNested
    ? getGroupByColumns({
        groupBy: sub_group_by as GroupByColumnTypes,
        includeNone: true,
        isWorkspaceLevel: isWorkspaceLevel(storeType),
        isEpic: isEpic,
      })
    : undefined;

  // Enable Auto Scroll for Main Kanban
  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    return combine(
      autoScrollForElements({
        element,
      })
    );
  }, [containerRef]);

  if (!groups) return null;

  const getGroupIndex = (groupId: string | undefined) => groups.findIndex(({ id }) => id === groupId);

  const is_list = group_by === null;

  // create groupIds array and entities object for bulk ops
  const groupIds = groups.map((g) => g.id);
  const orderedGroups: Record<string, string[]> = {};
  groupIds.forEach((gID) => {
    orderedGroups[gID] = [];
  });
  let entities: Record<string, string[]> = {};

  if (is_list) {
    entities = Object.assign(orderedGroups, { [groupIds[0]]: groupedIssueIds[ALL_ISSUES] ?? [] });
  } else if (!isSubGrouped(groupedIssueIds)) {
    entities = Object.assign(orderedGroups, { ...groupedIssueIds });
  } else {
    entities = orderedGroups;
  }
  return (
    <div className="relative flex size-full flex-col">
      {groups && (
        <MultipleSelectGroup
          containerRef={containerRef}
          entities={entities}
          disabled={!isBulkOperationsEnabled || isEpic}
        >
          {(helpers) => (
            <>
              <div
                ref={containerRef}
                className="vertical-scrollbar relative scrollbar-lg size-full overflow-auto bg-surface-1"
              >
                {isNested && subGroups
                  ? groups.map((group: IGroupByColumn) => (
                      <ListSubGroupedGroup
                        key={group.id}
                        group={group}
                        subGroups={subGroups}
                        subGroupedIssueIds={(groupedIssueIds as unknown as TSubGroupedIssues)?.[group.id] ?? {}}
                        issuesMap={issuesMap}
                        group_by={group_by}
                        sub_group_by={sub_group_by}
                        orderBy={orderBy}
                        updateIssue={updateIssue}
                        quickActions={quickActions}
                        getGroupIndex={getGroupIndex}
                        handleOnDrop={handleOnDrop}
                        displayProperties={visibleDisplayProperties}
                        enableIssueQuickAdd={enableIssueQuickAdd}
                        showEmptyGroup={showEmptyGroup}
                        canEditProperties={canEditProperties}
                        quickAddCallback={quickAddCallback}
                        disableIssueCreation={disableIssueCreation}
                        addIssuesToView={addIssuesToView}
                        isCompletedCycle={isCompletedCycle}
                        loadMoreIssues={loadMoreIssues}
                        containerRef={containerRef}
                        selectionHelpers={helpers}
                        handleCollapsedGroups={handleCollapsedGroups}
                        collapsedGroups={collapsedGroups}
                        isEpic={isEpic}
                      />
                    ))
                  : groups.map((group: IGroupByColumn) => (
                      <ListGroup
                        key={group.id}
                        groupIssueIds={groupedIssueIds?.[group.id] as string[] | undefined}
                        issuesMap={issuesMap}
                        group_by={group_by}
                        group={group}
                        updateIssue={updateIssue}
                        quickActions={quickActions}
                        orderBy={orderBy}
                        getGroupIndex={getGroupIndex}
                        handleOnDrop={handleOnDrop}
                        displayProperties={visibleDisplayProperties}
                        enableIssueQuickAdd={enableIssueQuickAdd}
                        showEmptyGroup={showEmptyGroup}
                        canEditProperties={canEditProperties}
                        quickAddCallback={quickAddCallback}
                        disableIssueCreation={disableIssueCreation}
                        addIssuesToView={addIssuesToView}
                        isCompletedCycle={isCompletedCycle}
                        loadMoreIssues={loadMoreIssues}
                        containerRef={containerRef}
                        selectionHelpers={helpers}
                        handleCollapsedGroups={handleCollapsedGroups}
                        collapsedGroups={collapsedGroups}
                        isEpic={isEpic}
                      />
                    ))}
              </div>

              <IssueBulkOperationsRoot selectionHelpers={helpers} />
            </>
          )}
        </MultipleSelectGroup>
      )}
    </div>
  );
});
