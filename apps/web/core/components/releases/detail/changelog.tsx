/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Loader } from "@plane/ui";
import { useRelease } from "@/hooks/store/use-release";

type Props = {
  workspaceSlug: string;
  releaseId: string;
  canEdit: boolean;
};

/**
 * The changelog is authored and stored as Markdown, not rich text.
 *
 * Its destination is a GitHub release body, which is Markdown. Authoring in a
 * rich-text editor would mean an HTML-to-Markdown conversion on the way out --
 * lossy, and the kind of lossy that only shows up once the notes are already
 * published. Keeping the source of truth in the format it will be published in
 * means what you type is exactly what ships.
 */
export const ReleaseChangelog = observer(function ReleaseChangelog(props: Props) {
  const { workspaceSlug, releaseId, canEdit } = props;
  const { fetchChangelog, updateChangelog, changelogMap } = useRelease();

  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { isLoading } = useSWR(
    workspaceSlug && releaseId ? `RELEASE_CHANGELOG_${workspaceSlug}_${releaseId}` : null,
    workspaceSlug && releaseId ? () => fetchChangelog(workspaceSlug, releaseId) : null
  );

  const stored = changelogMap[releaseId]?.description_html ?? "";
  // Seed the editable draft once the fetch lands, without clobbering in-progress
  // typing on a background revalidation.
  useEffect(() => {
    if (draft === null && !isLoading) setDraft(stored === "<p></p>" ? "" : stored);
  }, [draft, isLoading, stored]);

  const handleSave = async () => {
    if (draft === null) return;
    setIsSaving(true);
    try {
      await updateChangelog(workspaceSlug, releaseId, { description_html: draft });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Saved", message: "Changelog updated." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Could not save the changelog." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && draft === null) {
    return (
      <Loader className="py-6">
        <Loader.Item height="200px" />
      </Loader>
    );
  }

  const isDirty = draft !== null && draft !== (stored === "<p></p>" ? "" : stored);

  return (
    <div className="flex flex-col gap-3 py-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-13 font-medium text-secondary">Changelog</h3>
          <p className="text-11 text-tertiary">Markdown. Published verbatim to the GitHub release body.</p>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving} disabled={!isDirty}>
            Save
          </Button>
        )}
      </div>

      {canEdit ? (
        <textarea
          value={draft ?? ""}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={"## What's new\n\n- Describe the change\n"}
          spellCheck={false}
          className="font-mono min-h-[320px] w-full resize-y rounded-md border-[0.5px] border-subtle-1 bg-layer-2 p-3 text-13 text-primary focus:outline-none"
        />
      ) : (
        <pre className="font-mono min-h-[200px] rounded-md bg-layer-2 p-3 text-13 whitespace-pre-wrap text-primary">
          {draft || "No changelog yet."}
        </pre>
      )}
    </div>
  );
});
