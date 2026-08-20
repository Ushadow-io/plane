/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { Loader } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import {
  DeleteReleaseModal,
  ReleaseChangelog,
  ReleaseModal,
  ReleaseOverview,
  ReleaseScope,
  ReleaseStatusBadge,
} from "@/components/releases";
import { useReleaseRoute } from "@/components/releases/use-release-route";
import { useRelease } from "@/hooks/store/use-release";
import { useUserPermissions } from "@/hooks/store/user";

const TABS = ["Overview", "Scope", "Changelog"] as const;
type TTab = (typeof TABS)[number];

function ReleaseDetailPage() {
  const { workspaceSlug: slug, releaseId: id } = useReleaseRoute();

  const { fetchReleaseDetails, getReleaseById } = useRelease();
  const { allowPermissions } = useUserPermissions();
  const [activeTab, setActiveTab] = useState<TTab>("Overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const canEdit = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.WORKSPACE);
  // The API allows only workspace admins to delete, so members do not get a
  // button that would always fail.
  const canDelete = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  // See the list page: useSWR's fetcher does not run in these components.
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!slug || !id) return;
    let cancelled = false;
    setIsLoading(true);
    fetchReleaseDetails(slug, id).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, id, fetchReleaseDetails]);

  const release = getReleaseById(id);

  if (isLoading && !release) {
    return (
      <Loader className="flex flex-col gap-3 p-6">
        <Loader.Item height="40px" />
        <Loader.Item height="200px" />
      </Loader>
    );
  }

  if (!release) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-14 font-medium text-primary">Release not found</p>
        <p className="text-13 text-tertiary">It may have been deleted, or you may not have access to it.</p>
      </div>
    );
  }

  return (
    <>
      <PageHead title={`Release - ${release.name}`} />
      <div className="h-full w-full overflow-y-auto px-6">
        <div className="flex items-start justify-between gap-4 pt-6">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-18 font-semibold text-primary">{release.name}</h1>
              <ReleaseStatusBadge status={release.status} />
              {release.is_latest && (
                <span className="rounded bg-accent-primary/10 px-1.5 py-0.5 text-11 text-accent-primary">Latest</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setIsEditOpen(true)}>
                Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="error-outline" size="sm" onClick={() => setIsDeleteOpen(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-1 border-b border-subtle-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-3 py-2 text-13 transition-colors ${
                activeTab === tab
                  ? "border-accent-strong font-medium text-primary"
                  : "border-transparent text-tertiary hover:text-secondary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" && <ReleaseOverview release={release} />}
        {activeTab === "Scope" && <ReleaseScope workspaceSlug={slug} releaseId={id} canEdit={canEdit} />}
        {activeTab === "Changelog" && <ReleaseChangelog workspaceSlug={slug} releaseId={id} canEdit={canEdit} />}
      </div>

      <ReleaseModal isOpen={isEditOpen} workspaceSlug={slug} data={release} onClose={() => setIsEditOpen(false)} />
      <DeleteReleaseModal
        isOpen={isDeleteOpen}
        release={release}
        workspaceSlug={slug}
        onClose={() => setIsDeleteOpen(false)}
      />
    </>
  );
}

export default observer(ReleaseDetailPage);
