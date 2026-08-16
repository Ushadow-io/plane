/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLocation } from "react-router";

/**
 * Workspace slug and release id for the current URL.
 *
 * Derived from the pathname rather than from route params. Both of the usual
 * mechanisms come back empty inside these page components in this app: the
 * Route.ComponentProps `params` prop, and useParams() -- even though useParams()
 * works in the Releases header, which is rendered from the same layout.
 *
 * That difference is unexplained, and guessing at it cost two deploys of
 * silently-wrong pages: an empty slug leaves the SWR key null, so no request is
 * ever made and the page renders an empty state for data that exists. "No
 * releases yet" with two releases in the database is indistinguishable from a
 * genuinely empty workspace, which is what made it hard to spot.
 *
 * useLocation() is unambiguous and the routes are fixed, so parse the path:
 *   /:workspaceSlug/releases            -> ["", slug, "releases"]
 *   /:workspaceSlug/releases/:releaseId -> ["", slug, "releases", id]
 */
export function useReleaseRoute(): { workspaceSlug: string; releaseId: string } {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  const releasesIndex = segments.indexOf("releases");

  if (releasesIndex < 1) return { workspaceSlug: "", releaseId: "" };

  return {
    workspaceSlug: segments[releasesIndex - 1] ?? "",
    releaseId: segments[releasesIndex + 1] ?? "",
  };
}
