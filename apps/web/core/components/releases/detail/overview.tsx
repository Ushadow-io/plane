/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { IRelease } from "@plane/types";
import { renderFormattedDate, sanitizeHTML } from "@plane/utils";
import { ReleaseProgress } from "../release-progress";
import { ReleaseStatusBadge } from "../release-status";

type Props = {
  release: IRelease;
};

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-32 shrink-0 text-13 text-tertiary">{label}</span>
      <div className="min-w-0 flex-1 text-13 text-primary">{children}</div>
    </div>
  );
}

export const ReleaseOverview = observer(function ReleaseOverview(props: Props) {
  const { release } = props;
  const descriptionText = sanitizeHTML(release.description_html ?? "");

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-13 font-medium text-secondary">Progress</h3>
        <ReleaseProgress release={release} />
      </div>

      <div className="flex flex-col divide-y divide-subtle-1">
        <Property label="Status">
          <ReleaseStatusBadge status={release.status} />
        </Property>
        <Property label="Version tag">
          {release.tag_detail?.version ? (
            <span className="font-mono">{release.tag_detail.version}</span>
          ) : (
            <span className="text-tertiary">None</span>
          )}
        </Property>
        <Property label="Git tag">
          {release.tag_detail?.git_tag ? (
            <span className="font-mono">{release.tag_detail.git_tag}</span>
          ) : (
            <span className="text-tertiary">Not yet cut</span>
          )}
        </Property>
        <Property label="Commit">
          {release.tag_detail?.commit_hash ? (
            <span className="font-mono">{release.tag_detail.commit_hash.slice(0, 12)}</span>
          ) : (
            <span className="text-tertiary">—</span>
          )}
        </Property>
        <Property label="Target date">
          {release.target_date ? renderFormattedDate(release.target_date) : <span className="text-tertiary">—</span>}
        </Property>
        <Property label="Released on">
          {release.release_date ? renderFormattedDate(release.release_date) : <span className="text-tertiary">—</span>}
        </Property>
        <Property label="Pre-release">{release.is_prerelease ? "Yes" : "No"}</Property>
      </div>

      {descriptionText && (
        <div className="flex flex-col gap-3">
          <h3 className="text-13 font-medium text-secondary">Description</h3>
          {/*
            Rendered as text, not HTML. dangerouslySetInnerHTML appears nowhere
            else in this app -- every other rich-text surface goes through the
            editor in read-only mode -- so injecting one here for a field with
            no rich editor attached would add the only XSS surface in the web
            client in exchange for nothing.
          */}
          <p className="text-13 whitespace-pre-wrap text-primary">{descriptionText}</p>
        </div>
      )}
    </div>
  );
});
