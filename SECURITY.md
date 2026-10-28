# Security

DSH Trust Center is a read-only review aid with an optional, explicit,
hash-only tool baseline. It is not a security boundary.

- It does not sandbox, execute, block, or disable MCP servers or Skills.
- Findings are heuristic and may produce false positives or false negatives.
- The browser snapshot is loopback-only and GET-only. It contains counts,
  provenance, and bounded excerpts, not full Skill bodies.
- The baseline action is loopback-only, POST-only, requires JSON plus a custom
  action header, and writes only `<DSH_PROFILE_DIR>/trust-center/baseline.json`.
  It is never triggered by a scan; the user must explicitly record or accept a
  baseline. The file contains tool identities, SHA-256 hashes, and timestamps,
  not descriptions, schemas, annotations, or tool output.
- MCP annotations such as `readOnlyHint` are server-declared claims, not
  runtime-verified evidence.
- The plugin has no runtime npm dependencies and does not upload content.
- Do not treat an A grade as a security guarantee.

Report security issues privately through the repository's security advisory
channel once the public repository is available.
