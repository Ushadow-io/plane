/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Sparkles } from "lucide-react";
// plane imports
import { Popover } from "@plane/propel/popover";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// components
import { EditorAIMenu } from "@/components/pages/editor/ai/menu";
// hooks
import { EPageStoreType, usePageStore } from "@/hooks/store";

// Global entry point, always available regardless of what's open. When a page
// is the current route (pageId present in the URL), we look that page up and
// hand its editorRef through so responses can still be written into it --
// otherwise there's nothing to insert into, and editorRef stays null (AskPiMenu
// hides the insert/replace controls when that's the case).
export const TopNavAIAssistant = observer(function TopNavAIAssistant() {
  const { workspaceSlug, pageId } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  // store hooks
  const { getPageById } = usePageStore(EPageStoreType.PROJECT);
  // derived values
  const currentPage = pageId ? getPageById(pageId.toString()) : undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip tooltipContent="Ask AI" position="bottom">
        <Popover.Button className="group flex flex-col items-center justify-center gap-0.5 text-tertiary">
          <div
            className={cn("flex size-8 items-center justify-center gap-2 rounded-md text-tertiary", {
              "bg-layer-transparent-selected !text-icon-primary text-secondary": isOpen,
              "!text-icon-tertiary group-hover:bg-layer-transparent-hover group-hover:text-icon-secondary": !isOpen,
            })}
          >
            <Sparkles className="size-5" />
          </div>
        </Popover.Button>
      </Tooltip>
      {/* z-[9999] on the positioner: PopoverPositioner (root.tsx) is what's actually
          position-fixed, and this had no z-index at all -- it stacked at the
          implicit z-index:0 of whatever DOM position it portalled to, so a
          later-mounted overlay with any explicit z-index could render over it. */}
      <Popover.Panel
        side="bottom"
        align="end"
        className="border-none bg-transparent p-0 shadow-none"
        positionerClassName="z-[9999]"
      >
        <EditorAIMenu
          editorRef={currentPage?.editor.editorRef ?? null}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          workspaceSlug={workspaceSlug?.toString() ?? ""}
        />
      </Popover.Panel>
    </Popover>
  );
});
