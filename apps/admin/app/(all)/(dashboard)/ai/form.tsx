/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useForm } from "react-hook-form";
import { Lightbulb } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceAIConfigurationKeys, TLLMProviderKey } from "@plane/types";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSelectOption } from "@/components/common/controller-select";
import { ControllerSelect } from "@/components/common/controller-select";
// hooks
import { useInstance } from "@/hooks/store";

type IInstanceAIForm = {
  config: IFormattedInstanceConfiguration;
};

type AIFormValues = Record<TInstanceAIConfigurationKeys, string>;

const PROVIDER_OPTIONS: TControllerSelectOption[] = [
  { value: "openai", label: "OpenAI" },
  { value: "azure", label: "Azure OpenAI / AI Foundry" },
  { value: "custom", label: "OpenAI-compatible endpoint" },
];

/**
 * Providers that talk to an endpoint we host rather than a vendor's public API,
 * and so need a base URL. Mirrors `requires_base_url` on the API's provider
 * classes — the server enforces it too, this only decides what the form shows.
 */
const PROVIDERS_NEEDING_ENDPOINT = new Set<string>(["azure", "custom"]);

export function InstanceAIForm(props: IInstanceAIForm) {
  const { config } = props;
  // store
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AIFormValues>({
    defaultValues: {
      LLM_API_KEY: config["LLM_API_KEY"],
      LLM_MODEL: config["LLM_MODEL"],
      // Instances configured before this section grew a provider selector have no
      // LLM_PROVIDER row yet. "openai" is what the API assumes in that case, so
      // defaulting to anything else here would misreport the live behaviour.
      LLM_PROVIDER: config["LLM_PROVIDER"] || "openai",
      LLM_BASE_URL: config["LLM_BASE_URL"] || "",
      LLM_API_VERSION: config["LLM_API_VERSION"] || "",
    },
  });

  const provider = (watch("LLM_PROVIDER") || "openai") as TLLMProviderKey;
  const needsEndpoint = PROVIDERS_NEEDING_ENDPOINT.has(provider);
  const isAzure = provider === "azure";

  const modelField: TControllerInputFormField = isAzure
    ? {
        key: "LLM_MODEL",
        type: "text",
        label: "Deployment name",
        description: (
          <>
            The name you gave the deployment in Azure AI Foundry — not the underlying model id. These often match, but
            Azure does not require it.
          </>
        ),
        placeholder: "gpt-4o",
        error: Boolean(errors.LLM_MODEL),
        required: true,
      }
    : {
        key: "LLM_MODEL",
        type: "text",
        label: "LLM Model",
        description:
          provider === "custom" ? (
            <>The model id as your endpoint serves it — check its /v1/models listing if you are unsure.</>
          ) : (
            <>
              Choose an OpenAI engine.{" "}
              <a
                href="https://platform.openai.com/docs/models/overview"
                target="_blank"
                className="text-accent-primary hover:underline"
                rel="noreferrer"
                aria-label="OpenAI models documentation"
              >
                Learn more
              </a>
            </>
          ),
        placeholder: "gpt-4o-mini",
        error: Boolean(errors.LLM_MODEL),
        required: false,
      };

  const apiKeyField: TControllerInputFormField = {
    key: "LLM_API_KEY",
    type: "password",
    label: "API key",
    description: isAzure ? (
      <>Either key from the resource&apos;s Keys and Endpoint blade in the Azure portal.</>
    ) : provider === "custom" ? (
      <>Sent as a bearer token. Leave a placeholder if your endpoint does not check it.</>
    ) : (
      <>
        You will find your API key{" "}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          className="text-accent-primary hover:underline"
          rel="noreferrer"
          aria-label="OpenAI API keys page"
        >
          here.
        </a>
      </>
    ),
    placeholder: isAzure ? "your Azure resource key" : "sk-asddassdfasdefqsdfasd23das3dasdcasd",
    error: Boolean(errors.LLM_API_KEY),
    required: false,
  };

  const endpointField: TControllerInputFormField = {
    key: "LLM_BASE_URL",
    type: "text",
    label: "Endpoint",
    description: isAzure ? (
      <>
        The resource root only. The SDK appends /openai/deployments/… itself, so do not paste the full target URI shown
        in the portal.
      </>
    ) : (
      <>Full base URL, usually ending in /v1.</>
    ),
    placeholder: isAzure ? "https://your-resource.openai.azure.com" : "https://your-host/v1",
    error: Boolean(errors.LLM_BASE_URL),
    required: true,
  };

  const apiVersionField: TControllerInputFormField = {
    key: "LLM_API_VERSION",
    type: "text",
    label: "API version",
    description: (
      <>Azure pins request and response shape to a dated version. Leave as-is unless you need a newer one.</>
    ),
    placeholder: "2024-10-21",
    error: Boolean(errors.LLM_API_VERSION),
    required: true,
  };

  const aiFormFields: TControllerInputFormField[] = [
    modelField,
    apiKeyField,
    ...(needsEndpoint ? [endpointField] : []),
    ...(isAzure ? [apiVersionField] : []),
  ];

  const onSubmit = async (formData: AIFormValues) => {
    // Only send what the chosen provider actually uses. Posting a stale endpoint
    // alongside provider "openai" would persist a value the UI no longer shows,
    // which then reappears if someone switches back to Azure later.
    const payload: Partial<AIFormValues> = {
      LLM_PROVIDER: formData.LLM_PROVIDER,
      LLM_MODEL: formData.LLM_MODEL,
      LLM_API_KEY: formData.LLM_API_KEY,
      ...(needsEndpoint ? { LLM_BASE_URL: formData.LLM_BASE_URL } : {}),
      ...(isAzure ? { LLM_API_VERSION: formData.LLM_API_VERSION } : {}),
    };

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Success",
          message: "AI Settings updated successfully",
        })
      )
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">LLM provider</div>
          <div className="text-13 font-regular text-tertiary">
            Point Plane&apos;s AI features at OpenAI, an Azure OpenAI deployment, or any endpoint that speaks the OpenAI
            chat-completions format.
          </div>
        </div>
        <div className="grid-col grid w-full grid-cols-1 items-center justify-between gap-x-12 gap-y-8 lg:grid-cols-3">
          <ControllerSelect
            control={control}
            name="LLM_PROVIDER"
            label="Provider"
            options={PROVIDER_OPTIONS}
            description={<>Determines which of the fields below are used.</>}
            error={Boolean(errors.LLM_PROVIDER)}
            required
          />
          {aiFormFields.map((field) => (
            <ControllerInput
              key={field.key}
              control={control}
              type={field.type}
              name={field.key}
              label={field.label}
              description={field.description}
              placeholder={field.placeholder}
              error={field.error}
              required={field.required}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start gap-4">
        <Button variant="primary" size="lg" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
          {isSubmitting ? "Saving" : "Save changes"}
        </Button>

        <div className="relative inline-flex items-center gap-1.5 rounded-sm border border-accent-subtle bg-accent-subtle px-4 py-2 text-caption-sm-regular text-accent-secondary">
          <Lightbulb className="size-4" />
          <div>
            Settings saved here take effect immediately and override anything set in the deployment&apos;s environment.
          </div>
        </div>
      </div>
    </div>
  );
}
