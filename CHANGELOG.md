# Changelog

## 0.2.2 — 2026-11-06

用公开语料 [mcp-poison-corpus](https://github.com/H3OOCH/mcp-poison-corpus) 实测后修的 7 处：

- 接受 MCP 规范的 inputSchema（原来只读 parameters，按规范接入时 schema 读成空对象）
- 扫描工具名；下划线写法的注入短语也能识别
- isBroadSchema 覆盖「additionalProperties 全开 + 超大枚举」
- 凭据路径补 ~/.npmrc、~/.kube/config、~/.aws/credentials；MCP 工具描述也扫凭据与命令
- base64 阈值 400→40，并**解码后**看内容（指令词 / 凭据 / 命令）再判定
- 引用/举例语境里的注入短语不再误报

实测（16 条样本）：样本级检出 53.8% → **92.3%**，信号级召回 52.9% → **82.4%**，负样本误报 66.7% → **33.3%**。测试 43/43 通过。
## 0.2.1 — 2026-10-28

- Fix npm README/install metadata after the 0.2.0 release;
- Retry the registry verification step to tolerate npm publish propagation delay;
- No runtime behavior changes.

## 0.2.0 — 2026-10-28

### Added

- In-memory MCP tool fingerprints and changed/new/removed drift signals;
- Optional profile baseline file, written only by an explicit loopback action;
- `annotations-are-claims` limitation and tests for `readOnlyHint`;
- Protocol-shaped MCP `tools/list` fixture and Host-path integration tests;
- Contributor guide, rule catalog, case study, MCP testing guide, and issue forms.

## 0.1.0 — 2026-10-27

首个版本。

### Added

- Trust Center 主面板与侧栏入口；
- MCP 工具描述/Schema 审计：提示注入、隐藏 Unicode、隐藏 HTML 注释、编码载荷、过大内容、宽松 Schema、工具数量与能力标签；
- Skills 正文审计：提示注入、隐藏字符、危险命令、凭据访问、大小与来源；
- 风险评分、覆盖范围、扫描告警与限制说明；
- `trust_scan` Agent 工具（Markdown / JSON）；
- Loopback-only、GET-only、只读 Host 快照路由；
- 中英文 UI 文案；
- 无第三方运行时依赖。

