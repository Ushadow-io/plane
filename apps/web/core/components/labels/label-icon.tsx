/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Logo } from "@plane/propel/emoji-icon-picker";
import type { IIssueLabel } from "@plane/types";
import { cn } from "@plane/utils";

type TLabelIconProps = {
  label?: Pick<IIssueLabel, "color" | "logo_props"> | null;
  /** Size of the dot, in px. The emoji/icon is rendered slightly larger so both read the same. */
  size?: number;
  className?: string;
};

/**
 * Renders a label's emoji or icon when it has one, and falls back to the colour dot.
 */
export function LabelIcon({ label, size = 8, className }: TLabelIconProps) {
  if (label?.logo_props?.in_use) {
    return (
      <span className={cn("flex flex-shrink-0 items-center justify-center", className)}>
        <Logo logo={label.logo_props} size={size + 6} type="lucide" />
      </span>
    );
  }

  return (
    <span
      className={cn("flex-shrink-0 rounded-full", className)}
      style={{
        height: size,
        width: size,
        backgroundColor: label?.color && label.color !== "" ? label.color : "#000000",
      }}
    />
  );
}
