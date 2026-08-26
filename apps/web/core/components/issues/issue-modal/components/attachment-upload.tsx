/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { Paperclip } from "lucide-react";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EFileAssetType } from "@plane/types";
// hooks
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useFileSize } from "@/hooks/use-file-size";

type TStagedAttachment = {
  id: string;
  name: string;
};

type Props = {
  workspaceSlug: string;
  projectId: string | null;
  isDraft: boolean;
  onAssetUpload: (assetId: string) => void;
};

export const IssueAttachmentUploadButton = observer(function IssueAttachmentUploadButton(props: Props) {
  const { workspaceSlug, projectId, isDraft, onAssetUpload } = props;
  // states
  const [isUploading, setIsUploading] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<TStagedAttachment[]>([]);
  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  // hooks
  const { uploadEditorAsset } = useEditorAsset();
  const { maxFileSize } = useFileSize();

  const uploadOneFile = async (file: File) => {
    if (!workspaceSlug || !projectId) return;

    if (file.size > maxFileSize) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "File too large",
        message: `${file.name} is larger than ${maxFileSize / 1024 / 1024} MB`,
      });
      return;
    }
    try {
      const blockId = `attachment-${Date.now()}-${file.name}`;
      const { asset_id } = await uploadEditorAsset({
        blockId,
        data: {
          entity_identifier: "",
          entity_type: isDraft ? EFileAssetType.DRAFT_ISSUE_DESCRIPTION : EFileAssetType.ISSUE_ATTACHMENT,
        },
        file,
        projectId,
        workspaceSlug,
      });
      setStagedAttachments((prev) => [...prev, { id: asset_id, name: file.name }]);
      onAssetUpload(asset_id);
    } catch (_error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Upload failed",
        message: `${file.name} could not be uploaded`,
      });
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !workspaceSlug || !projectId) return;

    setIsUploading(true);
    await Promise.all(Array.from(files).map(uploadOneFile));
    setIsUploading(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="flex h-7 items-center gap-1.5 rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-caption-sm-regular hover:bg-layer-1 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Paperclip className="h-3 w-3 flex-shrink-0" />
        <span>{isUploading ? "Uploading..." : "Attach files"}</span>
      </button>
      {stagedAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stagedAttachments.map((attachment) => (
            <span
              key={attachment.id}
              className="flex items-center gap-1 rounded-sm bg-layer-1 px-2 py-0.5 text-caption-sm-regular text-secondary"
            >
              {attachment.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
