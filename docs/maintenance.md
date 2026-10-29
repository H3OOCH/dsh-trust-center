# Maintenance runbook

Scheduled maintenance runs on the **13th of each month at 12:00 Asia/Shanghai**
and is also represented by the GitHub Actions monthly CI schedule.

## Every run

1. Check `git status`; fetch/compare with `origin/main` when network is available.
2. Check npm:
   - `npm view dsh-trust-center dist-tags --json`
   - `npm view dsh-trust-center@<latest> version dist.attestations --json`
3. Check GitHub:
   - latest CI and release workflow runs;
   - open issues and PRs;
   - GitHub Release points at the expected tag;
   - dshbase submission issue status.
4. Check DSH compatibility:
   - current DSH version versus `engines.dsh`;
   - rerun the test suite against the current runtime.
5. Run:

   ```bash
   node test/run.js
   npm run check
   npm pack --dry-run
   ```

6. Review README, CHANGELOG, SECURITY, rule catalog, and known limitations for drift.
7. Report findings. Do not push, tag, publish, or modify the profile without
   explicit user confirmation.

## MCP condition

Query the live Trust Center status.

- If `summary.mcpTools === 0`: record **“real MCP test not executed”**.
- If `summary.mcpTools > 0`:
  1. confirm the MCP server/tools appear in the report;
  2. call `trust_scan` with `format: "json"` and verify its MCP counts;
  3. verify the MCP tab data and baseline card state;
  4. do **not** record or accept a baseline automatically; that requires an
     explicit user action.
- If an MCP server is newly connected, run this MCP check immediately rather
  than waiting for the monthly run.

## Release rule

Publishing uses npm trusted publishing + provenance via a `v*` tag. Maintenance
must not create tags or publish automatically. Follow
[`docs/releasing.md`](releasing.md).
