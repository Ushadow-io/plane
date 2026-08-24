// oxlint-disable no-shadow
// oxlint-disable jsx_a11y/no-autofocus
// oxlint-disable promise/always-return
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { forwardRef, useEffect, useState } from "react";
import { observer } from "mobx-react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { getRandomLabelColor, LABEL_COLOR_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { TChangeHandlerProps } from "@plane/propel/emoji-icon-picker";
import { EmojiPicker, EmojiIconPickerTypes, Logo } from "@plane/propel/emoji-icon-picker";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IIssueLabel } from "@plane/types";
import { Input } from "@plane/ui";

// error codes
const errorCodes = {
  LABEL_NAME_ALREADY_EXISTS: "LABEL_NAME_ALREADY_EXISTS",
};

export type TLabelOperationsCallbacks = {
  createLabel: (data: Partial<IIssueLabel>) => Promise<IIssueLabel>;
  updateLabel: (labelId: string, data: Partial<IIssueLabel>) => Promise<IIssueLabel>;
};

type TCreateUpdateLabelInlineProps = {
  labelForm: boolean;
  setLabelForm: React.Dispatch<React.SetStateAction<boolean>>;
  isUpdating: boolean;
  labelOperationsCallbacks: TLabelOperationsCallbacks;
  labelToUpdate?: IIssueLabel;
  onClose?: () => void;
};

const defaultValues: Partial<IIssueLabel> = {
  name: "",
  color: "var(--text-color-secondary)",
};

export const CreateUpdateLabelInline = observer(
  forwardRef(function CreateUpdateLabelInline(
    props: TCreateUpdateLabelInlineProps,
    ref: React.ForwardedRef<HTMLDivElement>
  ) {
    const { labelForm, setLabelForm, isUpdating, labelOperationsCallbacks, labelToUpdate, onClose } = props;
    // states
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    // form info
    const {
      handleSubmit,
      control,
      reset,
      formState: { errors, isSubmitting },
      watch,
      setValue,
      setFocus,
    } = useForm<IIssueLabel>({
      defaultValues,
    });

    const { t } = useTranslation();
    // derived values
    const logoValue = watch("logo_props");
    const colorValue = watch("color");

    const handleClose = () => {
      setLabelForm(false);
      reset(defaultValues);
      if (onClose) onClose();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getErrorMessage = (error: any, operation: "create" | "update"): string => {
      const errorData = error ?? {};

      const labelError = errorData.name?.includes(errorCodes.LABEL_NAME_ALREADY_EXISTS);
      if (labelError) {
        return t("label.create.already_exists");
      }

      // Fallback to general error messages
      if (operation === "create") {
        return errorData?.detail ?? errorData?.error ?? t("common.something_went_wrong");
      }

      return errorData?.error ?? t("project_settings.labels.toast.error");
    };

    const handleLabelCreate: SubmitHandler<IIssueLabel> = async (formData) => {
      if (isSubmitting) return;

      await labelOperationsCallbacks
        .createLabel(formData)
        .then((_res) => {
          handleClose();
          reset(defaultValues);
        })
        .catch((error) => {
          const errorMessage = getErrorMessage(error, "create");
          setToast({
            title: "Error!",
            type: TOAST_TYPE.ERROR,
            message: errorMessage,
          });
          reset(formData);
        });
    };

    const handleLabelUpdate: SubmitHandler<IIssueLabel> = async (formData) => {
      if (!labelToUpdate?.id || isSubmitting) return;

      await labelOperationsCallbacks
        .updateLabel(labelToUpdate.id, formData)
        .then((_res) => {
          reset(defaultValues);
          handleClose();
        })
        .catch((error) => {
          const errorMessage = getErrorMessage(error, "update");
          setToast({
            title: "Oops!",
            type: TOAST_TYPE.ERROR,
            message: errorMessage,
          });
          reset(formData);
        });
    };

    const handleFormSubmit = (formData: IIssueLabel) => {
      if (isUpdating) {
        handleLabelUpdate(formData);
      } else {
        handleLabelCreate(formData);
      }
    };

    /**
     * For settings focus on name input
     */
    useEffect(() => {
      setFocus("name");
    }, [setFocus, labelForm]);

    useEffect(() => {
      if (!labelToUpdate) return;

      setValue("name", labelToUpdate.name);
      setValue("color", labelToUpdate.color && labelToUpdate.color !== "" ? labelToUpdate.color : "#000");
      setValue("logo_props", labelToUpdate.logo_props);
    }, [labelToUpdate, setValue]);

    useEffect(() => {
      if (labelToUpdate) {
        setValue("color", labelToUpdate.color && labelToUpdate.color !== "" ? labelToUpdate.color : "#000");
        return;
      }

      setValue("color", getRandomLabelColor());
    }, [labelToUpdate, setValue]);

    return (
      <>
        <div
          ref={ref}
          className={`flex w-full scroll-m-8 items-center gap-2 bg-surface-1 ${labelForm ? "" : "hidden"}`}
        >
          <div className="flex-shrink-0">
            <EmojiPicker
              isOpen={isEmojiPickerOpen}
              handleToggle={(val: boolean) => setIsEmojiPickerOpen(val)}
              iconType="lucide"
              buttonClassName="flex items-center justify-center"
              label={
                <span
                  className="grid size-6 place-items-center rounded-sm hover:bg-layer-1"
                  title="Pick an icon or a colour"
                >
                  {logoValue?.in_use ? (
                    <Logo logo={logoValue} size={16} type="lucide" />
                  ) : (
                    <span className="size-4 rounded-full" style={{ backgroundColor: colorValue }} />
                  )}
                </span>
              }
              onChange={(val: TChangeHandlerProps) => {
                const logo = val.type === EmojiIconPickerTypes.EMOJI ? { value: val.value } : val.value;
                setValue("logo_props", { in_use: val.type, [val.type]: logo });
                setIsEmojiPickerOpen(false);
              }}
              colorPicker={{
                colors: LABEL_COLOR_OPTIONS,
                value: colorValue,
                onChange: (hex) => {
                  setValue("color", hex);
                  setIsEmojiPickerOpen(false);
                },
              }}
              defaultIconColor={logoValue?.in_use === "icon" ? logoValue?.icon?.color : undefined}
              defaultOpen={
                logoValue?.in_use === "emoji"
                  ? EmojiIconPickerTypes.EMOJI
                  : logoValue?.in_use === "icon"
                    ? EmojiIconPickerTypes.ICON
                    : EmojiIconPickerTypes.COLOR
              }
            />
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <Controller
              control={control}
              name="name"
              rules={{
                required: t("project_settings.labels.label_title_is_required"),
                maxLength: {
                  value: 255,
                  message: t("project_settings.labels.label_max_char"),
                },
              }}
              render={({ field: { value, onChange, ref } }) => (
                <Input
                  id="labelName"
                  name="name"
                  type="text"
                  autoFocus
                  value={value}
                  onChange={onChange}
                  ref={ref}
                  hasError={Boolean(errors.name)}
                  placeholder={t("project_settings.labels.label_title")}
                  className="w-full"
                />
              )}
            />
          </div>
          <Button variant="secondary" onClick={() => handleClose()}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(handleFormSubmit)();
            }}
            loading={isSubmitting}
          >
            {isUpdating ? (isSubmitting ? t("updating") : t("update")) : isSubmitting ? t("adding") : t("add")}
          </Button>
        </div>
        {errors.name?.message && <p className="p-0.5 pl-8 text-13 text-danger-primary">{errors.name?.message}</p>}
      </>
    );
  })
);
