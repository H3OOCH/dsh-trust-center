# Tool fingerprint / drift baseline — design note

Status: design only. No baseline persistence is implemented in 0.1.x.
This note records the feedback from Discussion #11209 and the decisions that
need confirmation before the read-only boundary changes.

## Problem

A single `tools/list` snapshot is a point-in-time observation. An MCP server
can return a clean tool description during review, then return a different
`name`, `description`, or `inputSchema` on a later connection. Trust Center
currently scans the live `ctx.tools.schemas()` snapshot and keeps no history,
so it cannot detect this "clean at review time, changed later" case.

A second issue is semantic: `annotations` such as `readOnlyHint` and
`destructiveHint` are server declarations. They are useful context, but they
are not runtime evidence and must never suppress a capability finding.

## Goals

- Compute a stable fingerprint for every MCP tool.
- Detect changed, new, and removed tools between observations.
- Keep the default scan read-only: no file, profile, or MCP/Skill mutation.
- Persist only an explicit, opt-in, hash-only baseline.
- Label annotations as server-declared claims in the report and UI.
- Never upload baselines or full tool descriptions.

## Non-goals

- Verifying that the server actually implements the declared behavior.
- Blocking or disabling a server automatically.
- Storing full descriptions, schemas, prompts, or tool output in the baseline.
- Replacing a sandbox, runtime policy, or MCP transport review.

## Fingerprint

For each registered MCP tool, hash a canonical object containing:

```json
{
  "server": "fixture",
  "name": "run_shell",
  "description": "…",
  "inputSchema": { "type": "object", "properties": {} }
}
```

- Use SHA-256 over UTF-8 bytes.
- Canonicalize object keys deterministically before hashing.
- Keep `annotations` out of the trust identity by default. They are claims;
  if their hash is shown, label it separately as `annotationsHash`.
- Do not include volatile fields such as timestamps, cursors, or request IDs.
- The fingerprint identifies the observed surface, not the server binary or
  transport.

Suggested pure API (not implemented yet):

```js
fingerprintTool(schema) -> { server, name, sha256 }
fingerprintTools(schemas) -> Map<server + "\0" + name, fingerprint>
```

## Baseline records

Minimum metadata per tool:

```json
{
  "server": "fixture",
  "name": "run_shell",
  "sha256": "…",
  "firstSeen": "2026-10-28T04:00:00.000Z",
  "lastSeen": "2026-10-28T04:00:00.000Z",
  "reviewedAt": "2026-10-28T04:05:00.000Z"
}
```

- No description or schema body.
- `reviewedAt` is set only by an explicit user action.
- A baseline is scoped to a DSH profile by default; workspace scoping is an
  open question.
- A changed tool becomes `changed`; a tool not present becomes `removed`;
  a new tool becomes `new` until accepted.
- Drift status should appear in the snapshot and in `formatReportZh()`.

## Persistence options

### A. In-memory only (lowest risk)

- Baseline lives for the lifetime of the Host process.
- Detects changes within one session; resets on restart.
- No writes; no opt-in required.
- Suitable as the first incremental step.

### B. Opt-in profile baseline file (recommended for persistence)

- Disabled by default.
- User explicitly enables it and chooses/accepts the baseline location.
- Hash-only JSON; no full content.
- Written atomically; file permissions restricted.
- Never written by a scan unless the user explicitly clicks "record baseline"
  or "accept changed fingerprint".
- Need a reset/delete flow and a visible "baseline enabled" indicator.

### C. Host-provided storage service

- Preferred if DSH exposes a stable per-profile key/value or settings service.
- Avoids inventing a file format and inherits profile permissions.
- Must be investigated before choosing B.

## Read-only boundary

The current product promise is "no writes". Adding a persistent baseline changes
that promise.

- Default remains read-only; persistence is opt-in.
- The plugin may write only its own baseline file, never MCP config, Skill files,
  profile settings, or server content.
- The UI must say exactly what is stored and where.
- Tests must assert that disabled persistence performs zero writes.
- The security policy and README need an explicit exception for the opt-in
  baseline file.

## UI / report semantics

- First run: "No baseline recorded" (not "secure").
- With baseline: show `new`, `changed`, `removed`, `unchanged` counts.
- A changed fingerprint should be a review prompt, not an automatic block.
- Changed items should show current bounded description and rule findings; do
  not show stored historical content.
- Annotations should be shown as "server-declared" with a tooltip:
  "The server declares this; Trust Center has not verified it."
- Include the `annotations-are-claims` limitation in every report.

## Test plan

- Fingerprint is stable across object key order.
- Description/schema/name changes produce a different fingerprint.
- New/removed/changed sets are computed correctly.
- A clean fixture baseline followed by a changed fixture produces drift.
- Restart with persistence disabled does not retain a baseline.
- Persistence enabled writes only the baseline file and no other files.
- Annotation values do not suppress capability detection.
- The fixture in `test/fixtures/mcp-tools-list.json` remains the protocol-shaped
  input for these tests.

## Open questions for confirmation

1. Should the first release of drift detection be in-memory only, or include the
   opt-in persistent file immediately?
2. Is the baseline profile-scoped or workspace-scoped?
3. Who may accept a changed fingerprint: any local user, or only an explicit
   owner/admin action?
4. Should annotations changes be a separate informational signal, or ignored
   entirely for drift?
5. Does DSH expose a stable storage/settings service that removes the need for a
   plugin-owned file?

Until these are answered, do not add persistence or change the default
read-only behavior.
