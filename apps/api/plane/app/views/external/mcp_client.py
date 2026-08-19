# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Minimal client for plane-mcp-server's header/API-key HTTP transport.

Deliberately not the official `mcp` SDK: that transport is FastMCP's
`stateless_http=True` mode, so a tool call is a single self-contained POST with
no `initialize`/session handshake to manage -- a JSON-RPC request/response over
`requests` (already a dependency) covers it without pulling in a client stack
built for the stateful transports we don't use.

Auth: the caller's Plane API token goes in `Authorization: Bearer`, the target
workspace in `X-Workspace-slug`. The server forwards that token to Plane's own
`/api/v1/users/me/` to validate it and runs every tool call as that user -- see
plane_mcp/auth/plane_header_auth_provider.py in the vendored submodule at
chakra-plexus/plane-mcp-server.
"""

import json

import requests


class PlaneMCPError(Exception):
    """A tool call reached the server but failed, or the transport misbehaved."""


class PlaneMCPClient:
    def __init__(self, base_url: str, token: str, workspace_slug: str, timeout: int = 20):
        self.base_url = base_url
        self.timeout = timeout
        self.headers = {
            "Content-Type": "application/json",
            # FastMCP's streamable-HTTP transport replies as
            # text/event-stream regardless of what Accept asks for; both are
            # listed anyway since the spec requires offering both.
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {token}",
            "X-Workspace-slug": workspace_slug,
        }
        self._next_id = 0

    def _call(self, method: str, params: dict | None = None) -> dict:
        self._next_id += 1
        payload = {"jsonrpc": "2.0", "id": self._next_id, "method": method, "params": params or {}}
        response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=self.timeout)
        response.raise_for_status()
        body = self._parse_body(response)
        if "error" in body:
            raise PlaneMCPError(body["error"].get("message", f"MCP call to {method} failed"))
        return body.get("result", {})

    @staticmethod
    def _parse_body(response: requests.Response) -> dict:
        if "text/event-stream" in response.headers.get("content-type", ""):
            for line in response.text.splitlines():
                if line.startswith("data:"):
                    return json.loads(line[len("data:") :].strip())
            raise PlaneMCPError("MCP server returned an event stream with no data event")
        return response.json()

    def list_tools(self) -> list[dict]:
        return self._call("tools/list").get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        """Returns the tool's text content, or raises PlaneMCPError if the
        tool itself reported failure (isError) -- the caller (the LLM loop)
        gets the error text either way, just via a different path, so it can
        decide whether to retry, ask a follow-up, or explain to the user."""
        result = self._call("tools/call", {"name": name, "arguments": arguments})
        text = "\n".join(block["text"] for block in result.get("content", []) if block.get("type") == "text")
        text = text or json.dumps(result)
        if result.get("isError"):
            raise PlaneMCPError(text)
        return text


def mcp_tools_to_openai_schema(tools: list[dict]) -> list[dict]:
    """Plane's fork routes every LLM provider through the OpenAI SDK's
    chat-completions wire format (see _build_client in base.py) -- including
    Azure, Anthropic and Gemini, via an OpenAI-compatible endpoint -- so one
    conversion to OpenAI's `tools` schema covers all of them."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": tool.get("inputSchema") or {"type": "object", "properties": {}},
            },
        }
        for tool in tools
    ]
