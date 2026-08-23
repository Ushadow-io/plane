/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ImageOff } from "lucide-react";
// plane helpers
import { PROJECT_SETTINGS_TRACKER_ELEMENTS } from "@plane/constants";
import { useOutsideClickDetector } from "@plane/hooks";
import type { ISvgIcons } from "@plane/propel/icons";
import { CloseIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import type { IIssueLabel } from "@plane/types";
// ui
import { CustomMenu, DragHandle } from "@plane/ui";
// helpers
import { cn } from "@plane/utils";
// components
import { LabelName } from "./label-name";

export interface ICustomMenuItem {
  CustomIcon: LucideIcon | React.FC<ISvgIcons>;
  onClick: (label: IIssueLabel) => void;
  isVisible: boolean;
  text: string;
  key: string;
}

interface ILabelItemBlock {
  label: IIssueLabel;
  isDragging: boolean;
  customMenuItems: ICustomMenuItem[];
  handleLabelDelete: (label: IIssueLabel) => void;
  isLabelGroup?: boolean;
  dragHandleRef: MutableRefObject<HTMLButtonElement | null>;
  disabled?: boolean;
  draggable?: boolean;
  onUpdate?: (data: Partial<IIssueLabel>) => Promise<IIssueLabel>;
}

export function LabelItemBlock(props: ILabelItemBlock) {
  const {
    label,
    isDragging,
    customMenuItems,
    handleLabelDelete,
    isLabelGroup,
    dragHandleRef,
    disabled = false,
    draggable = true,
    onUpdate,
  } = props;
  // states
  const [isMenuActive, setIsMenuActive] = useState(true);
  // refs
  const actionSectionRef = useRef<HTMLDivElement | null>(null);

  useOutsideClickDetector(actionSectionRef, () => setIsMenuActive(false));

  // Inline edits save straight away. The store reverts optimistically on failure, so
  // all that is left to do here is tell the user what went wrong.
  const handleUpdate = (data: Partial<IIssueLabel>) => {
    if (!onUpdate) return;
    onUpdate(data).catch((error) => {
      const nameTaken = Array.isArray(error?.name) && error.name.includes("LABEL_NAME_ALREADY_EXISTS");
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: nameTaken
          ? "A label with that name already exists in this project."
          : (error?.error ?? error?.detail ?? "Something went wrong. Please try again."),
      });
    });
  };

  const menuItems: ICustomMenuItem[] = [
    ...customMenuItems,
    {
      CustomIcon: ImageOff,
      onClick: () => handleUpdate({ logo_props: {} as IIssueLabel["logo_props"] }),
      isVisible: !!label.logo_props?.in_use && !!onUpdate,
      text: "Remove icon",
      key: "remove_icon",
    },
  ];

  return (
    <div className="group flex items-center">
      <div className="flex min-w-0 flex-1 items-center">
        {!disabled && draggable && (
          <DragHandle
            className={cn("opacity-0 group-hover:opacity-100", {
              "opacity-100": isDragging,
            })}
            ref={dragHandleRef}
          />
        )}
        <LabelName
          label={label}
          isGroup={isLabelGroup ?? false}
          disabled={disabled || !onUpdate}
          onUpdate={handleUpdate}
        />
      </div>

      {!disabled && (
        <div
          ref={actionSectionRef}
          className={`absolute right-2.5 flex items-center gap-2 px-4 ${
            isMenuActive || isLabelGroup
              ? "opacity-100"
              : "opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
          } ${isLabelGroup && "-top-0.5"}`}
        >
          <CustomMenu ellipsis menuButtonOnClick={() => setIsMenuActive(!isMenuActive)} useCaptureForOutsideClick>
            {menuItems.map(
              ({ isVisible, onClick, CustomIcon, text, key }) =>
                isVisible && (
                  <CustomMenu.MenuItem key={key} onClick={() => onClick(label)}>
                    <span className="flex items-center justify-start gap-2">
                      <CustomIcon className="size-4" />
                      <span>{text}</span>
                    </span>
                  </CustomMenu.MenuItem>
                )
            )}
          </CustomMenu>
          {!isLabelGroup && (
            <div className="py-0.5">
              <button
                className="flex size-5 items-center justify-center rounded-sm hover:bg-layer-1"
                onClick={() => {
                  handleLabelDelete(label);
                }}
                data-ph-element={PROJECT_SETTINGS_TRACKER_ELEMENTS.LABELS_DELETE_BUTTON}
              >
                <CloseIcon className="size-3.5 flex-shrink-0 text-tertiary" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
