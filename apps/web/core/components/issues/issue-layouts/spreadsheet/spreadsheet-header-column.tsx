/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
//types
import { observer } from "mobx-react";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { cn } from "@plane/utils";
//components
import { shouldRenderColumn } from "@/helpers/issue-filter.helper";
import { WithDisplayPropertiesHOC } from "../properties/with-display-properties-HOC";
import type { TSpreadsheetColumnDragData, TSpreadsheetColumnKey } from "./column-order";
import { SPREADSHEET_COLUMN_DRAG_TYPE, isSpreadsheetColumnDragData } from "./column-order";
import { HeaderColumn } from "./columns/header-column";

interface Props {
  displayProperties: IIssueDisplayProperties;
  property: keyof IIssueDisplayProperties;
  isEstimateEnabled: boolean;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayFilterUpdate: (data: Partial<IIssueDisplayFilterOptions>) => void;
  onColumnReorder?: (
    sourceProperty: TSpreadsheetColumnKey,
    destinationProperty: TSpreadsheetColumnKey,
    edge: Edge | null
  ) => void;
  isEpic?: boolean;
}
export const SpreadsheetHeaderColumn = observer(function SpreadsheetHeaderColumn(props: Props) {
  const {
    displayProperties,
    displayFilters,
    property,
    handleDisplayFilterUpdate,
    onColumnReorder,
    isEpic = false,
  } = props;

  //hooks
  const tableHeaderCellRef = useRef<HTMLTableCellElement | null>(null);
  // states
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const shouldRenderProperty = shouldRenderColumn(property);
  const isReorderable = !!onColumnReorder;

  useEffect(() => {
    const element = tableHeaderCellRef.current;
    if (!element || !isReorderable) return;

    const dragData: TSpreadsheetColumnDragData = { type: SPREADSHEET_COLUMN_DRAG_TYPE, property };

    return combine(
      draggable({
        element,
        getInitialData: () => dragData,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isSpreadsheetColumnDragData(source.data) && source.data.property !== property,
        getData: ({ input }) => attachClosestEdge(dragData, { input, element, allowedEdges: ["left", "right"] }),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ self, source }) => {
          setClosestEdge(null);
          if (!isSpreadsheetColumnDragData(source.data)) return;
          onColumnReorder(source.data.property, property, extractClosestEdge(self.data));
        },
      })
    );
  }, [property, isReorderable, onColumnReorder]);

  return (
    <WithDisplayPropertiesHOC
      displayProperties={displayProperties}
      displayPropertyKey={property}
      shouldRenderProperty={() => shouldRenderProperty}
    >
      <th
        className={cn(
          "relative h-11 min-w-36 items-center border border-t-0 border-b-0 border-subtle bg-layer-1 py-1 text-13 font-medium",
          {
            "cursor-grab": isReorderable,
            "opacity-50": isDragging,
          }
        )}
        ref={tableHeaderCellRef}
        tabIndex={0}
      >
        <HeaderColumn
          displayFilters={displayFilters}
          handleDisplayFilterUpdate={handleDisplayFilterUpdate}
          property={property}
          onClose={() => {
            tableHeaderCellRef?.current?.focus();
          }}
          isEpic={isEpic}
        />
        {closestEdge && (
          <span
            aria-hidden
            className={cn("pointer-events-none absolute inset-y-0 z-[1] w-0.5 bg-accent-primary", {
              "left-0": closestEdge === "left",
              "right-0": closestEdge === "right",
            })}
          />
        )}
      </th>
    </WithDisplayPropertiesHOC>
  );
});
