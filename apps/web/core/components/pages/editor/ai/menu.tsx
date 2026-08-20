/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
// plane editor
import type { EditorRefApi } from "@plane/editor";
// plane web services
import { AIService } from "@/services/ai.service";
import { AskPiMenu } from "./ask-pi-menu";
const aiService = new AIService();

// `task` is prefixed onto the user's prompt server-side (see get_llm_response in
// apps/api/plane/app/views/external/base.py) -- it functions as the system
// instruction, not a task identifier.
const ASK_PI_TASK =
  "You are Pi, a helpful writing assistant embedded in a document editor. Answer the user's question or " +
  "follow their instruction concisely, replying in plain text or simple markdown.";

type Props = {
  editorRef: EditorRefApi | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
};

export function EditorAIMenu(props: Props) {
  const { editorRef, isOpen, onClose, workspaceSlug } = props;
  // states
  const [response, setResponse] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (query: string) => {
      if (!query.trim() || !workspaceSlug || isSubmitting) return;
      setIsSubmitting(true);
      try {
        const res = await aiService.createGptTask(workspaceSlug.toString(), {
          prompt: query,
          task: ASK_PI_TASK,
        });
        setResponse(res?.response);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [workspaceSlug, isSubmitting]
  );

  // No editor to insert into from a context-free launch point (e.g. the
  // global nav's Ask AI button) -- AskPiMenu hides the insert controls when
  // this is undefined.
  const handleInsertText = editorRef
    ? (insertOnNextLine: boolean) => {
        if (!response) return;
        editorRef.insertText(response, insertOnNextLine);
        onClose();
      }
    : undefined;

  // reset on close
  useEffect(() => {
    if (!isOpen) setResponse(undefined);
  }, [isOpen]);

  return (
    // 440px (was 360px) and a viewport-relative max-height: at 360px, a
    // several-paragraph response wrapped so tightly it read as cut off, and
    // with no bound here the panel could grow past the popover's collision
    // boundary and get clipped outright instead of scrolling (the response
    // area handles its own overflow-y-auto -- see ask-pi-menu.tsx).
    <div className="flex max-h-[70vh] w-[440px] flex-col overflow-hidden rounded-md border-[0.5px] border-strong bg-surface-1 shadow-raised-200 transition-all">
      <AskPiMenu
        handleInsertText={handleInsertText}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        response={response}
        workspaceSlug={workspaceSlug}
      />
      <div className="flex items-center gap-2 rounded-b-md border-t border-subtle bg-surface-2 px-4 py-2 text-tertiary">
        <span className="grid size-4 flex-shrink-0 place-items-center">
          <TriangleAlert className="size-3" />
        </span>
        <p className="flex-shrink-0 text-11 font-medium">
          By using this feature, you consent to sharing the message with a 3rd party service.
        </p>
      </div>
    </div>
  );
}
