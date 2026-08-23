/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
// icons
import { Plus, Trash2, TriangleAlert } from "lucide-react";
// plane internal packages
import { Input } from "@plane/ui";
import { cn } from "@plane/utils";

/** Plane's workspace roles, highest first. Mirrors ROLE in db/models/project.py. */
const ROLES = ["ADMIN", "MEMBER", "GUEST"] as const;

type TMappingRow = {
  /**
   * Stable identity for React. Rows have no natural key — group and workspace
   * are both user-editable and may be blank or duplicated mid-edit — so
   * keying on the array index would make a deletion reuse the wrong row's
   * DOM state, silently moving what the user typed.
   */
  id: string;
  group: string;
  workspace: string;
  role: string;
};

let nextRowId = 0;
const newRowId = () => `oidc-map-row-${nextRowId++}`;

/**
 * The stored value is a JSON object keyed by group, because one group can grant
 * several workspaces:
 *   {"eng": [{"workspace": "a", "role": "ADMIN"}, {"workspace": "b", ...}]}
 * The editor is a flat list of rows instead — one row per grant reads far more
 * naturally than nested arrays, and collapses back on save.
 */
export function parseMapping(raw: string | undefined): { rows: TMappingRow[]; malformed: boolean } {
  if (!raw || !raw.trim()) return { rows: [], malformed: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { rows: [], malformed: true };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { rows: [], malformed: true };
  }
  const rows: TMappingRow[] = [];
  for (const [group, grants] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(grants)) return { rows: [], malformed: true };
    for (const grant of grants) {
      if (typeof grant !== "object" || grant === null) return { rows: [], malformed: true };
      const { workspace, role } = grant as { workspace?: unknown; role?: unknown };
      rows.push({
        id: newRowId(),
        group,
        workspace: typeof workspace === "string" ? workspace : "",
        role:
          typeof role === "string" && ROLES.includes(role.toUpperCase() as (typeof ROLES)[number])
            ? role.toUpperCase()
            : "MEMBER",
      });
    }
  }
  return { rows, malformed: false };
}

export function serializeMapping(rows: TMappingRow[]): string {
  const map: Record<string, { workspace: string; role: string }[]> = {};
  for (const row of rows) {
    const group = row.group.trim();
    const workspace = row.workspace.trim();
    // A half-typed row is not an error, it just is not a mapping yet — drop it
    // rather than writing {"": [...]} and having the backend warn about it.
    if (!group || !workspace) continue;
    (map[group] ||= []).push({ workspace, role: row.role });
  }
  return Object.keys(map).length ? JSON.stringify(map) : "";
}

type Props = {
  control: Control<any>;
  name: string;
};

export function GroupWorkspaceMapInput(props: Props) {
  const { control, name } = props;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => <GroupMapRows value={value} onChange={onChange} />}
    />
  );
}

function GroupMapRows({ value, onChange }: { value: string | undefined; onChange: (next: string) => void }) {
  // Seeded once from the stored value. Rows are the source of truth while the
  // form is open; re-deriving them from the serialized JSON on every keystroke
  // would reorder and re-group rows mid-edit as groups are typed.
  const initial = parseMapping(value);
  const [rows, setRows] = useState<TMappingRow[]>(initial.rows);
  const [malformed] = useState<boolean>(initial.malformed);

  const commit = (next: TMappingRow[]) => {
    setRows(next);
    onChange(serializeMapping(next));
  };

  const update = (index: number, patch: Partial<TMappingRow>) =>
    commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-2">
      {malformed && (
        <div className="flex items-start gap-2 rounded-md bg-layer-1 p-2 text-13 text-tertiary">
          <TriangleAlert className="text-amber-500 mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The saved value could not be read as a group map, so nothing is shown below. Adding rows and saving will
            replace it.
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_9rem_2rem] gap-2 text-12 text-tertiary">
          <span>Group</span>
          <span>Workspace slug</span>
          <span>Role</span>
          <span />
        </div>
      )}

      {rows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-[1fr_1fr_9rem_2rem] items-center gap-2">
          <Input
            value={row.group}
            onChange={(e) => update(index, { group: e.target.value })}
            placeholder="psyclo/admin"
            className="w-full"
          />
          <Input
            value={row.workspace}
            onChange={(e) => update(index, { workspace: e.target.value })}
            placeholder="psyclopedia"
            className="w-full"
          />
          <select
            value={row.role}
            onChange={(e) => update(index, { role: e.target.value })}
            className={cn(
              "h-[38px] w-full rounded-md border border-strong bg-layer-1 px-2 text-13",
              "focus:ring-accent-primary focus:ring-1 focus:outline-none"
            )}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Remove mapping"
            onClick={() => commit(rows.filter((_, i) => i !== index))}
            className="hover:text-danger flex h-8 w-8 items-center justify-center rounded-md text-tertiary hover:bg-layer-2"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => commit([...rows, { id: newRowId(), group: "", workspace: "", role: "MEMBER" }])}
        className="flex w-fit items-center gap-1 text-13 font-medium text-accent-primary hover:underline"
      >
        <Plus className="h-4 w-4" />
        Add mapping
      </button>
    </div>
  );
}
