/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Component } from "lucide-react";
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
 * The swatch of a label row in project settings.
 *
 * It is one click-to-edit control: clicking it opens a single picker with an
 * Emoji, an Icon and a Color tab, so the icon and the colour are edited in the
 * same place. The button shows the emoji when the label has one, and the colour
 * dot otherwise.
 */
export function LabelLogo(props: TLabelLogoProps) {
  const { label, isGroup, disabled = false, onUpdate } = props;
  // states
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // derived values
  const color = label.color && label.color !== "" ? label.color : "#000000";
  const hasLogo = !!label.logo_props?.in_use;

  const swatch = hasLogo ? (
    <Logo logo={label.logo_props} size={16} type="lucide" />
  ) : isGroup ? (
    <Component className="h-3.5 w-3.5" color={color} />
  ) : (
    <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
  );

  if (disabled) return <span className="flex flex-shrink-0 items-center">{swatch}</span>;

  const handleLogoChange = (val: TChangeHandlerProps) => {
    const logoValue = val.type === EmojiIconPickerTypes.EMOJI ? { value: val.value } : val.value;
    onUpdate({
      logo_props: {
        in_use: val.type,
        [val.type]: logoValue,
      },
    });
    setIsPickerOpen(false);
  };

  return (
    <EmojiPicker
      isOpen={isPickerOpen}
      handleToggle={(val: boolean) => setIsPickerOpen(val)}
      iconType="lucide"
      buttonClassName="flex items-center justify-center"
      label={
        <span
          className={cn("grid size-6 place-items-center rounded-sm hover:bg-layer-1", isPickerOpen && "bg-layer-1")}
          title="Change icon or colour"
        >
          {swatch}
        </span>
      }
      onChange={handleLogoChange}
      colorPicker={{
        colors: LABEL_COLOR_OPTIONS,
        value: color,
        onChange: (hex) => {
          onUpdate({ color: hex });
          setIsPickerOpen(false);
        },
      }}
      defaultIconColor={label.logo_props?.in_use === "icon" ? label.logo_props?.icon?.color : undefined}
      defaultOpen={
        label.logo_props?.in_use === "emoji"
          ? EmojiIconPickerTypes.EMOJI
          : label.logo_props?.in_use === "icon"
            ? EmojiIconPickerTypes.ICON
            : EmojiIconPickerTypes.COLOR
      }
    />
  );
}
