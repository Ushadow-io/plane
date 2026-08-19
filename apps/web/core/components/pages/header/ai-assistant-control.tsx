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
// components
import { EditorAIMenu } from "@/components/pages/editor/ai/menu";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  page: TPageInstance;
};

export const PageAIAssistantControl = observer(function PageAIAssistantControl(props: Props) {
  const { page } = props;
  const { workspaceSlug } = useParams();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Button
        className="grid size-6 flex-shrink-0 place-items-center rounded-sm text-secondary transition-colors hover:bg-layer-1 hover:text-primary"
        aria-label="Ask AI"
      >
        <Sparkles className="size-3.5" />
      </Popover.Button>
      <Popover.Panel side="bottom" align="end" className="border-none bg-transparent p-0 shadow-none">
        <EditorAIMenu
          editorRef={page.editor.editorRef}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          workspaceSlug={workspaceSlug?.toString() ?? ""}
        />
      </Popover.Panel>
    </Popover>
  );
});
