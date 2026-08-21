/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import type { IUserActivityResponse } from "@plane/types";
import { ActivityList } from "@/components/profile/activity/activity-list";
import { UserService } from "@/services/user.service";

const userService = new UserService();
const PER_PAGE = 30;

const TeamActivityFeed = observer(function TeamActivityFeed() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug.toString();
  const { t } = useTranslation();

  const { data: workspaceActivity } = useSWR<IUserActivityResponse>(
    workspaceSlug ? `workspace-activity-${workspaceSlug}` : null,
    workspaceSlug ? () => userService.getWorkspaceActivity(workspaceSlug, { per_page: PER_PAGE }) : null
  );

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-16 font-medium">{t("profile.stats.recent_activity.title")}</h3>
      <ActivityList activity={workspaceActivity} />
    </div>
  );
});

export default TeamActivityFeed;
