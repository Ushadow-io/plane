/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
// plane imports
import type { IIssueDisplayProperties } from "@plane/types";

export type TSpreadsheetColumnKey = keyof IIssueDisplayProperties;

/** Key used to identify a spreadsheet header column in a pragmatic-dnd payload. */
export const SPREADSHEET_COLUMN_DRAG_TYPE = "SPREADSHEET_COLUMN";

export type TSpreadsheetColumnDragData = {
  type: typeof SPREADSHEET_COLUMN_DRAG_TYPE;
  property: TSpreadsheetColumnKey;
};

export const isSpreadsheetColumnDragData = (data: unknown): data is TSpreadsheetColumnDragData =>
  typeof data === "object" &&
  data !== null &&
  (data as TSpreadsheetColumnDragData).type === SPREADSHEET_COLUMN_DRAG_TYPE;

/**
 * Reconciles the user's persisted column order against the columns actually
 * available right now.
 *
 * The persisted order is untrusted: it is a plain array inside a JSON blob that
 * was written by a possibly older build of the app, and the available column
 * list changes with project settings (a project with cycles disabled has no
 * "cycle" column) and with Plane upgrades that introduce new columns.
 *
 * @param persistedOrder the user's saved order, possibly stale/partial/undefined
 * @param availableColumns the columns to render, in Plane's canonical default order
 * @returns every entry of `availableColumns` exactly once, in the order to render
 */
export const applyColumnOrder = (
  persistedOrder: TSpreadsheetColumnKey[] | undefined,
  availableColumns: TSpreadsheetColumnKey[]
): TSpreadsheetColumnKey[] => {
  if (!persistedOrder?.length) return availableColumns;

  const available = new Set(availableColumns);
  // Drop anything no longer available (e.g. "cycle" after cycles are disabled) and
  // any duplicate, both of which would desync the header row from the body rows.
  const ordered = persistedOrder.filter(
    (column, index) => available.has(column) && persistedOrder.indexOf(column) === index
  );
  const placed = new Set(ordered);

  // Slot every column the saved order does not know about next to the canonical
  // neighbour it sits behind by default, so a newly available column turns up where
  // the default layout puts it rather than stranded off-screen at the far right.
  availableColumns.forEach((column, canonicalIndex) => {
    if (placed.has(column)) return;
    const precedingSibling = availableColumns
      .slice(0, canonicalIndex)
      .reverse()
      .find((sibling) => placed.has(sibling));
    ordered.splice(precedingSibling ? ordered.indexOf(precedingSibling) + 1 : 0, 0, column);
    placed.add(column);
  });

  return ordered;
};

/**
 * Moves `sourceProperty` to sit immediately before or after `destinationProperty`.
 *
 * @param columns current left-to-right order
 * @param sourceProperty the column being dragged
 * @param destinationProperty the column it was dropped onto
 * @param edge which side of the destination it was dropped on
 * @returns a new array; the input is never mutated
 */
export const reorderColumn = (
  columns: TSpreadsheetColumnKey[],
  sourceProperty: TSpreadsheetColumnKey,
  destinationProperty: TSpreadsheetColumnKey,
  edge: Edge | null
): TSpreadsheetColumnKey[] => {
  if (sourceProperty === destinationProperty) return columns;

  const sourceIndex = columns.indexOf(sourceProperty);
  const destinationIndex = columns.indexOf(destinationProperty);
  if (sourceIndex === -1 || destinationIndex === -1) return columns;

  const withoutSource = columns.filter((column) => column !== sourceProperty);
  // Recompute against the shortened array so removing the source from the left
  // of the destination does not shift the insertion point.
  const anchorIndex = withoutSource.indexOf(destinationProperty);
  const insertAt = edge === "right" ? anchorIndex + 1 : anchorIndex;

  const reordered = [...withoutSource.slice(0, insertAt), sourceProperty, ...withoutSource.slice(insertAt)];

  // Dropping on the near edge of an adjacent column is a no-op. Return the same
  // reference so callers can skip persisting an identical order.
  return reordered.every((column, index) => column === columns[index]) ? columns : reordered;
};
