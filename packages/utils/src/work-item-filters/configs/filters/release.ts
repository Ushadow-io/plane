/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { IRelease, TFilterProperty } from "@plane/types";
import { EQUALITY_OPERATOR, COLLECTION_OPERATOR } from "@plane/types";
// local imports
import type { TCreateFilterConfigParams, IFilterIconConfig, TCreateFilterConfig } from "../../../rich-filters";
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";

/**
 * Release filter specific params
 */
export type TCreateReleaseFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<undefined> & {
    releases: IRelease[];
  };

/**
 * Helper to get the release multi select config
 * @param params - The filter params
 * @returns The release multi select config
 */
export const getReleaseMultiSelectConfig = (params: TCreateReleaseFilterParams) =>
  getMultiSelectConfig<IRelease, string, undefined>(
    {
      items: params.releases,
      getId: (release) => release.id,
      getLabel: (release) => release.name,
      getValue: (release) => release.id,
      getIconData: () => undefined,
    },
    {
      singleValueOperator: EQUALITY_OPERATOR.EXACT,
      ...params,
    },
    {
      ...params,
    }
  );

/**
 * Get the release filter config
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the release filter config
 */
export const getReleaseFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateReleaseFilterParams> =>
  (params: TCreateReleaseFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: "Release",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getReleaseMultiSelectConfig(updatedParams)
        ),
      ]),
    });
