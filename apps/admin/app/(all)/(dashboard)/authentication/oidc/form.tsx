/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { isEmpty } from "lodash-es";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceOIDCAuthenticationConfigurationKeys } from "@plane/types";
// components
import { CodeBlock } from "@/components/common/code-block";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type OIDCConfigFormValues = Record<TInstanceOIDCAuthenticationConfigurationKeys, string>;

const OIDC_FORM_SWITCH_FIELD: TControllerSwitchFormField<OIDCConfigFormValues> = {
  name: "ENABLE_OIDC_SYNC",
  label: "OpenID Connect",
};

export function InstanceOIDCConfigForm(props: Props) {
  const { config } = props;
  // states
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
  // store hooks
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<OIDCConfigFormValues>({
    defaultValues: {
      OIDC_ISSUER: config["OIDC_ISSUER"],
      OIDC_CLIENT_ID: config["OIDC_CLIENT_ID"],
      OIDC_CLIENT_SECRET: config["OIDC_CLIENT_SECRET"],
      OIDC_DISPLAY_NAME: config["OIDC_DISPLAY_NAME"] || "Single sign-on",
      OIDC_ADDITIONAL_SCOPES: config["OIDC_ADDITIONAL_SCOPES"] || "",
      OIDC_CALLBACK_HOSTS: config["OIDC_CALLBACK_HOSTS"] || "",
      ENABLE_OIDC_SYNC: config["ENABLE_OIDC_SYNC"] || "0",
    },
  });

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const OIDC_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "OIDC_ISSUER",
      type: "text",
      label: "Issuer URL",
      description: (
        <>
          The base URL of your identity provider. Plane reads{" "}
          <CodeBlock darkerShade>/.well-known/openid-configuration</CodeBlock> from it to discover the authorize, token
          and userinfo endpoints, so no other URLs are needed.
        </>
      ),
      placeholder: "https://auth.example.com",
      error: Boolean(errors.OIDC_ISSUER),
      required: true,
    },
    {
      key: "OIDC_CLIENT_ID",
      type: "text",
      label: "Client ID",
      description: <>The client ID of the application you registered with your identity provider.</>,
      placeholder: "b1a2c3d4e5f60718293a",
      error: Boolean(errors.OIDC_CLIENT_ID),
      required: true,
    },
    {
      key: "OIDC_CLIENT_SECRET",
      type: "password",
      label: "Client secret",
      description: <>The client secret issued alongside the client ID.</>,
      placeholder: "9b0050f94ec1b744e32ce79ea4ffacd40d4119cb",
      error: Boolean(errors.OIDC_CLIENT_SECRET),
      required: true,
    },
    {
      key: "OIDC_DISPLAY_NAME",
      type: "text",
      label: "Button label",
      description: (
        <>
          Shown on the sign-in screen as &quot;Continue with &hellip;&quot;. Name it after your provider, e.g.
          &quot;Casdoor&quot; or &quot;Company SSO&quot;.
        </>
      ),
      placeholder: "Single sign-on",
      error: Boolean(errors.OIDC_DISPLAY_NAME),
      required: false,
    },
    {
      key: "OIDC_ADDITIONAL_SCOPES",
      type: "text",
      label: "Additional scopes",
      description: (
        <>
          Optional, space-separated. <CodeBlock darkerShade>openid email profile</CodeBlock> are always requested and do
          not need to be listed here.
        </>
      ),
      placeholder: "groups offline_access",
      error: Boolean(errors.OIDC_ADDITIONAL_SCOPES),
      required: false,
    },
    {
      key: "OIDC_CALLBACK_HOSTS",
      type: "text",
      label: "Additional origins",
      description: (
        <>
          Optional. Every origin Plane is reachable on, comma or space separated. Plane derives the callback URI from
          the host of each request, so a user signing in via a second hostname sends a different{" "}
          <CodeBlock darkerShade>redirect_uri</CodeBlock> &mdash; and your provider rejects it unless that exact URI is
          registered. List the origins here and every URI to register appears on the right.
        </>
      ),
      placeholder: "https://plane.example.com https://plane.internal.example",
      error: Boolean(errors.OIDC_CALLBACK_HOSTS),
      required: false,
    },
  ];

  // Watched rather than read off control._formValues so the URI list below
  // updates as the admin types, instead of only after a save.
  const callbackHosts = useWatch({ control, name: "OIDC_CALLBACK_HOSTS" });

  // The instance's own origin always needs registering; anything the admin
  // lists is added to it. Trailing slashes are trimmed so the same origin
  // written two ways does not produce two entries.
  const callbackOrigins = Array.from(
    new Set(
      [originURL, ...(callbackHosts || "").split(/[\s,]+/)]
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter((origin) => /^https?:\/\//.test(origin))
    )
  );

  const OIDC_SERVICE_FIELD: TCopyField[] = callbackOrigins.map((origin, index) => ({
    key: `Callback_URI_${origin}`,
    label: callbackOrigins.length > 1 ? `Callback URI ${index + 1}` : "Callback URI",
    url: `${origin}/auth/oidc/callback/`,
    description:
      index === 0 ? (
        <>
          We will auto-generate these. Paste <em>every</em> one into the <CodeBlock darkerShade>Redirect URI</CodeBlock>{" "}
          list of the application you registered with your identity provider &mdash; a sign-in from an origin that is
          not registered is rejected before the login page renders.
        </>
      ) : undefined,
  }));

  const onSubmit = async (formData: OIDCConfigFormValues) => {
    const payload: Partial<OIDCConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Done!",
        message: "Your OpenID Connect authentication is configured. You should test it now.",
      });
      reset({
        OIDC_ISSUER: response.find((item) => item.key === "OIDC_ISSUER")?.value,
        OIDC_CLIENT_ID: response.find((item) => item.key === "OIDC_CLIENT_ID")?.value,
        OIDC_CLIENT_SECRET: response.find((item) => item.key === "OIDC_CLIENT_SECRET")?.value,
        OIDC_DISPLAY_NAME: response.find((item) => item.key === "OIDC_DISPLAY_NAME")?.value,
        OIDC_ADDITIONAL_SCOPES: response.find((item) => item.key === "OIDC_ADDITIONAL_SCOPES")?.value,
        OIDC_CALLBACK_HOSTS: response.find((item) => item.key === "OIDC_CALLBACK_HOSTS")?.value,
        ENABLE_OIDC_SYNC: response.find((item) => item.key === "ENABLE_OIDC_SYNC")?.value,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
          <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
            <div className="pt-2.5 text-18 font-medium">Provider-provided details for Plane</div>
            {OIDC_FORM_FIELDS.map((field) => (
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
            <ControllerSwitch control={control} field={OIDC_FORM_SWITCH_FIELD} />
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={(e) => void handleSubmit(onSubmit)(e)}
                  loading={isSubmitting}
                  disabled={!isDirty}
                >
                  {isSubmitting ? "Saving" : "Save changes"}
                </Button>
                <Link href="/authentication" className={getButtonStyling("secondary", "lg")} onClick={handleGoBack}>
                  Go back
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 pt-1.5 pb-4">
              <div className="pt-2 text-18 font-medium">Plane-provided details for your provider</div>
              {OIDC_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
