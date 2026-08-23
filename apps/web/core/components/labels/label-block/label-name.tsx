/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
// plane imports
import type { IIssueLabel } from "@plane/types";
// local imports
import { LabelLogo } from "./label-logo";

interface ILabelName {
  label: IIssueLabel;
  isGroup: boolean;
  disabled?: boolean;
  onUpdate: (data: Partial<IIssueLabel>) => void;
}

/**
 * The colour/icon swatch and the name of a label row in project settings.
 * The name is click-to-edit: Enter or blur saves, Escape cancels.
 */
export function LabelName(props: ILabelName) {
  const { label, isGroup, disabled = false, onUpdate } = props;
  // states
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(label.name);
  // refs
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingName) setDraftName(label.name);
  }, [label.name, isEditingName]);

  useEffect(() => {
    if (isEditingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingName]);

  const commitName = () => {
    if (!isEditingName) return;
    setIsEditingName(false);
    const name = draftName.trim();
    if (!name || name === label.name) {
      setDraftName(label.name);
      return;
    }
    onUpdate({ name });
  };

  const cancelName = () => {
    setDraftName(label.name);
    setIsEditingName(false);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 pr-20">
      <LabelLogo label={label} isGroup={isGroup} disabled={disabled} onUpdate={onUpdate} />
      {isEditingName ? (
        <input
          ref={inputRef}
          type="text"
          value={draftName}
          maxLength={255}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitName();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelName();
            }
          }}
          className="w-full max-w-sm rounded-sm border-[0.5px] border-strong bg-surface-1 px-2 py-0.5 text-13 text-primary focus:outline-none"
        />
      ) : disabled ? (
        <h6 className="truncate text-13">{label.name}</h6>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditingName(true)}
          title="Rename label"
          className="max-w-full truncate rounded-sm px-2 py-0.5 text-left text-13 hover:bg-layer-1"
        >
          {label.name}
        </button>
      )}
    </div>
  );
}
