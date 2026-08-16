/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TReleaseStatus } from "@plane/types";
import { cn } from "@plane/utils";

export const RELEASE_STATUS_DETAILS: Record<TReleaseStatus, { label: string; className: string }> = {
  unreleased: { label: "Unreleased", className: "bg-layer-2 text-secondary" },
  released: { label: "Released", className: "bg-success/10 text-success" },
  cancelled: { label: "Cancelled", className: "bg-layer-2 text-tertiary" },
};

export const RELEASE_STATUS_OPTIONS: TReleaseStatus[] = ["unreleased", "released", "cancelled"];

type Props = {
  status: TReleaseStatus;
  className?: string;
};

export function ReleaseStatusBadge(props: Props) {
  const { status, className } = props;
  const details = RELEASE_STATUS_DETAILS[status] ?? RELEASE_STATUS_DETAILS.unreleased;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-2 py-0.5 text-11 font-medium",
        details.className,
        className
      )}
    >
      {details.label}
    </span>
  );
}
