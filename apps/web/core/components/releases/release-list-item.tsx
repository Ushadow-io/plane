/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Link } from "react-router";
import type { IRelease } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
import { ReleaseProgress } from "./release-progress";
import { ReleaseStatusBadge } from "./release-status";

type Props = {
  release: IRelease;
  workspaceSlug: string;
};

export const ReleaseListItem = observer(function ReleaseListItem(props: Props) {
  const { release, workspaceSlug } = props;

  return (
    <Link
      to={`/${workspaceSlug}/releases/${release.id}`}
      className="flex flex-col gap-3 border-b border-subtle-1 px-6 py-4 transition-colors hover:bg-layer-1"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-14 font-medium text-primary">{release.name}</span>
            {release.is_latest && (
              <span className="shrink-0 rounded bg-accent-primary/10 px-1.5 py-0.5 text-11 text-accent-primary">
                Latest
              </span>
            )}
            {release.is_prerelease && (
              <span className="shrink-0 rounded bg-layer-3 px-1.5 py-0.5 text-11 text-tertiary">Pre-release</span>
            )}
          </div>
          {release.tag_detail?.version && (
            <span className="font-mono truncate text-11 text-tertiary">{release.tag_detail.version}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ReleaseStatusBadge status={release.status} />
          <span className="text-11 text-tertiary">
            {release.release_date
              ? `Shipped ${renderFormattedDate(release.release_date)}`
              : release.target_date
                ? `Target ${renderFormattedDate(release.target_date)}`
                : "No date"}
          </span>
        </div>
      </div>

      <ReleaseProgress release={release} />
    </Link>
  );
});
