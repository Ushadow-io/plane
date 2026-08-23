/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IIssueLabel } from "@plane/types";
import { EUserPermissions } from "@plane/types";
// hooks
import { useLabel } from "@/hooks/store/use-label";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { TWorkItemLabelSelectBaseProps } from "./base";
import { WorkItemLabelSelectBase } from "./base";

type TWorkItemLabelSelectProps = Omit<TWorkItemLabelSelectBaseProps, "labelIds" | "getLabelById" | "onDropdownOpen"> & {
  projectId: string | undefined;
};

export const IssueLabelSelect = observer(function IssueLabelSelect(props: TWorkItemLabelSelectProps) {
  const { projectId, value, onChange, ...rest } = props;
  // router
  const { workspaceSlug } = useParams();
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { getProjectLabelIds, getLabelById, fetchProjectLabels, createLabel } = useLabel();
  // derived values
  const projectLabelIds = getProjectLabelIds(projectId);

  const canCreateLabel =
    projectId &&
    allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug?.toString(), projectId);

  const onDropdownOpen = () => {
    if (projectLabelIds === undefined && workspaceSlug && projectId)
      fetchProjectLabels(workspaceSlug.toString(), projectId);
  };

  // The group pulldowns can only be rendered once the labels are known, so fetch them up front
  // instead of waiting for a dropdown to be opened.
  useEffect(() => {
    if (projectLabelIds === undefined && workspaceSlug && projectId)
      fetchProjectLabels(workspaceSlug.toString(), projectId);
  }, [projectLabelIds, workspaceSlug, projectId, fetchProjectLabels]);

  const handleCreateLabel = (data: Partial<IIssueLabel>) => {
    if (!workspaceSlug || !projectId) {
      throw new Error("Workspace slug or project ID is missing");
    }
    return createLabel(workspaceSlug.toString(), projectId, data);
  };

  // A "group" is a label that has children. Its children are the selectable options.
  // Everything else with no parent is a plain, ungrouped label.
  const labels = (projectLabelIds ?? []).map((id) => getLabelById(id)).filter((l): l is IIssueLabel => !!l);
  const groups = labels
    .filter((l) => !l.parent && labels.some((child) => child.parent === l.id))
    .map((group) => ({
      group,
      childIds: labels.filter((child) => child.parent === group.id).map((child) => child.id),
    }));
  const groupIds = new Set(groups.map((g) => g.group.id));
  const ungroupedLabelIds = labels.filter((l) => !l.parent && !groupIds.has(l.id)).map((l) => l.id);

  // Replace only the ids owned by this dropdown, leave every other selected label untouched.
  const handleScopedChange = (scopeIds: string[]) => (nextScopeValue: string[]) => {
    const scope = new Set(scopeIds);
    onChange([...(value ?? []).filter((id) => !scope.has(id)), ...nextScopeValue]);
  };

  const scopedValue = (scopeIds: string[]) => {
    const scope = new Set(scopeIds);
    return (value ?? []).filter((id) => scope.has(id));
  };

  return (
    <div className="flex h-full flex-wrap items-center gap-2">
      {groups.map(({ group, childIds }) => (
        <WorkItemLabelSelectBase
          {...rest}
          key={group.id}
          getLabelById={getLabelById}
          labelIds={childIds}
          value={scopedValue(childIds)}
          onChange={handleScopedChange(childIds)}
          onDropdownOpen={onDropdownOpen}
          placeholder={group.name}
          flat
          createLabel={(data) => handleCreateLabel({ ...data, parent: group.id })}
          createLabelEnabled={!!canCreateLabel}
        />
      ))}
      <WorkItemLabelSelectBase
        {...rest}
        getLabelById={getLabelById}
        labelIds={ungroupedLabelIds}
        value={scopedValue(ungroupedLabelIds)}
        onChange={handleScopedChange(ungroupedLabelIds)}
        onDropdownOpen={onDropdownOpen}
        placeholder={t("labels")}
        flat
        createLabel={handleCreateLabel}
        createLabelEnabled={!!canCreateLabel}
      />
    </div>
  );
});
