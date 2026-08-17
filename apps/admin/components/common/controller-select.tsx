/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
// plane internal packages
import { cn } from "@plane/utils";

export type TControllerSelectOption = {
  value: string;
  label: string;
};

type Props = {
  control: Control<any>;
  name: string;
  label: string;
  options: TControllerSelectOption[];
  description?: string | React.ReactNode;
  error: boolean;
  required: boolean;
};

/**
 * A single-choice counterpart to ControllerInput, for settings whose valid values
 * are a closed set the server already knows (provider keys, modes).
 *
 * A native <select> rather than propel's combobox: this renders a handful of
 * fixed options with no search, no async loading and no multi-select, and the
 * native control gets keyboard handling, mobile pickers and form semantics for
 * free. Styled to match `Input` so it sits in the same grid without looking
 * grafted on.
 */
export function ControllerSelect(props: Props) {
  const { control, name, label, options, description, error, required } = props;

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-13 text-tertiary">{label}</h4>
      <Controller
        control={control}
        name={name}
        rules={{ required: required ? `${label} is required.` : false }}
        render={({ field: { value, onChange, ref } }) => (
          <select
            id={name}
            name={name}
            ref={ref}
            value={value ?? ""}
            onChange={onChange}
            className={cn(
              "block w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 font-medium focus:outline-none",
              { "border-danger-strong": error }
            )}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      />
      {description && <p className="pt-0.5 text-11 text-tertiary">{description}</p>}
    </div>
  );
}
