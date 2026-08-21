/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import AnalyticsWrapper from "../analytics-wrapper";
import TeamActivityFeed from "./team-activity-feed";
import TeamInsightTable from "./team-insight-table";

function Team() {
  return (
    <AnalyticsWrapper i18nTitle="common.team">
      <div className="flex flex-col gap-14">
        <TeamInsightTable />
        <TeamActivityFeed />
      </div>
    </AnalyticsWrapper>
  );
}

export { Team };
