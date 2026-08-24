/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Check } from "lucide-react";
import { cn } from "../../utils/classname";
import type { TColorPickerOptions } from "../helper";

/**
 * The colour tab of the emoji picker. A grid of preset swatches plus a native
 * colour input for anything not in the presets.
 */
export function ColorRoot(props: TColorPickerOptions) {
  const { colors, value, onChange } = props;
  const selected = value?.toLowerCase();

  return (
    <div className="space-y-4 p-3.5">
      <div className="grid grid-cols-6 gap-2">
        {colors.map((color) => {
          const isSelected = selected === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              onClick={() => onChange(color)}
              className={cn(
                "grid size-7 place-items-center rounded-full border border-subtle transition-transform hover:scale-110",
                isSelected && "ring-offset-surface-1 ring-2 ring-accent-strong ring-offset-2"
              )}
              style={{ backgroundColor: color }}
            >
              {isSelected && <Check className="size-3.5 text-white" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-13 text-secondary">
        <input
          type="color"
          value={value ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded-full border border-subtle bg-transparent p-0"
        />
        <span>Custom colour</span>
      </label>
    </div>
  );
}
