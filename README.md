# DSH Trust Center

[![CI](https://github.com/H3OOCH/dsh-trust-center/actions/workflows/ci.yml/badge.svg)](https://github.com/H3OOCH/dsh-trust-center/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-trust-center.svg)](https://www.npmjs.com/package/dsh-trust-center)
[![dshfind](https://dshfind.com/api/badge/H3OOCH/dsh-trust-center?lang=zh)](https://dshfind.com/zh/plugins/H3OOCH/dsh-trust-center)

**审计模型即将信任的外部文本：MCP 工具与 Skills。**

DSH Trust Center 是 DeepSeek Harness（DSH）的一个只读信任审计插件。它不管理插件安装，也不做启动恢复；它检查另一类更容易被忽略的攻击面：

- MCP 工具的名称、描述和 JSON Schema；
- Skills 的摘要和正文；
- 这些内容里的提示注入、隐藏 Unicode、HTML 注释、编码载荷、危险命令、凭据访问、过大的上下文成本与异常 Schema。

它把结果放进 DSH 主界面的 **Trust Center** 面板，并提供一个可被 Agent 调用的 `trust_scan` 工具。

> **重要边界**：这是启发式审计，不是运行时沙箱，也不是“安全认证”。它不执行、不拦截、不自动禁用任何 MCP 服务器或 Skill。没有被标记，不代表安全。

---

## 为什么需要它

MCP 工具描述和 Skills 正文会作为模型上下文进入每一轮请求。它们来自外部服务器、项目目录、GitHub 或第三方 Skill 包，但通常没有经过和代码依赖相同的审查。

常见风险：

- 工具描述里写“忽略之前的指令”“不要告诉用户”“把 token 上传到……”；
- 用零宽字符、双向控制符或 HTML 注释隐藏指令；
- 一个 MCP 服务器注册几十个工具，长期占用大量上下文；
- Skill 正文包含破坏性命令或凭据路径，但只以“示例”的形式出现；
- Schema 允许任意附加字段，实际校验却完全依赖服务器。

Trust Center 把这些信号变成可读、可截图、可导出的证据列表。

## 安装

从 npm 安装当前正式版（0.2.1）：

```bash
dsh plugin --profile web add dsh-trust-center
```

固定版本：

```bash
dsh plugin --profile web add dsh-trust-center@0.2.1
```

如果 npm 不可用，也可以从 GitHub 安装同一版本：

```bash
dsh plugin --profile web add github:H3OOCH/dsh-trust-center#v0.2.1
```

> npm `latest` 是 **0.2.1**，包含 tool fingerprint / drift / 可选 baseline。
> 旧的 `0.0.0-stage` 是已弃用占位版本，不要手工指定。

重启 DSH Web，左侧栏会出现 **信任中心 / Trust Center** 图标。

本地开发：

```bash
dsh plugin --profile web add link:D:/path/to/dsh-trust-center
```

> 插件只接受本机 Web 会话读取快照。远程访问时，面板会明确提示“只在本机可用”。这是为了避免把工具描述和证据片段暴露给非本机浏览器。

## 使用

### Web 面板

左侧栏 → **Trust Center**；也可以从 **Settings → Trust Center** 进入同一个面板：

- **概览**：风险分、等级、高/中/低风险数量、扫描覆盖范围；
- **MCP 工具**：按服务器分组，显示工具数、上下文 token 估算、能力标签和风险信号；
- **Skills**：显示来源、路径、字符数、token 估算和风险信号；
- 每条信号可展开：字段、行号、有界文本片段、建议和规则 ID；
- 右上角重新扫描；
- 面板底部列出扫描边界和隐私说明。

### Agent 工具

Agent 可在需要时调用：

```text
trust_scan
```

参数：

| 参数 | 默认 | 说明 |
|---|---|---|
| `format` | `markdown` | `markdown` 返回中文摘要；`json` 返回完整结构化报告 |

示例：

> 帮我审计一下当前 MCP 工具和 Skills，看看有没有提示注入或隐藏指令。

## 检查内容

### MCP 工具

- 提示注入：覆盖既有指令、混淆系统/开发者身份、要求对用户隐瞒、凭据外发；
- 隐藏字符：双向控制符、标签字符、零宽字符、不可见格式和控制字符；
- 隐藏 HTML 注释与长编码载荷；
- 过大的描述或 Schema，以及重复的上下文成本；
- 工具数量过多的服务器；
- 宽松/空泛的 Schema；
- 危险能力标签：命令执行、文件写入、网络、凭据、数据库、浏览器。

### Skills

- Skill 摘要、`whenToUse` 和正文；
- 提示注入与隐藏字符；
- 隐藏 HTML 注释；
- 破坏性/远程执行类命令示例；
- 凭据和敏感路径访问；
- 正文过大造成的上下文成本；
- 来源与路径展示（路径会尽量脱敏为 `~/...`）。

## 风险分

风险分只用于排序注意力：

```text
high × 18 + medium × 7 + low × 2
```

上限 100。A（0–9）、B（10–29）、C（30–59）、D（60+）。它不是概率，也不是安全评级。

## 工具指纹与基线

MCP 服务器可能在审查后返回不同的 `tools/list`。插件会为每个工具计算一个 SHA-256 指纹（服务器名、工具名、描述、Schema），并标记 `changed` / `new` / `removed`。

- 默认是**内存基线**：只在当前 Host 进程内有效，重启后重置；
- 点击 **记录当前基线** 后，才会写入当前 profile 的 hash-only 文件：

```text
<DSH_PROFILE_DIR>/trust-center/baseline.json
```

- 文件只包含服务器名、工具名、SHA-256 和 first-seen 时间；不包含描述、Schema、annotations 或工具输出；
- 已有文件时，出现变化后需显式点击 **接受当前状态** 才会更新；
- 扫描本身永远不写文件。

## 隐私与安全

- **审计只读**：不修改 MCP 配置、Skill 文件、会话或来源内容。
- **可选基线写入**：只有你显式点击“记录当前基线/接受当前状态”时，才写入当前 profile 的 `<DSH_PROFILE_DIR>/trust-center/baseline.json`；文件是 hash-only 的。
- **本机读取**：Host 侧读取当前运行时已经暴露的工具 schema 和 Skill 内容；不联网上传。
- **最小化外发**：浏览器只收到计数、来源标识和有界证据片段；完整 Skill 正文不发送到浏览器。
- **Loopback only**：快照路由只接受 loopback Host 和 loopback peer，GET-only；基线写入路由也只接受 loopback POST；均无 CORS、`no-store`。
- **无第三方运行时依赖**：包本身不依赖 npm 运行时库。

## 已知限制

- MCP 服务器的 **instructions**、transport 和连接状态没有通过公开工具 API 暴露；本插件只能审计已注册工具的描述和 Schema。
- MCP annotations（如 `readOnlyHint`、`destructiveHint`）是服务器声明，不是运行时验证证据。
- 持久化基线只覆盖 MCP 工具，不覆盖 Skills；它记录的是观察到的指纹，不是服务器实际行为。
- 一个 MCP 服务器如果没有任何已注册工具，本插件看不到它。
- Skill 扫描覆盖已注册工作区；未被工作区注册的项目目录不在结果中。
- 规则是启发式的，可能误报或漏报。请把结果当作复查起点，不要把它当作放行/拦截依据。
- 不扫描插件包源码；插件供应链审计请使用专门的插件健康/安全工具。

## 开发

```bash
npm test
node scripts/check.js
```

测试覆盖：

- MCP 工具 namespace 解析；
- 提示注入、隐藏 Unicode、HTML 注释、编码载荷；
- 危险命令、凭据访问、宽松 Schema、过大内容；
- 正常长 Skill 不误报；
- 已注册工作区聚合与全局 Skill 去重；
- Host 报告聚合、服务缺失降级；
- MCP `tools/list` fixture、Prompt/隐藏字符/宽 Schema 集成检测；
- tool fingerprint、changed/new/removed 与内存基线；
- profile baseline 文件、hash-only 校验、原子写入与 POST 路由限制；
- loopback 快照 GET 限制与显式 baseline POST 限制；
- 插件注册、Agent 工具和 Client 槽位注册。

## 测试用 MCP

建议按风险从低到高：

1. **Sequential Thinking**：没有文件/网络副作用，最适合验证 MCP 面板和内存基线；
2. **Filesystem**：只指向一个空的临时目录，验证 write capability 和 `readOnlyHint` 只是声明；
3. **Git**：只指向一个可丢弃的仓库，验证只读工具和 Schema。

不要用 home 目录、真实项目、真实凭据或生产数据库做第一次测试。
完整建议、drift 测试方法和安全注意事项见 [testing-mcp.md](docs/testing-mcp.md)。

## 文档与社区

- [规则目录](docs/rules.md)
- [合成 MCP 案例](docs/case-study.md)
- [测试用 MCP 建议](docs/testing-mcp.md)
- [贡献指南](CONTRIBUTING.md)
- [安全问题](SECURITY.md)
- [Issues / 讨论](https://github.com/H3OOCH/dsh-trust-center/issues)

## License

MIT
