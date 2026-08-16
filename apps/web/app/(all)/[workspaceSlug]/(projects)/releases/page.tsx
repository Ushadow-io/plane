/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { Loader } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import { ReleaseListItem } from "@/components/releases";
import { useReleaseRoute } from "@/components/releases/use-release-route";
import { useRelease } from "@/hooks/store/use-release";

function ReleasesPage() {
  const { workspaceSlug: slug } = useReleaseRoute();
  const { fetchReleases, currentWorkspaceReleaseIds, getReleaseById } = useRelease();

  // Plain effect rather than useSWR: the SWR fetcher did not run in these
  // components, which left the page rendering "No releases yet" against a
  // workspace that had releases -- a silent empty state, not an error. An
  // effect is deterministic and the loading flag is owned locally.
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setIsLoading(true);
    fetchReleases(slug).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, fetchReleases]);

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
