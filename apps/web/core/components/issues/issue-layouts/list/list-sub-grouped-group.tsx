/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { observer } from "mobx-react";
import { ChevronRight } from "lucide-react";
// plane imports
import { cn } from "@plane/utils";
import { Row } from "@plane/ui";
import type {
  IGroupByColumn,
  IIssueDisplayProperties,
  TIssue,
  TIssueGroupByOptions,
  TIssueKanbanFilters,
  TIssueMap,
  TIssueOrderByOptions,
} from "@plane/types";
// hooks
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
// local imports
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import type { GroupDropLocation } from "../utils";
import { ListGroup } from "./list-group";
import type { TRenderQuickActions } from "./list-view-types";

/**
 * One OUTER group of a sub-grouped list: its own collapsible header, then a
 * nested ListGroup per sub-group.
 *
 * Kanban expresses the same two levels as swimlanes (kanban/swimlanes.tsx);
 * the list expresses them as nested collapsible sections, which is the shape
 * Linear uses.
 *
 * Drag-and-drop is intentionally absent here -- a drop between nested rows
 * would have to update both the group and the sub-group field, and the drop
 * payload carries only one groupId. ListGroup declines to register a drop
 * target when it is given a parentGroupId.
 */

interface Props {
  group: IGroupByColumn;
  subGroups: IGroupByColumn[];
  subGroupedIssueIds: Record<string, string[]>;
  issuesMap: TIssueMap;
  group_by: TIssueGroupByOptions | null;
  sub_group_by: TIssueGroupByOptions | null | undefined;
  orderBy: TIssueOrderByOptions | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  getGroupIndex: (groupId: string | undefined) => number;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  displayProperties: IIssueDisplayProperties | undefined;
  enableIssueQuickAdd: boolean;
  showEmptyGroup?: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  disableIssueCreation?: boolean;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  isCompletedCycle?: boolean;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  selectionHelpers: TSelectionHelper;
  handleCollapsedGroups: (value: string, toggle?: "group_by" | "sub_group_by") => void;
  collapsedGroups: TIssueKanbanFilters;
  isEpic?: boolean;
}

export const ListSubGroupedGroup = observer(function ListSubGroupedGroup(props: Props) {
  const {
    group,
    subGroups,
    subGroupedIssueIds,
    showEmptyGroup,
    collapsedGroups,
    handleCollapsedGroups,
    sub_group_by,
    group_by: _outerGroupBy,
    ...rest
  } = props;

  const {
    issues: { getGroupIssueCount },
  } = useIssuesStore();

  const isExpanded = !collapsedGroups?.group_by.includes(group.id);

  // Cumulative count across every sub-group of this outer group. The third
  // argument is what makes it cumulative -- without it a sub-grouped outer
  // group reports 0.
  const groupIssueCount = getGroupIssueCount(group.id, undefined, true) ?? 0;

  if (!showEmptyGroup && groupIssueCount === 0) return null;

  return (
    <div className={cn("flex flex-shrink-0 flex-col")}>
      {/* Outer group header. Deliberately simpler than HeaderGroupByCard: no
          quick-add or bulk-select, because both would need to mean "across all
          sub-groups", which the selection helpers do not model. */}
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events jsx_a11y/no-static-element-interactions */}
      <Row
        className="sticky top-0 z-[3] w-full flex-shrink-0 cursor-pointer border-b border-subtle bg-layer-1 py-1.5 pr-3 hover:bg-layer-1-hover"
        onClick={() => handleCollapsedGroups(group.id, "group_by")}
      >
        {/* Outer level: deliberately a size ABOVE the sub-group header, which
            renders its title at text-13 via HeaderGroupByCard's `compact`. */}
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn("size-4 flex-shrink-0 text-secondary transition-transform", {
              "rotate-90": isExpanded,
            })}
          />
          {group.icon}
          <span className="text-14 font-semibold text-primary">{group.name}</span>
          <span className="text-13 font-medium text-secondary">{groupIssueCount}</span>
        </div>
      </Row>

      {isExpanded &&
        subGroups.map((subGroup: IGroupByColumn) => (
          <ListGroup
            key={`${group.id}-${subGroup.id}`}
            // parentGroupId is what re-keys counts, pagination and collapse
            // state to (group, subGroup) inside ListGroup.
            parentGroupId={group.id}
            group={subGroup}
            group_by={sub_group_by ?? null}
            groupIssueIds={subGroupedIssueIds?.[subGroup.id]}
            showEmptyGroup={showEmptyGroup}
            collapsedGroups={collapsedGroups}
            handleCollapsedGroups={handleCollapsedGroups}
            {...rest}
          />
        ))}
    </div>
  );
});
