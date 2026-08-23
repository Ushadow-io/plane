/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// components
import { Tooltip } from "@plane/propel/tooltip";
import { usePlatformOS } from "@/hooks/use-platform-os";
type Props = {
  labelDetails: any[];
  maxRender?: number;
};

export function ViewIssueLabel({ labelDetails, maxRender = 1 }: Props) {
  const { isMobile } = usePlatformOS();

  if (!labelDetails || labelDetails.length === 0) return null;

  const shownLabels = labelDetails.slice(0, maxRender);
  const hiddenCount = labelDetails.length - shownLabels.length;

  return (
    <>
      {shownLabels.map((label) => (
        <div
          key={label.id}
          className="shadow-sm flex max-w-[140px] flex-shrink-0 cursor-default items-center rounded-md border border-strong px-2.5 py-1 text-11"
        >
          <Tooltip position="top" tooltipHeading="Label" tooltipContent={label.name} isMobile={isMobile}>
            <div className="flex items-center gap-1.5 text-secondary">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: label?.color ?? "#000000",
                }}
              />
              <span className="truncate">{label.name}</span>
            </div>
          </Tooltip>
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="shadow-sm flex flex-shrink-0 cursor-default items-center rounded-md border border-strong px-2.5 py-1 text-11">
          <Tooltip
            position="top"
            tooltipHeading="Labels"
            tooltipContent={labelDetails.map((l) => l.name).join(", ")}
            isMobile={isMobile}
          >
            <div className="flex items-center gap-1.5 text-secondary">{`+${hiddenCount}`}</div>
          </Tooltip>
        </div>
      )}
    </>
  );
}
