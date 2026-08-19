/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { CircleArrowUp, CornerDownRight, RefreshCcw, Sparkles } from "lucide-react";
// ui
import { Tooltip } from "@plane/propel/tooltip";
// components
import { cn } from "@plane/utils";
import { RichTextEditor } from "@/components/editor/rich-text";
// helpers
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";

type Props = {
  // Omitted when there's no document open to insert into (e.g. the global
  // nav's Ask AI button) -- Replace/insert controls are hidden in that case.
  handleInsertText?: (insertOnNextLine: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (query: string) => void;
  response: string | undefined;
  workspaceSlug: string;
};

export function AskPiMenu(props: Props) {
  const { handleInsertText, isSubmitting, onSubmit, response, workspaceSlug } = props;
  // states
  const [query, setQuery] = useState("");
  // store hooks
  const { getWorkspaceBySlug } = useWorkspace();
  // derived values
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";

  const handleSubmit = () => {
    if (!query.trim() || isSubmitting) return;
    onSubmit(query);
  };

  return (
    <>
      <div
        className={cn("flex items-center gap-3 px-4 py-3.5", {
          "items-start": response,
        })}
      >
        <span className="grid size-7 flex-shrink-0 place-items-center rounded-full border border-subtle text-secondary">
          <Sparkles className="size-3" />
        </span>
        {response ? (
          <div>
            <RichTextEditor
              editable={false}
              displayConfig={{
                fontSize: "small-font",
              }}
              id="editor-ai-response"
              initialValue={response}
              containerClassName="!p-0 border-none"
              editorClassName="!pl-0"
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
            />
            <div className="mt-3 flex items-center gap-4">
              {handleInsertText && (
                <>
                  <button
                    type="button"
                    className="rounded-sm p-1 text-13 font-medium text-tertiary outline-none hover:bg-layer-1"
                    onClick={() => handleInsertText(false)}
                  >
                    Replace selection
                  </button>
                  <Tooltip tooltipContent="Add to next line">
                    <button
                      type="button"
                      className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1"
                      onClick={() => handleInsertText(true)}
                    >
                      <CornerDownRight className="size-4 text-tertiary" />
                    </button>
                  </Tooltip>
                </>
              )}
              <Tooltip tooltipContent="Re-generate response">
                <button
                  type="button"
                  className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit();
                  }}
                  disabled={isSubmitting}
                >
                  <RefreshCcw
                    className={cn("size-4 text-tertiary", {
                      "animate-spin": isSubmitting,
                    })}
                  />
                </button>
              </Tooltip>
            </div>
          </div>
        ) : (
          <p className="text-13 text-secondary">
            {isSubmitting ? "Pi is generating a response..." : "Ask Pi anything about this document."}
          </p>
        )}
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-subtle p-2">
          <span className="grid size-3 flex-shrink-0 place-items-center">
            <Sparkles className="size-3 text-secondary" />
          </span>
          <input
            type="text"
            className="w-full border-none bg-transparent text-13 outline-none placeholder:text-placeholder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={isSubmitting}
            placeholder="Tell AI what to do..."
          />
          <button
            type="button"
            className="grid size-4 flex-shrink-0 place-items-center disabled:opacity-40"
            onClick={handleSubmit}
            disabled={isSubmitting || !query.trim()}
            aria-label="Ask Pi"
          >
            <CircleArrowUp className="size-4 text-secondary" />
          </button>
        </div>
      </div>
    </>
  );
}
