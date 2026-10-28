# Releasing

This project publishes with npm trusted publishing (GitHub OIDC) and provenance.
No long-lived `NPM_TOKEN` is required.

## Prerequisites

Configure the npm package's trusted publisher once:

- Package: `dsh-trust-center`
- Publisher: GitHub
- Organization/user: `H3OOCH`
- Repository: `dsh-trust-center`
- Workflow filename: `release.yml`
- Environment: leave blank
- Allowed action: `npm publish`

The workflow is `.github/workflows/release.yml`; it runs only on a `v*` tag.

## Release checklist

1. Update `package.json` version and `CHANGELOG.md`.
2. Update README if the installed version or behavior changed.
3. Run:

   ```bash
   node test/run.js
   npm run check
   npm pack --dry-run
   ```

4. Push `main`; wait for CI (Windows/Ubuntu, Node 22/24, packed install).
5. Create and push the tag only after CI is green:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

6. The release workflow checks that the tag matches `package.json`, runs the
   tests, and publishes with:

   ```text
   npm publish --access public --provenance
   ```

7. Verify:

   ```bash
   npm view dsh-trust-center@0.2.0 version
   dsh plugin --profile web add dsh-trust-center@0.2.0
   ```

8. Check the npm page for provenance and the GitHub release.

## Fallback without trusted publishing

Prefer fixing trusted publishing. If it is temporarily impossible, use a
short-lived granular npm token with publish permission, run the same tests and
`npm publish --access public`, then revoke the token immediately. This fallback
does not produce provenance.

## Rollback

Do not unpublish a version that users may have installed. Publish a fixed patch
version instead. Deprecate a bad version with a clear message.
