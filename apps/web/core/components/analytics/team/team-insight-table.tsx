/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { UserRound } from "lucide-react";
import { useTranslation } from "@plane/i18n";
// plane package imports
import type { TeamInsightColumns } from "@plane/types";
import { Avatar } from "@plane/ui";
import { calculateTimeAgo, getFileURL } from "@plane/utils";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
// plane web components
import { exportCSV } from "../export";
import { InsightTable } from "../insight-table";

const analyticsService = new AnalyticsService();

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    export: {
      key: string;
      value: (row: Row<TData>) => string | number;
      label?: string;
    };
  }
}

const TeamInsightTable = observer(function TeamInsightTable() {
  // router
  const params = useParams();
  const workspaceSlug = params.workspaceSlug.toString();
  const { t } = useTranslation();
  // store hooks
  const { selectedProjects } = useAnalytics();
  const { data: teamData, isLoading } = useSWR(`insights-table-team-${workspaceSlug}-${selectedProjects}`, () =>
    analyticsService.getAdvanceAnalyticsStats<TeamInsightColumns[]>(
      workspaceSlug,
      "team",
      selectedProjects?.length > 0 ? { project_ids: selectedProjects.join(",") } : {}
    )
  );
  // derived values
  const columnsLabels: Record<keyof Omit<TeamInsightColumns, "member_id" | "avatar_url">, string> = useMemo(
    () => ({
      display_name: t("common.members"),
      work_items_logged: t("common.work_items_logged"),
      work_items_closed: t("common.work_items_closed"),
      last_login_time: t("common.last_login"),
    }),
    [t]
  );
  const columns: ColumnDef<TeamInsightColumns>[] = useMemo(
    () => [
      {
        accessorKey: "display_name",
        header: () => <div className="text-left">{columnsLabels["display_name"]}</div>,
        cell: ({ row }: { row: Row<TeamInsightColumns> }) => (
          <Link href={`/${workspaceSlug}/profile/${row.original.member_id}`} className="inline-flex">
            <div className="flex items-center gap-2">
              {row.original.avatar_url && row.original.avatar_url !== "" ? (
                <Avatar
                  name={row.original.display_name}
                  src={getFileURL(row.original.avatar_url)}
                  size={24}
                  shape="circle"
                />
              ) : (
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-layer-1 capitalize">
                  {row.original.display_name ? (
                    row.original.display_name[0]
                  ) : (
                    <UserRound className="text-secondary" size={12} />
                  )}
                </div>
              )}
              <span className="text-primary">{row.original.display_name}</span>
            </div>
          </Link>
        ),
        meta: {
          export: {
            key: columnsLabels["display_name"],
            value: (row) => row.original.display_name?.toString() ?? "",
          },
        },
      },
      {
        accessorKey: "work_items_logged",
        header: () => <div className="text-right">{columnsLabels["work_items_logged"]}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.work_items_logged}</div>,
        meta: {
          export: {
            key: columnsLabels["work_items_logged"],
            value: (row) => row.original.work_items_logged.toString(),
          },
        },
      },
      {
        accessorKey: "work_items_closed",
        header: () => <div className="text-right">{columnsLabels["work_items_closed"]}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.work_items_closed}</div>,
        meta: {
          export: {
            key: columnsLabels["work_items_closed"],
            value: (row) => row.original.work_items_closed.toString(),
          },
        },
      },
      {
        accessorKey: "last_login_time",
        header: () => <div className="text-right">{columnsLabels["last_login_time"]}</div>,
        cell: ({ row }) => (
          <div className="text-right text-secondary">
            {row.original.last_login_time ? calculateTimeAgo(row.original.last_login_time) : t("common.never")}
          </div>
        ),
        meta: {
          export: {
            key: columnsLabels["last_login_time"],
            value: (row) => row.original.last_login_time?.toString() ?? "",
          },
        },
      },
    ],
    [columnsLabels, t, workspaceSlug]
  );
  return (
    <InsightTable<"team">
      analyticsType="team"
      data={teamData}
      isLoading={isLoading}
      columns={columns}
      columnsLabels={columnsLabels}
      headerText={t("common.members")}
      onExport={(rows) => teamData && exportCSV(rows, columns, workspaceSlug)}
    />
  );
});

export default TeamInsightTable;
