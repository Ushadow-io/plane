/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
// plane imports
import { cn } from "@plane/utils";
// components
import { DocumentContentLoader, EditorContainer, EditorContentWrapper } from "@/components/editors";
import { BlockMenu, EditorBubbleMenu } from "@/components/menus";
// types
import type { TCollabValue } from "@/contexts";
import type {
  ICollaborativeDocumentEditorPropsExtended,
  IEditorProps,
  IEditorPropsExtended,
  TAIHandler,
  TDisplayConfig,
} from "@/types";

type Props = {
  aiHandler?: TAIHandler;
  bubbleMenuEnabled: boolean;
  disabledExtensions: IEditorProps["disabledExtensions"];
  displayConfig: TDisplayConfig;
  documentLoaderClassName?: string;
  editor: Editor;
  titleEditor?: Editor;
  editorContainerClassName: string;
  extendedDocumentEditorProps?: ICollaborativeDocumentEditorPropsExtended;
  extendedEditorProps: IEditorPropsExtended;
  flaggedExtensions: IEditorProps["flaggedExtensions"];
  id: string;
  isLoading?: boolean;
  isTouchDevice: boolean;
  tabIndex?: number;
  provider?: HocuspocusProvider;
  state?: TCollabValue["state"];
};

export function PageRenderer(props: Props) {
  const {
    aiHandler,
    bubbleMenuEnabled,
    disabledExtensions,
    displayConfig,
    documentLoaderClassName,
    editor,
    editorContainerClassName,
    extendedEditorProps,
    flaggedExtensions,
    id,
    isLoading,
    isTouchDevice,
    tabIndex,
    titleEditor,
    provider,
    state,
  } = props;

  // AI handle popover -- triggered by clicking the "#ai-handle" button the side
  // menu mounts on hover (see AIHandlePlugin). That plugin only sets a
  // NodeSelection on click; it has no route back into React, so the trigger is
  // detected the same way BlockMenu detects "#drag-handle": a global click
  // listener matched against the DOM id, with a virtual Floating UI reference
  // built from the clicked element's own bounding rect.
  const [isAIMenuOpen, setIsAIMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement | null>(null);
  const aiVirtualRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () => new DOMRect(),
  });

  const {
    refs: aiRefs,
    floatingStyles: aiFloatingStyles,
    context: aiContext,
  } = useFloating({
    open: isAIMenuOpen,
    onOpenChange: setIsAIMenuOpen,
    middleware: [offset({ mainAxis: 8, crossAxis: -10 }), flip(), shift()],
    whileElementsMounted: autoUpdate,
    placement: "left-start",
  });
  const aiDismiss = useDismiss(aiContext);
  const { getFloatingProps: getAIFloatingProps } = useInteractions([aiDismiss]);

  useEffect(() => {
    if (!aiHandler?.menu) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const handle = target.closest("#ai-handle");
      if (handle) {
        event.preventDefault();
        aiVirtualRef.current = { getBoundingClientRect: () => handle.getBoundingClientRect() };
        aiRefs.setReference(aiVirtualRef.current);
        setIsAIMenuOpen(true);
        return;
      }
      if (aiMenuRef.current && !aiMenuRef.current.contains(target)) {
        setIsAIMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAIMenuOpen(false);
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [aiHandler?.menu, aiRefs]);

  return (
    <div
      className={cn("frame-renderer w-full flex-grow", {
        "wide-layout": displayConfig.wideLayout,
      })}
    >
      {isLoading ? (
        <DocumentContentLoader className={documentLoaderClassName} />
      ) : (
        <>
          {titleEditor && (
            <div className="relative w-full py-3">
              <EditorContainer
                editor={titleEditor}
                id={id + "-title"}
                isTouchDevice={isTouchDevice}
                editorContainerClassName="page-title-editor bg-transparent py-3 border-none"
                displayConfig={displayConfig}
              >
                <EditorContentWrapper
                  editor={titleEditor}
                  id={id + "-title"}
                  tabIndex={tabIndex}
                  className="no-scrollbar placeholder-placeholder w-full resize-none rounded-none border-none bg-transparent p-0 text-[2rem] leading-[2.375rem] font-bold tracking-[-2%] outline-none"
                />
              </EditorContainer>
            </div>
          )}
          <EditorContainer
            displayConfig={displayConfig}
            editor={editor}
            editorContainerClassName={editorContainerClassName}
            id={id}
            isTouchDevice={isTouchDevice}
            provider={provider}
            state={state}
          >
            <EditorContentWrapper editor={editor} id={id} tabIndex={tabIndex} />
            {editor.isEditable && !isTouchDevice && (
              <div>
                {bubbleMenuEnabled && (
                  <EditorBubbleMenu
                    editor={editor}
                    disabledExtensions={disabledExtensions}
                    extendedEditorProps={extendedEditorProps}
                    flaggedExtensions={flaggedExtensions}
                  />
                )}
                <BlockMenu
                  editor={editor}
                  flaggedExtensions={flaggedExtensions}
                  disabledExtensions={disabledExtensions}
                />
                {isAIMenuOpen && aiHandler?.menu && (
                  <FloatingPortal>
                    <div
                      ref={(node) => {
                        aiRefs.setFloating(node);
                        aiMenuRef.current = node;
                      }}
                      style={{ ...aiFloatingStyles, zIndex: 100 }}
                      {...getAIFloatingProps()}
                    >
                      {aiHandler.menu({ isOpen: isAIMenuOpen, onClose: () => setIsAIMenuOpen(false) })}
                    </div>
                  </FloatingPortal>
                )}
              </div>
            )}
          </EditorContainer>
        </>
      )}
    </div>
  );
}
