/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TInstanceAIConfigurationKeys =
  | "LLM_API_KEY"
  | "LLM_MODEL"
  | "LLM_PROVIDER"
  | "LLM_BASE_URL"
  | "LLM_API_VERSION";

/**
 * Keys of SUPPORTED_PROVIDERS in the API's external/base.py. The string is sent
 * verbatim as LLM_PROVIDER and looked up there, so the two lists must agree.
 */
export type TLLMProviderKey = "openai" | "azure" | "custom" | "anthropic" | "gemini";
