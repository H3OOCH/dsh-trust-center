# Testing Trust Center with real MCP servers

Trust Center audits the tool descriptions and schemas that DSH has already
registered. It does not start, sandbox, or proxy the MCP server. Use a
disposable server and a disposable workspace.

## Recommended first test

### 1. Sequential Thinking

Good first choice because it has no filesystem, credential, or network side
effects and exposes a small set of tools.

```text
@modelcontextprotocol/server-sequential-thinking
```

Use it to verify:

- the MCP tab and tool descriptions;
- context token estimates;
- initial memory baseline;
- “record current baseline” and file-mode UI.

### 2. Filesystem, pointed at an empty temp directory

```text
@modelcontextprotocol/server-filesystem <empty-temp-directory>
```

Use it to verify:

- read/write capability labels;
- `readOnlyHint`/`destructiveHint` are shown as claims, not evidence;
- baseline fingerprints change if the server version or tool set changes.

Do **not** point it at your home directory or a real project.

### 3. Git, pointed at a disposable repository

Use a community Git MCP server and follow that package's current CLI for
passing the repository path. The exact flag differs between implementations.
Use it to inspect read-only Git tools and their schemas. Do not connect a
repository containing private credentials.

## Optional, later

- A community Memory MCP server — local JSON-backed graph; use a temp data file.
- A Fetch MCP server — network access; test only with non-sensitive URLs.

Avoid browser, database, GitHub, and cloud MCP servers for the first run.
They increase credential and side-effect surface without improving the
Trust Center smoke test.

## How to test drift with a real server

Most released MCP servers have a static `tools/list`, so a baseline will stay
unchanged. To test the changed/new/removed path:

1. Record a baseline from a local mock/test server;
2. change one tool description or schema in that server;
3. reconnect/restart DSH so `tools/list` changes;
4. refresh Trust Center and confirm the drift notice and the
   `tool-fingerprint-changed` finding.

Do not edit a third-party server’s code for this test unless it is a disposable
copy.

## Safety

- The plugin is a review aid, not a sandbox.
- Use a temp directory and no real credentials.
- Review the package before running `npx -y`; pin a version for repeatable tests.
- Remove the test MCP configuration and temp data when finished.
