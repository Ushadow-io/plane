/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Maximize } from "lucide-react";
import { useEffect } from "react";
// plane imports
import { Tooltip } from "@plane/propel/tooltip";

type Props = {
  isFullScreenEnabled: boolean;
  isTouchDevice: boolean;
  setIsFullScreenEnabled: (val: boolean) => void;
  toggleToolbarViewStatus: (val: boolean) => void;
};

export function ImageFullScreenActionRoot(props: Props) {
  const { isFullScreenEnabled, isTouchDevice, setIsFullScreenEnabled, toggleToolbarViewStatus } = props;

  useEffect(() => {
    toggleToolbarViewStatus(isFullScreenEnabled);
  }, [isFullScreenEnabled, toggleToolbarViewStatus]);

  return (
    <Tooltip tooltipContent="View in full screen" disabled={isTouchDevice}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsFullScreenEnabled(true);
        }}
        className="grid h-full flex-shrink-0 place-items-center text-on-color/60 transition-colors hover:text-on-color"
        aria-label="View image in full screen"
      >
        <Maximize className="size-3" />
      </button>
    </Tooltip>
  );
}
