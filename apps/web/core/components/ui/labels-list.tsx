/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { Tooltip } from "@plane/propel/tooltip";
import type { IIssueLabel } from "@plane/types";
// types
import { LabelIcon } from "@/components/labels/label-icon";
import { usePlatformOS } from "@/hooks/use-platform-os";
// hooks

type IssueLabelsListProps = {
  labels?: (IIssueLabel | undefined)[];
  length?: number;
  showLength?: boolean;
};

export function IssueLabelsList(props: IssueLabelsListProps) {
  const { labels, length = 3, showLength = true } = props;
  const { isMobile } = usePlatformOS();

  const visibleLabels = labels?.filter((l) => !!l) ?? [];
  if (visibleLabels.length === 0) return null;

  const shownLabels = visibleLabels.slice(0, length);
  const hiddenCount = visibleLabels.length - shownLabels.length;

  return (
    <Tooltip
      position="top"
      tooltipHeading="Labels"
      tooltipContent={visibleLabels.map((l) => l.name).join(", ")}
      isMobile={isMobile}
    >
      <div className="flex h-full items-center gap-1">
        {shownLabels.map((l) => (
          <div
            key={l.id}
            className="flex h-full max-w-[140px] items-center gap-1 rounded-sm border-[0.5px] border-strong px-2 py-1 text-11 text-secondary"
          >
            <LabelIcon label={l} size={8} />
            <span className="truncate">{l.name}</span>
          </div>
        ))}
        {showLength && hiddenCount > 0 && (
          <div className="flex h-full items-center rounded-sm border-[0.5px] border-strong px-2 py-1 text-11 text-secondary">
            {`+${hiddenCount}`}
          </div>
        )}
      </div>
    </Tooltip>
  );
}
