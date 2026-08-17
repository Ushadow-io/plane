/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode, SyntheticEvent } from "react";
import { useCallback, useMemo } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { Paperclip } from "lucide-react";
// i18n
import { useTranslation } from "@plane/i18n";
import { LinkIcon, StartDatePropertyIcon, ViewsIcon, DueDatePropertyIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, IIssueDisplayProperties, TIssuePriorities } from "@plane/types";
// ui
import {
  cn,
  getDate,
  renderFormattedPayloadDate,
  generateWorkItemLink,
  shouldHighlightIssueDueDate,
} from "@plane/utils";
// components
import { CycleDropdown } from "@/components/dropdowns/cycle";
import { DateDropdown } from "@/components/dropdowns/date";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { ModuleDropdown } from "@/components/dropdowns/module/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useAppRouter } from "@/hooks/use-app-router";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local components
import { IssuePropertyLabels } from "./labels";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";

function handleEventPropagation(e: SyntheticEvent<HTMLDivElement>) {
  e.stopPropagation();
  e.preventDefault();
}

/**
 * Reserved widths for the property columns.
 *
 * A layout that asks for columns (the list) right-anchors this group and renders the same
 * properties in the same order on every row, so reserving a width per property is all it takes
 * for each one to land in the same column down the whole list. Values wider than their column
 * truncate; the tooltip still carries the full text.
 */
const PROPERTY_COLUMN = {
  state: "w-32",
  priority: "w-7",
  date: "w-28",
  /** Fits AvatarGroup's cap of three overlapping md avatars: 22px + 2 × 18px. */
  assignee: "w-15",
  module: "w-32",
  cycle: "w-28",
  estimate: "w-16",
  /** Sub-work-item, attachment and link counts. */
  count: "w-14",
  labels: "w-32",
  /** A merged date range stands in for both date columns, so it spans the pair plus the gap between them. */
  dateRange: "w-[232px]", // 2 × 112px + gap-2
} as const;

type TPropertySlotProps = {
  /** Width class from PROPERTY_COLUMN, applied only when the layout wants columns. */
  width: string;
  isColumnar: boolean;
  /**
   * An unset property holds its column but keeps its placeholder hidden until the row is hovered,
   * so a sparse row reads as empty space rather than a run of ghost icons.
   */
  isEmpty?: boolean;
  /** Slots with their own click behaviour (the counts) opt out of the generic propagation stopper. */
  stopPropagation?: boolean;
  children: ReactNode;
};

function PropertySlot({ width, isColumnar, isEmpty = false, stopPropagation = true, children }: TPropertySlotProps) {
  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div
      className={cn(
        "h-5",
        isColumnar && `${width} shrink-0`,
        isColumnar &&
          isEmpty &&
          "opacity-0 transition-opacity group-hover/list-block:opacity-100 focus-within:opacity-100"
      )}
      onFocus={stopPropagation ? handleEventPropagation : undefined}
      onClick={stopPropagation ? handleEventPropagation : undefined}
    >
      {children}
    </div>
  );
}

export interface IIssueProperties {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  isReadOnly: boolean;
  className: string;
  activeLayout: string;
  /** Give every property a reserved width so the same one lines up across rows. List layout only. */
  alignInColumns?: boolean;
  isEpic?: boolean;
}

export const IssueProperties = observer(function IssueProperties(props: IIssueProperties) {
  const {
    issue,
    updateIssue,
    displayProperties,
    isReadOnly,
    className,
    alignInColumns = false,
    isEpic = false,
  } = props;
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const { labelMap } = useLabel();
  const storeType = useIssueStoreType();
  const {
    issues: { changeModulesInIssue },
  } = useIssues(storeType);
  const {
    issues: { addCycleToIssue, removeCycleFromIssue },
  } = useIssues(storeType);
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const { getStateById } = useProjectState();
  const { isMobile } = usePlatformOS();
  const projectDetails = getProjectById(issue.project_id);

  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();

  // derived values
  const stateDetails = getStateById(issue.state_id);
  const subIssueCount = issue?.sub_issues_count ?? 0;

  const issueOperations = useMemo(
    () => ({
      addModulesToIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, moduleIds, []);
      },
      removeModulesFromIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, [], moduleIds);
      },
      addIssueToCycle: async (cycleId: string) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await addCycleToIssue?.(workspaceSlug.toString(), issue.project_id, cycleId, issue.id);
      },
      removeIssueFromCycle: async () => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await removeCycleFromIssue?.(workspaceSlug.toString(), issue.project_id, issue.id);
      },
    }),
    [workspaceSlug, issue, changeModulesInIssue, addCycleToIssue, removeCycleFromIssue]
  );

  const handleState = async (stateId: string) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { state_id: stateId });
  };

  const handlePriority = async (value: TIssuePriorities) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { priority: value });
  };

  const handleLabel = async (ids: string[]) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { label_ids: ids });
  };

  const handleAssignee = async (ids: string[]) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { assignee_ids: ids });
  };

  const handleModule = useCallback(
    (moduleIds: string[] | null) => {
      if (!issue || !issue.module_ids || !moduleIds) return;

      const updatedModuleIds = xor(issue.module_ids, moduleIds);
      const modulesToAdd: string[] = [];
      const modulesToRemove: string[] = [];
      for (const moduleId of updatedModuleIds)
        if (issue.module_ids.includes(moduleId)) modulesToRemove.push(moduleId);
        else modulesToAdd.push(moduleId);
      if (modulesToAdd.length > 0) issueOperations.addModulesToIssue(modulesToAdd);
      if (modulesToRemove.length > 0) issueOperations.removeModulesFromIssue(modulesToRemove);
    },
    [issueOperations, issue]
  );

  const handleCycle = useCallback(
    (cycleId: string | null) => {
      if (!issue || issue.cycle_id === cycleId) return;
      if (cycleId) issueOperations.addIssueToCycle?.(cycleId);
      else issueOperations.removeIssueFromCycle?.();
    },
    [issue, issueOperations]
  );

  const handleStartDate = async (date: Date | null) => {
    if (updateIssue)
      await updateIssue(issue.project_id, issue.id, { start_date: date ? renderFormattedPayloadDate(date) : null });
  };

  const handleTargetDate = async (date: Date | null) => {
    if (updateIssue)
      await updateIssue(issue.project_id, issue.id, { target_date: date ? renderFormattedPayloadDate(date) : null });
  };

  const handleEstimate = async (value: string | undefined) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { estimate_point: value });
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue?.project_id,
    issueId: issue?.id,
    projectIdentifier: projectDetails?.identifier,
    sequenceId: issue?.sequence_id,
    isArchived: !!issue?.archived_at,
    isEpic,
  });

  const redirectToIssueDetail = () => router.push(`${workItemLink}#sub-issues`);

  if (!displayProperties || !issue.project_id) return null;

  // date range is enabled only when both dates are available and both dates are enabled
  const isDateRangeEnabled: boolean = Boolean(
    issue.start_date && issue.target_date && displayProperties.start_date && displayProperties.due_date
  );

  const defaultLabelOptions =
    issue?.label_ids?.flatMap((id) => {
      const label = labelMap[id];
      return label ? [label] : [];
    }) || [];

  const minDate = getDate(issue.start_date);
  const maxDate = getDate(issue.target_date);

  return (
    <div className={className}>
      {/* basic properties */}
      {/* state */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="state">
        <PropertySlot width={PROPERTY_COLUMN.state} isColumnar={alignInColumns}>
          <StateDropdown
            buttonContainerClassName="truncate max-w-40"
            value={issue.state_id}
            onChange={handleState}
            projectId={issue.project_id}
            disabled={isReadOnly}
            buttonVariant="border-with-text"
            renderByDefault={isMobile}
            showTooltip
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* priority */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
        <PropertySlot
          width={PROPERTY_COLUMN.priority}
          isColumnar={alignInColumns}
          isEmpty={!issue.priority || issue.priority === "none"}
        >
          <PriorityDropdown
            value={issue?.priority}
            onChange={handlePriority}
            disabled={isReadOnly}
            buttonVariant="border-without-text"
            renderByDefault={isMobile}
            showTooltip
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* merged dates */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey={["start_date", "due_date"]}
        shouldRenderProperty={() => isDateRangeEnabled}
      >
        <PropertySlot width={PROPERTY_COLUMN.dateRange} isColumnar={alignInColumns}>
          <DateRangeDropdown
            value={{
              from: getDate(issue.start_date) || undefined,
              to: getDate(issue.target_date) || undefined,
            }}
            onSelect={(range) => {
              handleStartDate(range?.from ?? null);
              handleTargetDate(range?.to ?? null);
            }}
            hideIcon={{
              from: false,
            }}
            isClearable
            mergeDates
            buttonVariant={issue.start_date || issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={
              shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group) ? "text-danger-primary" : ""
            }
            clearIconClassName="text-primary!"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            renderPlaceholder={false}
            customTooltipHeading="Date Range"
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* start date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="start_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <PropertySlot width={PROPERTY_COLUMN.date} isColumnar={alignInColumns} isEmpty={!issue.start_date}>
          <DateDropdown
            value={issue.start_date ?? null}
            onChange={handleStartDate}
            maxDate={maxDate}
            placeholder={t("common.order_by.start_date")}
            icon={<StartDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.start_date ? "border-with-text" : "border-without-text"}
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            labelClassName="text-caption-sm-regular"
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* target/due date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="due_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <PropertySlot width={PROPERTY_COLUMN.date} isColumnar={alignInColumns} isEmpty={!issue.target_date}>
          <DateDropdown
            value={issue?.target_date ?? null}
            onChange={handleTargetDate}
            minDate={minDate}
            placeholder={t("common.order_by.due_date")}
            icon={<DueDatePropertyIcon className="h-3 w-3 shrink-0" />}
            buttonVariant={issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={
              shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group) ? "text-danger-primary" : ""
            }
            clearIconClassName="text-primary!"
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            labelClassName="text-caption-sm-regular"
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* assignee */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
        <PropertySlot
          width={PROPERTY_COLUMN.assignee}
          isColumnar={alignInColumns}
          isEmpty={!issue.assignee_ids?.length}
        >
          <MemberDropdown
            projectId={issue?.project_id}
            value={issue?.assignee_ids}
            onChange={handleAssignee}
            disabled={isReadOnly}
            multiple
            buttonVariant={issue.assignee_ids?.length > 0 ? "transparent-without-text" : "border-without-text"}
            buttonClassName={issue.assignee_ids?.length > 0 ? "hover:bg-transparent px-0" : ""}
            showTooltip={issue?.assignee_ids?.length === 0}
            placeholder={t("common.assignees")}
            optionsClassName="z-10"
            tooltipContent=""
            renderByDefault={isMobile}
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      <>
        {!isEpic && (
          <>
            {/* modules */}
            {projectDetails?.module_view && (
              <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="modules">
                <PropertySlot
                  width={PROPERTY_COLUMN.module}
                  isColumnar={alignInColumns}
                  isEmpty={!issue.module_ids?.length}
                >
                  <ModuleDropdown
                    buttonContainerClassName="truncate max-w-40"
                    projectId={issue?.project_id}
                    value={issue?.module_ids ?? []}
                    onChange={handleModule}
                    disabled={isReadOnly}
                    renderByDefault={isMobile}
                    multiple
                    buttonVariant="border-with-text"
                    showCount
                    showTooltip
                  />
                </PropertySlot>
              </WithDisplayPropertiesHOC>
            )}

            {/* cycles */}
            {projectDetails?.cycle_view && (
              <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="cycle">
                <PropertySlot width={PROPERTY_COLUMN.cycle} isColumnar={alignInColumns} isEmpty={!issue.cycle_id}>
                  <CycleDropdown
                    buttonContainerClassName="truncate max-w-40"
                    projectId={issue?.project_id}
                    value={issue?.cycle_id}
                    onChange={handleCycle}
                    disabled={isReadOnly}
                    buttonVariant="border-with-text"
                    renderByDefault={isMobile}
                    showTooltip
                  />
                </PropertySlot>
              </WithDisplayPropertiesHOC>
            )}
          </>
        )}
      </>

      {/* estimates */}
      {projectId && areEstimateEnabledByProjectId(projectId?.toString()) && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="estimate">
          <PropertySlot width={PROPERTY_COLUMN.estimate} isColumnar={alignInColumns} isEmpty={!issue.estimate_point}>
            <EstimateDropdown
              value={issue.estimate_point ?? undefined}
              onChange={handleEstimate}
              projectId={issue.project_id}
              disabled={isReadOnly}
              buttonVariant="border-with-text"
              renderByDefault={isMobile}
              showTooltip
            />
          </PropertySlot>
        </WithDisplayPropertiesHOC>
      )}

      {/* extra render properties */}
      {/* sub-issues */}
      {/* the counts below hold an empty column when they are zero, rather than dropping out of the row */}
      {!isEpic && (
        <WithDisplayPropertiesHOC
          displayProperties={displayProperties}
          displayPropertyKey="sub_issue_count"
          shouldRenderProperty={(properties) => !!properties.sub_issue_count && (alignInColumns || !!subIssueCount)}
        >
          <PropertySlot width={PROPERTY_COLUMN.count} isColumnar={alignInColumns} stopPropagation={false}>
            {!!subIssueCount && (
              <Tooltip
                tooltipHeading={t("common.sub_work_items")}
                tooltipContent={`${subIssueCount}`}
                isMobile={isMobile}
                renderByDefault={false}
              >
                {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
                <div
                  onFocus={handleEventPropagation}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    redirectToIssueDetail();
                  }}
                  className="flex h-5 flex-shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1 hover:bg-layer-1"
                >
                  <ViewsIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
                  <div className="text-caption-sm-regular">{subIssueCount}</div>
                </div>
              </Tooltip>
            )}
          </PropertySlot>
        </WithDisplayPropertiesHOC>
      )}

      {/* attachments */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="attachment_count"
        shouldRenderProperty={(properties) =>
          !!properties.attachment_count && (alignInColumns || !!issue.attachment_count)
        }
      >
        <PropertySlot width={PROPERTY_COLUMN.count} isColumnar={alignInColumns}>
          {!!issue.attachment_count && (
            <Tooltip
              tooltipHeading={t("common.attachments")}
              tooltipContent={`${issue.attachment_count}`}
              isMobile={isMobile}
              renderByDefault={false}
            >
              <div className="flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1">
                <Paperclip className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
                <div className="text-caption-sm-regular">{issue.attachment_count}</div>
              </div>
            </Tooltip>
          )}
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* link */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="link"
        shouldRenderProperty={(properties) => !!properties.link && (alignInColumns || !!issue.link_count)}
      >
        <PropertySlot width={PROPERTY_COLUMN.count} isColumnar={alignInColumns}>
          {!!issue.link_count && (
            <Tooltip
              tooltipHeading={t("common.links")}
              tooltipContent={`${issue.link_count}`}
              isMobile={isMobile}
              renderByDefault={false}
            >
              <div className="flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1">
                <LinkIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
                <div className="text-caption-sm-regular">{issue.link_count}</div>
              </div>
            </Tooltip>
          )}
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* label */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="labels">
        {alignInColumns ? (
          // one column means one chip, so a multi-label work item summarises as "N Labels"
          <PropertySlot
            width={PROPERTY_COLUMN.labels}
            isColumnar
            isEmpty={!issue.label_ids?.length}
            stopPropagation={false}
          >
            <IssuePropertyLabels
              projectId={issue?.project_id || null}
              value={issue?.label_ids || []}
              defaultOptions={defaultLabelOptions}
              onChange={handleLabel}
              disabled={isReadOnly}
              renderByDefault={isMobile}
              hideDropdownArrow
              maxRender={1}
              fullWidth
            />
          </PropertySlot>
        ) : (
          <IssuePropertyLabels
            projectId={issue?.project_id || null}
            value={issue?.label_ids || []}
            defaultOptions={defaultLabelOptions}
            onChange={handleLabel}
            disabled={isReadOnly}
            renderByDefault={isMobile}
            hideDropdownArrow
            maxRender={3}
          />
        )}
      </WithDisplayPropertiesHOC>
    </div>
  );
});
