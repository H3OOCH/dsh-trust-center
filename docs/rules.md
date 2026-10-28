# Rule catalog

Rule IDs are stable API. Severity is a default; a rule may escalate based on
content. Findings are heuristics, not proof of safety.

## MCP and Skill text

| Rule | Default | Category | What it means | Common false positive |
|---|---|---|---|---|
| `prompt-injection-override` | high | prompt-injection | Text asks to ignore or replace earlier/system/developer instructions. | Documentation that quotes an attack example. |
| `prompt-injection-exfiltration` | high | prompt-injection | Text asks to send keys, tokens, passwords, or credentials somewhere. | A tool that only documents a secure token flow. |
| `prompt-injection-concealment` | high | prompt-injection | Text asks to hide an action from the user. | A phrase like “don’t tell the user until the operation completes” in a legitimate transactional tool. |
| `prompt-injection-role` | medium | prompt-injection | Text claims a system/developer identity or “new instructions”. | A prompt-engineering guide that is clearly explanatory. |
| `hidden-unicode` | medium | hidden-content | Invisible controls, zero-width marks, bidi controls, or tag characters. | Legitimate Persian/emoji joiners (U+200C/U+200D are excluded). |
| `hidden-html-comment` | medium | hidden-content | A non-empty HTML comment that a reader may not see. | A generated license header or documentation annotation. |
| `encoded-instructions` | medium | hidden-content | A long encoded blob near decode/execute language. | A legitimate base64 example in a parser or test fixture. |
| `dangerous-command` | high | dangerous-capability | Skill examples contain destructive or remote-execution commands. | A security training document with clearly labelled examples. |
| `credential-access` | medium | dangerous-capability | Text reads or handles keys, tokens, `.env`, `.ssh`, or similar. | A tool that only accepts a credential reference, without reading it. |
| `oversized-surface` | medium | context-bloat | A description, schema, or Skill body is unusually large. | A generated API reference that is intentionally complete. |
| `broad-schema` | low | schema-hygiene | Schema allows arbitrary fields or has no structural constraints. | A deliberate pass-through proxy that validates server-side. |
| `missing-description` | low | schema-hygiene | A tool has no description. | A private tool with an obvious name. |
| `many-tools` | low | context-bloat | One server exposes many tools. | A server intentionally split only by task. |

## Drift rules

These only run when a fingerprint baseline exists.

| Rule | Default | Meaning |
|---|---|---|
| `tool-fingerprint-changed` | medium | A tool’s name/description/schema changed from the baseline. |
| `tool-fingerprint-new` | low | A tool appeared after the baseline was recorded. |
| `tool-fingerprint-removed` | low | A tool from the baseline is absent from the current scan. |

## Annotations

`readOnlyHint`, `destructiveHint`, and similar annotations are server-declared
claims. They are not treated as runtime evidence and do not suppress capability
findings.

## Reporting a false positive

Use the “False positive / missed signal” issue form. Include the rule ID, a
sanitized snippet, and why the context makes the signal expected. Never include
tokens, private keys, or full private Skill bodies.
