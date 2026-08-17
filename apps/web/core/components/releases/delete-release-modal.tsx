/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IRelease } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
import { useRelease } from "@/hooks/store/use-release";

type Props = {
  isOpen: boolean;
  release: IRelease;
  workspaceSlug: string;
  onClose: () => void;
};

export const DeleteReleaseModal = observer(function DeleteReleaseModal(props: Props) {
  const { isOpen, release, workspaceSlug, onClose } = props;
  const { deleteRelease } = useRelease();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRelease(workspaceSlug, release.id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Deleted",
        message: `Release ${release.name} has been deleted.`,
      });
      onClose();
      // The detail page for a deleted release would render "Release not found",
      // so leave it rather than stranding the user on a dead page.
      navigate(`/${workspaceSlug}/releases`);
    } catch (error) {
      // The API restricts deletion to workspace admins. Surfacing the server's
      // message means a member sees "you don't have permission" rather than a
      // generic failure they would reasonably retry.
      const detail =
        error && typeof error === "object"
          ? Object.values(error as Record<string, string[] | string>)
              .flat()
              .join(" ")
          : "";
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: detail || "Could not delete the release. Please try again.",
      });
      setIsDeleting(false);
    }
  };

  return (
    <AlertModalCore
      isOpen={isOpen}
      handleClose={onClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      title={`Delete release ${release.name}`}
      // Says explicitly what is NOT destroyed. Deleting a release that lists 40
      // work items looks like it might take them with it, and without saying
      // otherwise the safe assumption is to never delete anything.
      content={
        <>
          Are you sure you want to delete <span className="font-medium text-primary">{release.name}</span>? Its scope
          and changelog will be removed. The work items themselves stay in their projects, unchanged.
        </>
      }
      primaryButtonText={{ loading: "Deleting", default: "Delete release" }}
    />
  );
});
