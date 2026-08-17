/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { ISSUE_DISPLAY_PROPERTIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IIssueDisplayProperties } from "@plane/types";
import { AlertModalCore, Loader } from "@plane/ui";
// services
import { WorkspaceService } from "@/services/workspace.service";

const workspaceService = new WorkspaceService();

type Props = {
  workspaceSlug: string;
  isEditable: boolean;
};

export const WorkspaceDefaultDisplayProperties = observer(function WorkspaceDefaultDisplayProperties(props: Props) {
  const { workspaceSlug, isEditable } = props;
  // i18n
  const { t } = useTranslation();
  // states
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    workspaceSlug ? `WORKSPACE_DEFAULT_DISPLAY_PROPERTIES_${workspaceSlug}` : null,
    workspaceSlug ? () => workspaceService.fetchWorkspaceDefaultDisplayProperties(workspaceSlug) : null
  );

  const displayProperties = data?.default_display_properties;

  const handleToggle = async (key: keyof IIssueDisplayProperties) => {
    if (!isEditable || !displayProperties) return;

    const updated = { ...displayProperties, [key]: !displayProperties[key] };
    // Optimistic, without revalidating: the PATCH returns the merged server copy and the
    // mutate below installs it, so a round trip in between would only make the chip flicker.
    mutate({ default_display_properties: updated }, false);

    try {
      // Only the toggled key is sent -- the server merges, so two admins editing different
      // properties at the same time do not overwrite each other.
      const response = await workspaceService.updateWorkspaceDefaultDisplayProperties(workspaceSlug, {
        [key]: updated[key],
      });
      mutate(response, false);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.display.toasts.saved.title"),
        message: t("workspace_settings.settings.display.toasts.saved.message"),
      });
    } catch {
      mutate();
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.display.toasts.error.title"),
        message: t("workspace_settings.settings.display.toasts.error.message"),
      });
    }
  };

  const handleApplyToAll = async () => {
    setIsApplying(true);
    try {
      await workspaceService.applyWorkspaceDefaultDisplayProperties(workspaceSlug);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.display.toasts.applied.title"),
        message: t("workspace_settings.settings.display.toasts.applied.message"),
      });
      setIsApplyModalOpen(false);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.display.toasts.error.title"),
        message: t("workspace_settings.settings.display.toasts.error.message"),
      });
    }
    setIsApplying(false);
  };

  if (isLoading || !displayProperties)
    return (
      <Loader className="flex flex-wrap gap-2">
        {ISSUE_DISPLAY_PROPERTIES.map((property) => (
          <Loader.Item key={property.key} height="26px" width="80px" />
        ))}
      </Loader>
    );

  return (
    <>
      <AlertModalCore
        isOpen={isApplyModalOpen}
        handleClose={() => setIsApplyModalOpen(false)}
        handleSubmit={handleApplyToAll}
        isSubmitting={isApplying}
        title={t("workspace_settings.settings.display.apply_modal.title")}
        content={t("workspace_settings.settings.display.apply_modal.content")}
        primaryButtonText={{
          loading: t("workspace_settings.settings.display.apply_modal.button_loading"),
          default: t("workspace_settings.settings.display.apply_modal.button_default"),
        }}
      />

      <div className="flex flex-col gap-4">
        {/* Same chip idiom as the per-view Display dropdown, so the workspace default is
            recognisably the same set of choices a member makes for themselves. */}
        <div className="flex flex-wrap items-center gap-2">
          {ISSUE_DISPLAY_PROPERTIES.map((property) => (
            <button
              key={property.key}
              type="button"
              disabled={!isEditable}
              className={`rounded-sm border px-2 py-0.5 text-11 transition-all ${
                displayProperties[property.key]
                  ? "border-accent-strong bg-accent-primary text-on-color"
                  : "border-subtle hover:bg-layer-1"
              } ${isEditable ? "" : "cursor-not-allowed opacity-60"}`}
              onClick={() => handleToggle(property.key)}
            >
              {t(property.titleTranslationKey)}
            </button>
          ))}
        </div>

        <p className="text-body-xs-regular text-tertiary">{t("workspace_settings.settings.display.seeded_note")}</p>

        {isEditable && (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setIsApplyModalOpen(true)}>
              {t("workspace_settings.settings.display.apply_to_all")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
});
