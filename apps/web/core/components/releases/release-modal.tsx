/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useState } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IRelease } from "@plane/types";
import { EModalWidth, ModalCore } from "@plane/ui";
import { useRelease } from "@/hooks/store/use-release";
import type { TReleaseFormData } from "./release-form";
import { ReleaseForm } from "./release-form";

type Props = {
  isOpen: boolean;
  workspaceSlug: string;
  data?: Partial<IRelease>;
  onClose: () => void;
  onSuccess?: (release: IRelease) => void;
};

export const ReleaseModal = observer(function ReleaseModal(props: Props) {
  const { isOpen, workspaceSlug, data, onClose, onSuccess } = props;
  const { createRelease, updateRelease } = useRelease();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: TReleaseFormData) => {
    setIsSubmitting(true);
    try {
      const release = data?.id
        ? await updateRelease(workspaceSlug, data.id, formData)
        : await createRelease(workspaceSlug, formData);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success",
        message: `Release ${data?.id ? "updated" : "created"} successfully.`,
      });
      onSuccess?.(release);
      onClose();
    } catch (error) {
      // The server rejects duplicate names and out-of-workspace references with
      // a field-keyed body; surface it rather than a generic failure message so
      // the user knows which field to fix.
      const detail =
        (error as Record<string, string[] | string> | undefined) &&
        Object.values(error as Record<string, string[] | string>)
          .flat()
          .join(" ");
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: detail || "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.XXL}>
      <ReleaseForm data={data} isSubmitting={isSubmitting} onSubmit={handleSubmit} onClose={onClose} />
    </ModalCore>
  );
});
