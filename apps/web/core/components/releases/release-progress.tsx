/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IRelease, TReleaseStatus } from "@plane/types";
import { cn } from "@plane/utils";

type Props = {
  release: IRelease;
  showCounts?: boolean;
  className?: string;
};

/**
 * Fill colour for the completed segment, keyed off release status so a shipped
 * release reads differently from one still in flight at a glance. Accent (in
 * flight) vs success (shipped) vs muted (abandoned).
 */
const COMPLETED_FILL_CLASS: Record<TReleaseStatus, string> = {
  unreleased: "bg-accent-primary",
  released: "bg-success-primary",
  cancelled: "bg-layer-disabled",
};

/**
 * Progress for a release.
 *
 * Cancelled work counts toward the filled portion, in a muted colour. A release
 * whose remaining scope was all cancelled IS finished, and excluding cancelled
 * items would leave the bar permanently short of 100% with nothing the user
 * could do to clear it.
 */
export function ReleaseProgress(props: Props) {
  const { release, showCounts = true, className } = props;

  const total = release.total_work_items || 0;
  const completed = release.completed_work_items || 0;
  const cancelled = release.cancelled_work_items || 0;

  const completedPercent = total ? (completed / total) * 100 : 0;
  const cancelledPercent = total ? (cancelled / total) * 100 : 0;

  const completedFillClass = COMPLETED_FILL_CLASS[release.status] ?? COMPLETED_FILL_CLASS.unreleased;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Track is layer-3 rather than layer-2: layer-2 is pure white in the light theme. */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-layer-3">
        <div className={cn("h-full transition-all", completedFillClass)} style={{ width: `${completedPercent}%` }} />
        <div className="h-full bg-inverse/20 transition-all" style={{ width: `${cancelledPercent}%` }} />
      </div>
      {showCounts && (
        <div className="flex items-center gap-3 text-11 text-tertiary">
          <span>
            {completed} of {total} done
          </span>
          {cancelled > 0 && <span>{cancelled} cancelled</span>}
          {release.pending_work_items > 0 && <span>{release.pending_work_items} pending</span>}
        </div>
      )}
    </div>
  );
}
