/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "react-router";
import useSWR from "swr";
import { Loader } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import { ReleaseListItem } from "@/components/releases";
import { useRelease } from "@/hooks/store/use-release";

function ReleasesPage() {
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const { fetchReleases, currentWorkspaceReleaseIds, getReleaseById } = useRelease();

  const { isLoading } = useSWR(slug ? `WORKSPACE_RELEASES_${slug}` : null, slug ? () => fetchReleases(slug) : null);

  const releaseIds = currentWorkspaceReleaseIds;

  return (
    <>
      <PageHead title="Releases" />
      {isLoading && !releaseIds?.length ? (
        <Loader className="flex flex-col gap-3 p-6">
          <Loader.Item height="72px" />
          <Loader.Item height="72px" />
          <Loader.Item height="72px" />
        </Loader>
      ) : !releaseIds?.length ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <p className="text-14 font-medium text-primary">No releases yet</p>
          <p className="max-w-md text-13 text-tertiary">
            A release groups work items from across your projects into one versioned deliverable, so you can plan what
            ships in v1, v2 and beyond.
          </p>
        </div>
      ) : (
        <div className="h-full w-full overflow-y-auto">
          {releaseIds.map((releaseId) => {
            const release = getReleaseById(releaseId);
            if (!release) return null;
            return <ReleaseListItem key={releaseId} release={release} workspaceSlug={slug} />;
          })}
        </div>
      )}
    </>
  );
}

export default observer(ReleasesPage);
