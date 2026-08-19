# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python import
import json
import os
from dataclasses import dataclass
from typing import List, Dict, Tuple

# Third party import
from openai import AzureOpenAI, OpenAI
import requests

from rest_framework import status
from rest_framework.response import Response

# Module import
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import ProjectLiteSerializer, WorkspaceLiteSerializer
from plane.db.models import Project, Workspace
from plane.license.utils.instance_value import get_configuration_value
from plane.utils.exception_logger import log_exception

from .mcp_client import PlaneMCPClient, PlaneMCPError, mcp_tools_to_openai_schema
from ..base import BaseAPIView


class LLMProvider:
    """Base class for LLM provider configurations"""

    name: str = ""
    models: List[str] = []
    default_model: str = ""
    #: Is `models` an exhaustive allowlist? True for the public vendor APIs, where
    #: the set of model ids is fixed and a typo is worth catching before we spend a
    #: round trip. False for self-deployed backends (Azure, OpenAI-compatible),
    #: where the id is a DEPLOYMENT NAME the operator invented — there is nothing
    #: to check it against short of querying the endpoint.
    validates_models: bool = True
    #: Does this provider need LLM_BASE_URL set? A public API has one well-known
    #: host baked into the SDK; a private deployment does not, and calling one
    #: without an endpoint silently hits api.openai.com with an Azure key.
    requires_base_url: bool = False

    @classmethod
    def get_config(cls) -> Dict[str, str | List[str]]:
        return {
            "name": cls.name,
            "models": cls.models,
            "default_model": cls.default_model,
        }


class OpenAIProvider(LLMProvider):
    name = "OpenAI"
    models = ["gpt-3.5-turbo", "gpt-4o-mini", "gpt-4o", "o1-mini", "o1-preview"]
    default_model = "gpt-4o-mini"


class AnthropicProvider(LLMProvider):
    name = "Anthropic"
    models = [
        "claude-3-5-sonnet-20240620",
        "claude-3-haiku-20240307",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-2.1",
        "claude-2",
        "claude-instant-1.2",
        "claude-instant-1",
    ]
    default_model = "claude-3-sonnet-20240229"


class GeminiProvider(LLMProvider):
    name = "Gemini"
    models = ["gemini-pro", "gemini-1.5-pro-latest", "gemini-pro-vision"]
    default_model = "gemini-pro"


class AzureOpenAIProvider(LLMProvider):
    """Azure OpenAI / Azure AI Foundry.

    `model` here is the DEPLOYMENT name chosen when the model was deployed in the
    Azure portal — not the underlying model id. They are often set to match
    (a "gpt-4o" deployment of gpt-4o), but nothing enforces that, so the
    allowlist the public providers use cannot apply.
    """

    name = "Azure OpenAI"
    models = []
    default_model = ""
    validates_models = False
    requires_base_url = True


class OpenAICompatibleProvider(LLMProvider):
    """Anything else that speaks the OpenAI chat-completions wire format —
    Azure AI Foundry's /openai/v1 surface, vLLM, llama.cpp, LiteLLM, Ollama.

    Exists so a new backend is a God Mode change rather than a fork patch.
    """

    name = "OpenAI-compatible"
    models = []
    default_model = ""
    validates_models = False
    requires_base_url = True


SUPPORTED_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
    "azure": AzureOpenAIProvider,
    "custom": OpenAICompatibleProvider,
}


@dataclass
class LLMConfig:
    """Everything needed to make one chat-completion call.

    A dataclass rather than the tuple this used to return: adding the endpoint and
    API version took it to five positional values, and `api_key, model, provider`
    was already easy to unpack in the wrong order at a call site.
    """

    api_key: str
    model: str
    provider: str
    base_url: str | None
    api_version: str | None


def get_llm_config() -> LLMConfig | None:
    """Read and validate the instance's LLM settings. None means "not usable" —
    the reason is logged, since these are operator settings and the caller only
    ever turns this into one generic 400."""
    api_key, provider_key, model, base_url, api_version = get_configuration_value(
        [
            {
                "key": "LLM_API_KEY",
                "default": os.environ.get("LLM_API_KEY", None),
            },
            {
                "key": "LLM_PROVIDER",
                "default": os.environ.get("LLM_PROVIDER", "openai"),
            },
            {
                "key": "LLM_MODEL",
                "default": os.environ.get("LLM_MODEL", None),
            },
            {
                "key": "LLM_BASE_URL",
                "default": os.environ.get("LLM_BASE_URL", ""),
            },
            {
                "key": "LLM_API_VERSION",
                "default": os.environ.get("LLM_API_VERSION", "2024-10-21"),
            },
        ]
    )

    provider = SUPPORTED_PROVIDERS.get((provider_key or "").lower())
    if not provider:
        log_exception(ValueError(f"Unsupported provider: {provider_key}"))
        return None

    if not api_key:
        log_exception(ValueError(f"Missing API key for provider: {provider.name}"))
        return None

    # Strip here rather than trusting the form: a trailing space on a pasted
    # endpoint produces an httpx URL error a long way from its cause.
    base_url = (base_url or "").strip()
    api_version = (api_version or "").strip()

    if provider.requires_base_url and not base_url:
        # Falling through without this is the dangerous case, not a noisy one:
        # the SDK would default to api.openai.com and send an Azure key there.
        log_exception(ValueError(f"{provider.name} requires an endpoint — set LLM_BASE_URL in God Mode -> AI."))
        return None

    if provider is AzureOpenAIProvider and not api_version:
        log_exception(ValueError("Azure OpenAI requires LLM_API_VERSION (e.g. 2024-10-21)."))
        return None

    # If no model specified, use provider's default
    if not model:
        model = provider.default_model

    if error := _model_config_error(provider, model):
        log_exception(ValueError(error))
        return None

    return LLMConfig(
        api_key=api_key,
        model=model,
        provider=provider_key,
        base_url=base_url or None,
        api_version=api_version or None,
    )


def _model_config_error(provider: type[LLMProvider], model: str | None) -> str | None:
    """Why `model` is unusable for `provider`, or None if it is fine.

    Two different regimes. For the public vendor APIs the model ids are a fixed,
    knowable set, so an unknown one is a typo worth catching here. For a
    self-deployed backend the id is a deployment name the operator chose, so
    there is nothing local to check it against and the endpoint itself is the
    only authority — we only insist that one was actually supplied.

    That last check matters more than it looks. LLM_MODEL is seeded to
    "gpt-4o-mini", so switching LLM_PROVIDER to azure without also changing the
    model sends a request to a deployment named "gpt-4o-mini", which almost
    certainly does not exist on the resource. Better a config error naming the
    setting than an opaque 404 from Azure.
    """
    if not model:
        return f"No model configured for {provider.name} and it has no default — set LLM_MODEL."
    if not provider.validates_models:
        return None
    if model not in provider.models:
        return f"Model {model} not supported by {provider.name}. Supported models: {', '.join(provider.models)}"
    return None


def _build_client(config: LLMConfig) -> OpenAI | AzureOpenAI:
    """Construct the SDK client for the configured provider.

    Azure needs its own client class, not just a base_url: its URLs carry the
    deployment in the path and the API version in the query string, and it
    authenticates with an `api-key` header rather than a bearer token. The SDK
    assembles all of that from `azure_endpoint` + `api_version` + the `model`
    passed at call time, so callers stay identical across both branches.
    """
    if config.provider.lower() == "azure":
        return AzureOpenAI(
            api_key=config.api_key,
            azure_endpoint=config.base_url,
            api_version=config.api_version,
        )
    # base_url=None keeps the SDK's own default (api.openai.com) for the public
    # OpenAI provider; passing "" instead would produce an invalid URL.
    return OpenAI(api_key=config.api_key, base_url=config.base_url)


# Upper bound on tool-call round-trips within one Ask AI request. A round is
# one "model asks for tools -> we run them -> feed results back" cycle; most
# questions resolve in 1-2. This exists so a model that keeps calling tools
# (bad query, or genuinely needs more digging than it should) can't turn one
# HTTP request into an unbounded chain of outbound calls.
MAX_MCP_TOOL_ROUNDS = 5


def _get_mcp_client(workspace_slug: str) -> "PlaneMCPClient | None":
    """None means "no MCP tools for this request" -- unset MCP_URL/MCP_TOKEN
    is a valid deployment (Ask AI still works as a plain chat completion),
    not a config error, so this doesn't log_exception like get_llm_config
    does for a genuinely broken LLM setup."""
    mcp_url = os.environ.get("MCP_URL")
    mcp_token = os.environ.get("MCP_TOKEN")
    if not mcp_url or not mcp_token:
        return None
    return PlaneMCPClient(base_url=mcp_url, token=mcp_token, workspace_slug=workspace_slug)


def get_llm_response(
    task, prompt, config: LLMConfig, mcp_client: "PlaneMCPClient | None" = None
) -> Tuple[str | None, str | None]:
    """Helper to get LLM completion response.

    When `mcp_client` is given, this becomes a bounded tool-calling loop
    instead of a single completion: fetch plane-mcp-server's tool catalogue,
    offer it to the model, and execute whatever tools it asks for (each tool
    call runs as the workspace user behind MCP_TOKEN -- see mcp_client.py)
    until it answers in plain text or MAX_MCP_TOOL_ROUNDS is hit. Every
    provider here goes through the OpenAI SDK's chat-completions call (see
    _build_client), so one code path covers tool-calling for all of them.
    """
    final_text = task + "\n" + prompt
    model = config.model
    try:
        # For Gemini, prepend provider name to model. Carried over unchanged from
        # upstream; it is LiteLLM's routing syntax and predates this call site
        # talking to the OpenAI SDK directly.
        if config.provider.lower() == "gemini":
            model = f"gemini/{model}"

        client = _build_client(config)
        messages = [{"role": "user", "content": final_text}]

        tools = None
        if mcp_client is not None:
            try:
                tools = mcp_tools_to_openai_schema(mcp_client.list_tools())
            except (requests.RequestException, PlaneMCPError) as e:
                # plane-mcp-server being unreachable shouldn't take down Ask AI
                # -- fall back to a plain completion instead of erroring out.
                log_exception(e)
                tools = None

        rounds = MAX_MCP_TOOL_ROUNDS if tools else 1
        message = None
        for _ in range(rounds):
            kwargs = {"model": model, "messages": messages}
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"
            chat_completion = client.chat.completions.create(**kwargs)
            message = chat_completion.choices[0].message

            if not message.tool_calls:
                return message.content, None

            messages.append(message.model_dump(exclude_none=True))
            for tool_call in message.tool_calls:
                try:
                    arguments = json.loads(tool_call.function.arguments or "{}")
                    result_text = mcp_client.call_tool(tool_call.function.name, arguments)
                except (json.JSONDecodeError, PlaneMCPError, requests.RequestException) as e:
                    log_exception(e)
                    result_text = f"Error calling {tool_call.function.name}: {e}"
                messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": result_text})

        # Ran out of rounds without a plain-text answer -- ask once more with
        # tools withdrawn so the model is forced to summarize what it has
        # rather than the request just failing.
        chat_completion = client.chat.completions.create(model=model, messages=messages)
        return chat_completion.choices[0].message.content, None
    except Exception as e:
        log_exception(e)
        error_type = e.__class__.__name__
        if error_type == "AuthenticationError":
            return None, f"Invalid API key for {config.provider}"
        elif error_type == "RateLimitError":
            return None, f"Rate limit exceeded for {config.provider}"
        else:
            return None, f"Error occurred while generating response from {config.provider}"


class GPTIntegrationEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        config = get_llm_config()

        if not config:
            return Response(
                {"error": "LLM provider API key and model are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        mcp_client = _get_mcp_client(slug)
        text, error = get_llm_response(task, request.data.get("prompt", False), config, mcp_client=mcp_client)
        if not text and error:
            return Response(
                {"error": "An internal error has occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        workspace = Workspace.objects.get(slug=slug)
        project = Project.objects.get(pk=project_id)

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
                "project_detail": ProjectLiteSerializer(project).data,
                "workspace_detail": WorkspaceLiteSerializer(workspace).data,
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceGPTIntegrationEndpoint(BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        config = get_llm_config()

        if not config:
            return Response(
                {"error": "LLM provider API key and model are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        mcp_client = _get_mcp_client(slug)
        text, error = get_llm_response(task, request.data.get("prompt", False), config, mcp_client=mcp_client)
        if not text and error:
            return Response(
                {"error": "An internal error has occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
            },
            status=status.HTTP_200_OK,
        )


class UnsplashEndpoint(BaseAPIView):
    def get(self, request):
        (UNSPLASH_ACCESS_KEY,) = get_configuration_value(
            [
                {
                    "key": "UNSPLASH_ACCESS_KEY",
                    "default": os.environ.get("UNSPLASH_ACCESS_KEY"),
                }
            ]
        )
        # Check unsplash access key
        if not UNSPLASH_ACCESS_KEY:
            return Response([], status=status.HTTP_200_OK)

        # Query parameters
        query = request.GET.get("query", False)
        page = request.GET.get("page", 1)
        per_page = request.GET.get("per_page", 20)

        url = (
            f"https://api.unsplash.com/search/photos/?client_id={UNSPLASH_ACCESS_KEY}&query={query}&page=${page}&per_page={per_page}"
            if query
            else f"https://api.unsplash.com/photos/?client_id={UNSPLASH_ACCESS_KEY}&page={page}&per_page={per_page}"
        )

        headers = {"Content-Type": "application/json"}

        resp = requests.get(url=url, headers=headers)
        return Response(resp.json(), status=resp.status_code)
