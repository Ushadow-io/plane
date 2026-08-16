/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import type { IRelease, TReleaseStatus } from "@plane/types";
import { RELEASE_STATUS_DETAILS, RELEASE_STATUS_OPTIONS } from "./release-status";

export type TReleaseFormData = {
  name: string;
  status: TReleaseStatus;
  target_date: string | null;
  is_prerelease: boolean;
};

type Props = {
  data?: Partial<IRelease>;
  isSubmitting: boolean;
  onSubmit: (data: TReleaseFormData) => Promise<void>;
  onClose: () => void;
};

export function ReleaseForm(props: Props) {
  const { data, isSubmitting, onSubmit, onClose } = props;

  const [name, setName] = useState(data?.name ?? "");
  const [status, setStatus] = useState<TReleaseStatus>(data?.status ?? "unreleased");
  const [targetDate, setTargetDate] = useState(data?.target_date ?? "");
  const [isPrerelease, setIsPrerelease] = useState(data?.is_prerelease ?? false);

  const isEditing = Boolean(data?.id);
  const trimmedName = name.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedName) return;
    await onSubmit({
      name: trimmedName,
      status,
      target_date: targetDate || null,
      is_prerelease: isPrerelease,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
      <h3 className="text-16 font-medium text-primary">{isEditing ? "Update release" : "Create release"}</h3>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="release-name" className="text-13 text-secondary">
          Name
        </label>
        <Input
          id="release-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="v1.0"
          className="w-full"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="release-status" className="text-13 text-secondary">
            Status
          </label>
          <select
            id="release-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as TReleaseStatus)}
            className="w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-1.5 text-13 focus:outline-none"
          >
            {RELEASE_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {RELEASE_STATUS_DETAILS[option].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="release-target-date" className="text-13 text-secondary">
            Target date
          </label>
          <Input
            id="release-target-date"
            name="target_date"
            type="date"
            value={targetDate ?? ""}
            onChange={(event) => setTargetDate(event.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-13 text-secondary">
        <input
          type="checkbox"
          checked={isPrerelease}
          onChange={(event) => setIsPrerelease(event.target.checked)}
          className="rounded border-subtle-1"
        />
        Pre-release
      </label>

      {/*
        release_date is deliberately absent. It is stamped by the server the
        first time a release enters the released status and is never cleared,
        so exposing it as a free-text field would invite someone to rewrite
        shipping history that release notes depend on.
      */}

      <div className="flex justify-end gap-2 border-t border-subtle-1 pt-4">
        <Button variant="secondary" size="sm" onClick={onClose} type="button">
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" loading={isSubmitting} disabled={!trimmedName}>
          {isEditing ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
