/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { TwitterPicker } from "react-color";
import { Component, SmilePlus } from "lucide-react";
import { Popover, Transition } from "@headlessui/react";
// plane imports
import { LABEL_COLOR_OPTIONS } from "@plane/constants";
import type { TChangeHandlerProps } from "@plane/propel/emoji-icon-picker";
import { EmojiPicker, EmojiIconPickerTypes, Logo } from "@plane/propel/emoji-icon-picker";
import type { IIssueLabel } from "@plane/types";
import { cn } from "@plane/utils";

type TLabelLogoProps = {
  label: IIssueLabel;
  isGroup: boolean;
  disabled?: boolean;
  onUpdate: (data: Partial<IIssueLabel>) => void;
};

/**
 * The colour swatch and emoji/icon of a label row in project settings.
 *
 * Both are click-to-edit: clicking the swatch opens the colour picker, clicking the
 * emoji opens the emoji/icon picker. When no emoji is set the emoji slot is a faint
 * placeholder that only appears while the row is hovered.
 */
export function LabelLogo(props: TLabelLogoProps) {
  const { label, isGroup, disabled = false, onUpdate } = props;
  // states
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  // derived values
  const color = label.color && label.color !== "" ? label.color : "#000000";
  const hasLogo = !!label.logo_props?.in_use;

  const swatch = isGroup ? (
    <Component className="h-3.5 w-3.5" color={color} />
  ) : (
    <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
  );

  if (disabled)
    return (
      <span className="flex flex-shrink-0 items-center gap-1.5">
        {hasLogo ? <Logo logo={label.logo_props} size={16} type="lucide" /> : swatch}
      </span>
    );

  const handleLogoChange = (val: TChangeHandlerProps) => {
    const logoValue = val.type === EmojiIconPickerTypes.EMOJI ? { value: val.value } : val.value;
    onUpdate({
      logo_props: {
        in_use: val.type,
        [val.type]: logoValue,
      },
    });
    setIsEmojiPickerOpen(false);
  };

  return (
    <span className="flex flex-shrink-0 items-center gap-1.5">
      <EmojiPicker
        isOpen={isEmojiPickerOpen}
        handleToggle={(val: boolean) => setIsEmojiPickerOpen(val)}
        iconType="lucide"
        buttonClassName="flex items-center justify-center"
        label={
          <span
            className={cn(
              "grid size-5 place-items-center rounded-sm hover:bg-layer-1",
              !hasLogo && "text-placeholder opacity-0 transition-opacity group-hover:opacity-100"
            )}
            title={hasLogo ? "Change icon" : "Add an icon"}
          >
            {hasLogo ? <Logo logo={label.logo_props} size={16} type="lucide" /> : <SmilePlus className="size-3.5" />}
          </span>
        }
        onChange={handleLogoChange}
        defaultIconColor={label.logo_props?.in_use === "icon" ? label.logo_props?.icon?.color : undefined}
        defaultOpen={label.logo_props?.in_use === "icon" ? EmojiIconPickerTypes.ICON : EmojiIconPickerTypes.EMOJI}
      />

      <Popover className="relative flex items-center justify-center">
        {({ open, close }) => (
          <>
            <Popover.Button
              className={cn(
                "grid size-5 place-items-center rounded-sm hover:bg-layer-1 focus:outline-none",
                open && "bg-layer-1"
              )}
              title="Change colour"
            >
              {swatch}
            </Popover.Button>
            <Transition
              as={React.Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <Popover.Panel className="absolute top-full left-0 z-20 mt-2 w-screen max-w-xs px-2 sm:px-0">
                <TwitterPicker
                  colors={LABEL_COLOR_OPTIONS}
                  color={color}
                  onChange={(value) => {
                    onUpdate({ color: value.hex });
                    close();
                  }}
                />
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </span>
  );
}
