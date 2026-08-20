# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Generic OpenID Connect provider.

Unlike the other providers in this package, this one hardcodes no endpoints.
It reads a single ``OIDC_ISSUER`` from instance configuration and resolves
``authorization_endpoint`` / ``token_endpoint`` / ``userinfo_endpoint`` from
the issuer's discovery document, so one provider serves Casdoor, Keycloak,
Authentik, Auth0, Okta or anything else that implements OIDC Discovery 1.0.

Trust model: ``OIDC_ISSUER`` is set by an instance admin through God Mode, so
it is treated as trusted configuration in the same way ``GITLAB_HOST`` and
``GITEA_HOST`` already are - the discovery fetch is not SSRF-guarded. The
``picture`` claim, by contrast, is attacker-influenceable profile data and is
downloaded through the pinned, redirect-revalidating client in
``Adapter.download_and_upload_avatar`` (GHSA-cv9p-325g-wmv5).
"""

# Python imports
import logging
import os
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse

# Third party imports
import pytz
import requests

# Django imports
from django.core.cache import cache

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value

# Discovery runs inside __init__ *before* super().__init__() has attached
# the instance's own logger, so this module keeps a handle on the same one.
logger = logging.getLogger("plane.authentication")

# Discovery documents are stable; re-fetching one per sign-in would add two
# round trips to every login (the provider is constructed on both the initiate
# and the callback leg).
DISCOVERY_CACHE_TTL = 60 * 60
DISCOVERY_TIMEOUT = 10

# Mandated by the spec / needed for the claims we map below. Operator-supplied
# scopes in OIDC_ADDITIONAL_SCOPES are appended to these, never replace them.
REQUIRED_SCOPES = ["openid", "email", "profile"]


class OIDCProvider(OauthAdapter):
    provider = "oidc"

    def __init__(self, request, code=None, state=None, callback=None):
        (
            OIDC_ISSUER,
            OIDC_CLIENT_ID,
            OIDC_CLIENT_SECRET,
            OIDC_ADDITIONAL_SCOPES,
        ) = get_configuration_value(
            [
                {"key": "OIDC_ISSUER", "default": os.environ.get("OIDC_ISSUER")},
                {"key": "OIDC_CLIENT_ID", "default": os.environ.get("OIDC_CLIENT_ID")},
                {"key": "OIDC_CLIENT_SECRET", "default": os.environ.get("OIDC_CLIENT_SECRET")},
                {
                    "key": "OIDC_ADDITIONAL_SCOPES",
                    "default": os.environ.get("OIDC_ADDITIONAL_SCOPES", ""),
                },
            ]
        )

        if not (OIDC_ISSUER and OIDC_CLIENT_ID and OIDC_CLIENT_SECRET):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        issuer = self.__normalize_issuer(OIDC_ISSUER)
        config = self.__get_discovery_document(issuer)

        self.token_url = config["token_endpoint"]
        self.userinfo_url = config["userinfo_endpoint"]
        authorization_endpoint = config["authorization_endpoint"]

        # Union rather than override: dropping "openid" would take the flow out
        # of OIDC entirely, and dropping "email" would break account matching.
        extra = [s for s in (OIDC_ADDITIONAL_SCOPES or "").replace(",", " ").split() if s not in REQUIRED_SCOPES]
        self.scope = " ".join(REQUIRED_SCOPES + extra)

        redirect_uri = f"{'https' if request.is_secure() else 'http'}://{request.get_host()}/auth/oidc/callback/"
        url_params = {
            "client_id": OIDC_CLIENT_ID,
            "scope": self.scope,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        auth_url = f"{authorization_endpoint}?{urlencode(url_params)}"

        super().__init__(
            request,
            self.provider,
            OIDC_CLIENT_ID,
            self.scope,
            redirect_uri,
            auth_url,
            self.token_url,
            self.userinfo_url,
            OIDC_CLIENT_SECRET,
            code,
            callback=callback,
        )

    @staticmethod
    def __normalize_issuer(issuer):
        """Require an http(s) issuer and strip trailing slashes."""
        parsed = urlparse(issuer)
        if parsed.scheme not in ("https", "http") or not parsed.netloc:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                # Deliberately opaque: this string is echoed into a redirect
                # query param, so it must not leak the configured value.
                error_message="OIDC_NOT_CONFIGURED",
            )
        return issuer.rstrip("/")

    @staticmethod
    def __get_discovery_document(issuer):
        """
        Resolve the issuer's endpoints, memoised for DISCOVERY_CACHE_TTL.

        Only the three endpoints Plane uses are cached, so a malformed or
        partial document fails here rather than at token-exchange time.
        """
        cache_key = f"oidc:discovery:{issuer}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            response = requests.get(
                f"{issuer}/.well-known/openid-configuration",
                headers={"Accept": "application/json"},
                timeout=DISCOVERY_TIMEOUT,
            )
            response.raise_for_status()
            document = response.json()
        except (requests.RequestException, ValueError):
            logger.warning("OIDC discovery failed for the configured issuer")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        # An issuer that advertises a different identity than the one we were
        # configured with is a mix-up attack indicator (RFC 8414 s3.3).
        if document.get("issuer", "").rstrip("/") != issuer:
            logger.warning("OIDC discovery document issuer does not match the configured issuer")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        config = {}
        for key in ("authorization_endpoint", "token_endpoint", "userinfo_endpoint"):
            value = document.get(key)
            if not value:
                logger.warning("OIDC discovery document is missing a required endpoint")
                raise AuthenticationException(
                    error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                    error_message="OIDC_NOT_CONFIGURED",
                )
            config[key] = value

        cache.set(cache_key, config, DISCOVERY_CACHE_TTL)
        return config

    def set_token_data(self):
        data = {
            "code": self.code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        headers = {"Accept": "application/json"}
        token_response = self.get_user_token(data=data, headers=headers)
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.now(tz=pytz.utc) + timedelta(seconds=token_response.get("expires_in"))
                    if token_response.get("expires_in")
                    else None
                ),
                "refresh_token_expired_at": (
                    datetime.now(tz=pytz.utc) + timedelta(seconds=token_response.get("refresh_expires_in"))
                    if token_response.get("refresh_expires_in")
                    else None
                ),
                "id_token": token_response.get("id_token", ""),
            }
        )

    @staticmethod
    def __get_names(user_info_response):
        """
        Map OIDC name claims onto Plane's first_name / last_name pair.

        Casdoor serves userinfo in one of two shapes depending on the
        application's subType: the standard-claims shape (name = display name,
        preferred_username = username) or its native shape (displayName =
        display name, name = username). "name" therefore means different
        things in each, so the unambiguous "displayName" is consulted first
        and bare "name" only after it.
        """
        given = (user_info_response.get("given_name") or "").strip()
        family = (user_info_response.get("family_name") or "").strip()
        if given or family:
            return given, family

        display = (user_info_response.get("displayName") or user_info_response.get("name") or "").strip()
        if display:
            first, _, last = display.partition(" ")
            return first, last.strip()

        return (user_info_response.get("preferred_username") or "").strip(), ""

    @staticmethod
    def __get_avatar(user_info_response):
        """Standard "picture" claim, falling back to Casdoor's native fields."""
        for key in ("picture", "avatar", "permanentAvatar"):
            value = (user_info_response.get(key) or "").strip()
            if value:
                return value
        return None

    def resolve_verified_email(self, user_info_response):
        """
        Decide which address to trust from the userinfo claims.

        Returns the email to bind the Plane account to, or raises
        AuthenticationException if none may be trusted.

        Policy: require email_verified, matching the Gitea provider's
        post-GHSA-7j95-vh8g-f365 behaviour. Plane matches an OAuth identity to
        an existing account by address, so trusting an unverified claim would
        let anyone who can assert an address take over that account.

        Note for Casdoor operators: Casdoor hardcodes email_verified to true in
        its userinfo response (object/user.go - the line reading the real user
        field is commented out), so this check always passes there and provides
        no protection on its own. Control who may sign up in Casdoor instead.
        The check is still worth keeping: IdPs that honour the flag - Keycloak,
        Authentik, Auth0 - get the protection, and it costs Casdoor nothing.
        """
        email = (user_info_response.get("email") or "").strip().lower()
        if not email:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR: No email claim returned",
            )

        # OIDC types email_verified as a boolean, but several IdPs return the
        # string "true", so both spellings are accepted.
        verified = user_info_response.get("email_verified")
        if verified is True or (isinstance(verified, str) and verified.lower() == "true"):
            return email

        raise AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["OAUTH_PROVIDER_UNVERIFIED_EMAIL"],
            error_message="OAUTH_PROVIDER_UNVERIFIED_EMAIL",
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()

        # "sub" is the only claim OIDC guarantees is stable and unique per
        # issuer. Email can be reassigned by an admin, so the account link is
        # keyed on sub, never on the address.
        subject = user_info_response.get("sub")
        if not subject:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR: No sub claim returned",
            )

        email = self.resolve_verified_email(user_info_response)
        first_name, last_name = self.__get_names(user_info_response)

        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": str(subject),
                    "email": email,
                    "avatar": self.__get_avatar(user_info_response),
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_password_autoset": True,
                },
            }
        )
