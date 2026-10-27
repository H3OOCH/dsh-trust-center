# Security

DSH Trust Center is a read-only review aid, not a security boundary.

- It does not sandbox, execute, block, or disable MCP servers or Skills.
- Findings are heuristic and may produce false positives or false negatives.
- The browser snapshot is loopback-only and read-only. It contains counts,
  provenance, and bounded excerpts, not full Skill bodies.
- The plugin has no runtime npm dependencies and does not upload content.
- Do not treat an A grade as a security guarantee.

Report security issues privately through the repository's security advisory
channel once the public repository is available.
