/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IRelease } from "@plane/types";
import { cn } from "@plane/utils";

type Props = {
  release: IRelease;
  showCounts?: boolean;
  className?: string;
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

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-layer-2">
        <div className="bg-success h-full transition-all" style={{ width: `${completedPercent}%` }} />
        <div className="bg-tertiary/40 h-full transition-all" style={{ width: `${cancelledPercent}%` }} />
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
