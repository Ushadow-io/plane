/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles } from "lucide-react";
// plane imports
import { Popover } from "@plane/propel/popover";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// components
import { EditorAIMenu } from "@/components/pages/editor/ai/menu";

// Global entry point, always available regardless of what's open -- there's no
// document to insert a response into here, so it's launched with editorRef:
// null (AskPiMenu hides the insert/replace controls when that's the case).
export function TopNavAIAssistant() {
  const { workspaceSlug } = useParams();
  const [isOpen, setIsOpen] = useState(false);

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
          editorRef={null}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          workspaceSlug={workspaceSlug?.toString() ?? ""}
        />
      </Popover.Panel>
    </Popover>
  );
}
