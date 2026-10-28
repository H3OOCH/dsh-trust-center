# Contributing

Thanks for helping improve DSH Trust Center.

## Before you start

- Read [SECURITY.md](SECURITY.md) for the trust boundary.
- For a security issue in the plugin, use GitHub Security Advisories, not a public issue.
- For a false positive or a missed signal, use the issue forms; sanitize descriptions and paths first.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install --ignore-scripts
npm test
npm run check
npm pack --dry-run
```

The test runner is `node test/run.js`. `node --test` is not used because DSH's
file sandbox rejects the stdio isolation it needs.

## What to change

### New or changed heuristic

1. Add the rule to `src/heuristics.js` with Chinese and English copy.
2. Add a focused test in `test/heuristics.test.js`.
3. If the rule affects the Host report, add a scanner or fixture test.
4. Include one false-positive example in the PR description.

### MCP fixture

Protocol-shaped fixtures live in `test/fixtures/`. They must look like a real
`tools/list` response and contain no secrets or private data.

### UI

- Keep the panel usable without an MCP server.
- Do not add automatic MCP/Skill mutation.
- If you add a baseline action, update README, SECURITY.md, and the tests that
  assert no writes happen during a scan.

## Pull requests

- Keep the change small and explain the user-visible behavior.
- Run `npm test` and `npm run check`.
- Do not add third-party runtime dependencies without prior discussion.
- Do not commit generated tarballs, local caches, or baseline files.

## Release notes

Add user-visible changes under `## Unreleased` in CHANGELOG.md. Versioning is
maintained by the project owner; do not bump versions or publish from a PR.
