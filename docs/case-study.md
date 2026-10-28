# Synthetic MCP fixture case study

This is a deliberately synthetic example based on
[`test/fixtures/mcp-tools-list.json`](../test/fixtures/mcp-tools-list.json). It
is not a capture of a real server and contains no private data.

## The fixture

| Tool | Surface | Expected signal |
|---|---|---|
| `search_docs` | Prompt text, hidden Unicode, HTML comment, permissive schema | `prompt-injection-override`, `hidden-unicode`, `hidden-html-comment`, `broad-schema` |
| `write_file` | Claims `readOnlyHint: true` but has write capability | filesystem-write capability, no trust in the annotation |
| `run_shell` | Concealment language and a shell capability | `prompt-injection-concealment`, shell capability |
| `benign_lookup` | Clean read-only lookup | no finding |

## What the Host report shows

- one MCP server and four tools;
- the injected and hidden strings are bounded to snippets;
- `write_file` remains flagged as a write capability despite its
  server-declared `readOnlyHint`;
- `benign_lookup` is not flagged;
- the report includes the `annotations-are-claims` and `mcp-server-metadata`
  limitations.

## Why this matters

The fixture is small, but it exercises the same Host path as a real server:

1. MCP `tools/list` JSON-RPC result;
2. conversion to DSH tool schemas;
3. `scanHarness()`;
4. finding construction and bounded evidence;
5. optional fingerprint baseline and drift.

For a real test, use a disposable local MCP server and a temporary workspace;
see [testing-mcp.md](testing-mcp.md).
