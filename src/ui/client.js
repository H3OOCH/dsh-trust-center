/**
 * Browser half of DSH Trust Center.
 *
 * A first-class main panel plus a sidebar icon, both addressed by the same
 * `trust-center` id. The panel reads the loopback-only read-only snapshot from
 * the Host route and never mutates MCP/Skill state.
 */

window.__ModuleLoader__.load({
  id: 'dsh-trust-center',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const STATUS_PATH = '/plugins/dsh-trust-center/status'
    const NS = 'dsh-trust-center'

    const COLORS = {
      high: 'var(--dsw-alias-state-error-primary)',
      medium: 'var(--dsw-alias-state-warn-primary)',
      low: 'var(--dsw-alias-label-secondary)',
      safe: 'var(--dsw-alias-state-success-primary)',
      brand: 'var(--dsw-alias-brand-primary)',
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      border: 'var(--dsw-alias-border-l1)',
      borderStrong: 'var(--dsw-alias-border-l2)',
      surface: 'var(--dsw-alias-bg-layer-1)',
      surface2: 'var(--dsw-alias-bg-layer-2)',
      base: 'var(--dsw-alias-bg-base)',
    }

    const ZH = {
      nav: '信任中心',
      title: '信任中心',
      subtitle: '审计模型即将信任的外部文本：MCP 工具描述与 Schema、Skills 正文。只读，不改动任何来源。',
      refresh: '重新扫描',
      scanning: '扫描中…',
      loading: '正在读取当前 MCP 工具与 Skills…',
      error: '读取失败',
      retry: '重试',
      localOnly: '信任中心只接受本机 Web 会话；远程访问被拒绝。',
      generated: '生成于',
      score: '风险分',
      grade: '等级',
      high: '高风险',
      medium: '中风险',
      low: '低风险',
      findings: '信号',
      mcpServers: 'MCP 服务器',
      mcpTools: 'MCP 工具',
      skills: 'Skills',
      contextTokens: '上下文 token',
      approximate: '启发式估算',
      coverage: '扫描覆盖',
      toolsAvailable: '工具注册表已连接',
      toolsUnavailable: '工具注册表不可用',
      skillsAvailable: 'Skills 注册表已连接',
      skillsUnavailable: 'Skills 注册表不可用',
      projects: '项目级 Skills',
      workspace: '工作目录',
      overview: '概览',
      mcp: 'MCP 工具',
      skillTab: 'Skills',
      noFindings: '没有命中需要处理的信号',
      noFindingsDetail: '这不等于“安全”。当前规则只检查已知的文本与结构模式，不会执行或证明工具行为。',
      noMcp: '没有已注册的 MCP 工具',
      noMcpDetail: '在 DSH 中配置 MCP 服务器后，这里会显示每个服务器的工具、上下文成本和风险信号。',
      noSkills: '没有可扫描的 Skill',
      noSkillsDetail: '安装或创建 Skill 后，这里会显示正文中的隐藏指令、危险命令和大小。',
      finding: '信号',
      evidence: '证据',
      recommendation: '建议',
      category: '类别',
      confidence: '置信度',
      field: '字段',
      line: '行',
      showMore: '展开',
      hide: '收起',
      tools: '工具',
      server: '服务器',
      source: '来源',
      path: '路径',
      tokens: '≈{n} token',
      chars: '{n} 字符',
      riskSignals: '{n} 条信号',
      highLower: '高',
      mediumLower: '中',
      lowLower: '低',
      infoLower: '提示',
      limitations: '边界与限制',
      warnings: '扫描告警',
      privacyTitle: '隐私与只读边界',
      privacy: '报告只包含计数器、来源标识和有界文本片段。完整 Skill 正文不会发送到浏览器；本插件不会自动禁用 MCP 服务器或 Skill。',
      heuristics: '启发式审计：风险分只用于排序注意力，不是安全认证，也不保证未被标记的内容是安全的。',
      truncated: '结果已截断；请查看扫描告警或提高限制。',
      gradeA: '低信号',
      gradeB: '需留意',
      gradeC: '建议复查',
      gradeD: '优先处理',
      capability_shell: '命令执行',
      'capability_filesystem-write': '文件写入',
      capability_network: '网络',
      capability_credentials: '凭据',
      capability_database: '数据库',
      capability_browser: '浏览器',
      loadFailed: '无法读取本机快照。',
      emptyAll: '当前没有 MCP 工具或 Skills 可扫描。',
      emptyAllDetail: '连接 MCP 服务器或添加 Skill 后，Trust Center 会自动看到它们。',
      scanAgain: '再次扫描',
      showing: '显示 {shown} / {total} 条',
    }

    const EN = {
      nav: 'Trust Center',
      title: 'Trust Center',
      subtitle: 'Audit the external text your model is about to trust: MCP tool descriptions and schemas, and Skill bodies. Read-only; nothing is changed.',
      refresh: 'Scan again',
      scanning: 'Scanning…',
      loading: 'Reading the active MCP tools and Skills…',
      error: 'Could not load',
      retry: 'Retry',
      localOnly: 'Trust Center accepts only a local Web session; remote access is refused.',
      generated: 'Generated',
      score: 'Risk score',
      grade: 'Grade',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      findings: 'Signals',
      mcpServers: 'MCP servers',
      mcpTools: 'MCP tools',
      skills: 'Skills',
      contextTokens: 'Context tokens',
      approximate: 'heuristic estimate',
      coverage: 'Coverage',
      toolsAvailable: 'tool registry available',
      toolsUnavailable: 'tool registry unavailable',
      skillsAvailable: 'skill registry available',
      skillsUnavailable: 'skill registry unavailable',
      projects: 'project Skills',
      workspace: 'workspace',
      overview: 'Overview',
      mcp: 'MCP tools',
      skillTab: 'Skills',
      noFindings: 'No actionable signals',
      noFindingsDetail: 'This does not mean “safe”. The rules only inspect known text and structure patterns; they do not execute or prove tool behavior.',
      noMcp: 'No MCP tools registered',
      noMcpDetail: 'After you configure MCP servers, each server’s tools, context cost, and signals appear here.',
      noSkills: 'No Skills to scan',
      noSkillsDetail: 'Installed or created Skills appear here with hidden-instruction, command, and size signals.',
      finding: 'Signal',
      evidence: 'Evidence',
      recommendation: 'Recommendation',
      category: 'Category',
      confidence: 'Confidence',
      field: 'Field',
      line: 'Line',
      showMore: 'Expand',
      hide: 'Collapse',
      tools: 'Tools',
      server: 'Server',
      source: 'Source',
      path: 'Path',
      tokens: '≈{n} tokens',
      chars: '{n} chars',
      riskSignals: '{n} signals',
      highLower: 'high',
      mediumLower: 'medium',
      lowLower: 'low',
      infoLower: 'info',
      limitations: 'Limits',
      warnings: 'Scan warnings',
      privacyTitle: 'Privacy & read-only boundary',
      privacy: 'The report contains counters, provenance identifiers, and bounded text excerpts. Full Skill bodies never reach the browser; this plugin never disables an MCP server or Skill automatically.',
      heuristics: 'Heuristic review: the risk score ranks attention, not security certification, and does not prove unflagged content safe.',
      truncated: 'Results are truncated; see scan warnings or raise the limit.',
      gradeA: 'Low signal',
      gradeB: 'Review',
      gradeC: 'Inspect soon',
      gradeD: 'Act first',
      capability_shell: 'Shell / exec',
      'capability_filesystem-write': 'Filesystem write',
      capability_network: 'Network',
      capability_credentials: 'Credentials',
      capability_database: 'Database',
      capability_browser: 'Browser',
      loadFailed: 'Could not read the local snapshot.',
      emptyAll: 'No MCP tools or Skills are visible yet.',
      emptyAllDetail: 'Connect an MCP server or add a Skill; Trust Center will pick it up on the next scan.',
      scanAgain: 'Scan again',
      showing: 'Showing {shown} / {total}',
    }

    function fill(template, values) {
      return String(template ?? '').replace(/\{(\w+)\}/g, (_match, key) => String(values?.[key] ?? `{${key}}`))
    }

    function useReport() {
      const [state, setState] = React.useState({ loading: true, error: undefined, data: undefined })
      const [nonce, setNonce] = React.useState(0)
      const refresh = React.useCallback(() => setNonce((value) => value + 1), [])

      React.useEffect(() => {
        let active = true
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 25_000)
        setState((current) => ({ ...current, loading: true, error: undefined }))
        fetch(`${STATUS_PATH}${nonce === 0 ? '' : '?refresh=1'}`, {
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
          cache: 'no-store',
        })
          .then(async (response) => {
            if (!response.ok) {
              const body = await response.json().catch(() => ({}))
              throw new Error(body.error ?? `HTTP ${response.status}`)
            }
            return response.json()
          })
          .then((data) => {
            if (active) setState({ loading: false, error: undefined, data })
          })
          .catch((error) => {
            if (!active) return
            setState({
              loading: false,
              error: controller.signal.aborted ? new Error('timeout') : error,
              data: undefined,
            })
          })
          .finally(() => clearTimeout(timer))
        return () => {
          active = false
          clearTimeout(timer)
          controller.abort()
        }
      }, [nonce])

      return { ...state, refresh }
    }

    function useLocaleId(ctx) {
      return React.useSyncExternalStore(
        (callback) => ctx.locale.subscribe(callback),
        () => ctx.locale.getSnapshot().active,
        () => 'zh',
      )
    }

    function Icon({ size = 20, active = false }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
        style: { display: 'block', color: active ? COLORS.brand : 'currentColor' },
      }, [
        h('path', {
          key: 'shield',
          d: 'M12 2.6 20 5.8v6.1c0 4.9-3.2 8.8-8 10.9-4.8-2.1-8-6-8-10.9V5.8Z',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinejoin: 'round',
          opacity: 0.85,
        }),
        h('circle', {
          key: 'lens',
          cx: 11,
          cy: 10.6,
          r: 3.1,
          stroke: 'currentColor',
          strokeWidth: 1.7,
        }),
        h('path', {
          key: 'handle',
          d: 'm13.4 13 2.9 2.9',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }),
      ])
    }

    function toneForScore(score) {
      return score >= 60 ? COLORS.high : score >= 30 ? COLORS.medium : score >= 10 ? COLORS.medium : COLORS.safe
    }

    function gradeText(t, grade) {
      return t(grade === 'A' ? 'gradeA' : grade === 'B' ? 'gradeB' : grade === 'C' ? 'gradeC' : 'gradeD')
    }

    const card = {
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      background: COLORS.surface,
    }

    function Pill({ children, tone = COLORS.muted, strong = false }) {
      return h('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          border: `1px solid ${strong ? tone : COLORS.border}`,
          color: tone,
          background: strong ? 'transparent' : 'transparent',
          fontSize: 11,
          lineHeight: '18px',
          fontWeight: strong ? 650 : 500,
          whiteSpace: 'nowrap',
        },
      }, children)
    }

    function Dot({ tone, size = 7 }) {
      return h('span', {
        style: { width: size, height: size, borderRadius: size, background: tone, flex: '0 0 auto' },
      })
    }

    function Button({ children, onClick, busy = false, primary = false }) {
      return h('button', {
        type: 'button',
        onClick,
        disabled: busy,
        style: {
          border: primary ? 0 : `1px solid ${COLORS.borderStrong}`,
          borderRadius: 9,
          background: primary ? COLORS.brand : 'transparent',
          color: primary ? '#fff' : 'inherit',
          padding: primary ? '8px 15px' : '7px 13px',
          font: 'inherit',
          fontSize: 13,
          fontWeight: primary ? 650 : 500,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.55 : 1,
          whiteSpace: 'nowrap',
        },
      }, busy ? '…' : children)
    }

    function Metric({ label, value, hint, tone }) {
      return h('div', {
        style: {
          minWidth: 120,
          flex: '1 1 120px',
          padding: '10px 12px',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          background: COLORS.base,
        },
      }, [
        h('div', { key: 'l', style: { fontSize: 11, color: COLORS.muted, letterSpacing: '.02em' } }, label),
        h('div', { key: 'v', style: { fontSize: 24, lineHeight: '32px', fontWeight: 700, color: tone ?? COLORS.text } }, value),
        hint === undefined ? null : h('div', { key: 'h', style: { fontSize: 11, color: COLORS.muted } }, hint),
      ])
    }

    function SeverityBadge({ severity, t }) {
      const tone = severity === 'high' ? COLORS.high : severity === 'medium' ? COLORS.medium : COLORS.muted
      const label = severity === 'high' ? t('highLower') : severity === 'medium' ? t('mediumLower') : t('lowLower')
      return h(Pill, { tone, strong: severity === 'high' }, [h(Dot, { key: 'd', tone, size: 6 }), label])
    }

    function FindingCard({ finding, lang, t }) {
      const [open, setOpen] = React.useState(false)
      const title = lang.startsWith('zh') ? finding.titleZh : finding.titleEn
      const detail = lang.startsWith('zh') ? finding.detailZh : finding.detailEn
      const recommendation = lang.startsWith('zh') ? finding.recommendationZh : finding.recommendationEn
      const where = finding.surface === 'mcp'
        ? `${finding.server ?? ''}${finding.tool ? ` / ${finding.tool}` : ''}`
        : finding.skill ?? finding.subject
      return h('div', {
        style: {
          ...card,
          marginBottom: 10,
          overflow: 'hidden',
        },
      }, [
        h('button', {
          key: 'head',
          type: 'button',
          onClick: () => setOpen((value) => !value),
          'aria-expanded': open,
          style: {
            display: 'flex',
            width: '100%',
            alignItems: 'flex-start',
            gap: 10,
            padding: '13px 14px',
            border: 0,
            background: 'transparent',
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
            font: 'inherit',
          },
        }, [
          h(SeverityBadge, { key: 's', severity: finding.severity, t }),
          h('span', { key: 'body', style: { flex: 1, minWidth: 0 } }, [
            h('span', { key: 'title', style: { display: 'block', fontSize: 13, fontWeight: 650, lineHeight: '20px' } }, title),
            h('span', { key: 'where', style: { display: 'block', fontSize: 11, color: COLORS.muted, marginTop: 2 } },
              `${finding.surface.toUpperCase()} · ${where}`),
          ]),
          h('span', { key: 'chev', style: { color: COLORS.muted, fontSize: 12, lineHeight: '20px' } }, open ? '−' : '+'),
        ]),
        open ? h('div', {
          key: 'body',
          style: { borderTop: `1px solid ${COLORS.border}`, padding: '12px 14px 14px', background: COLORS.base },
        }, [
          h('div', { key: 'detail', style: { fontSize: 12.5, lineHeight: 1.6, color: COLORS.text } }, detail),
          finding.evidence?.length > 0 ? h('div', { key: 'evidence', style: { marginTop: 10 } }, [
            h('div', { key: 'l', style: { fontSize: 11, fontWeight: 650, color: COLORS.muted, marginBottom: 4 } }, t('evidence')),
            ...finding.evidence.map((item, index) => h('div', {
              key: index,
              style: {
                padding: '7px 9px',
                marginBottom: 5,
                borderRadius: 8,
                background: COLORS.surface2,
                border: `1px solid ${COLORS.border}`,
              },
            }, [
              h('div', { key: 'm', style: { fontSize: 10.5, color: COLORS.muted, marginBottom: 2 } },
                `${t('field')}: ${item.field}${item.line === undefined ? '' : ` · ${t('line')} ${item.line}`}`),
              h('code', { key: 's', style: { display: 'block', fontSize: 11.5, lineHeight: 1.5, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' } }, item.snippet),
            ])),
          ]) : null,
          h('div', { key: 'rec', style: { marginTop: 10, fontSize: 12, lineHeight: 1.55, color: COLORS.text } }, [
            h('span', { key: 'l', style: { fontWeight: 650, color: COLORS.muted } }, `${t('recommendation')} · `),
            recommendation,
          ]),
          h('div', { key: 'meta', style: { marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' } }, [
            h(Pill, { key: 'cat' }, finding.category),
            h(Pill, { key: 'conf' }, `${t('confidence')}: ${finding.confidence}`),
            h(Pill, { key: 'rule' }, finding.rule),
          ]),
        ]) : null,
      ])
    }

    function ServerCard({ server, lang, t }) {
      const [open, setOpen] = React.useState(false)
      const hasFindings = server.findings > 0
      return h('div', {
        style: { ...card, marginBottom: 10, borderColor: hasFindings ? 'var(--dsw-alias-state-warn-primary)' : COLORS.border },
      }, [
        h('button', {
          key: 'head',
          type: 'button',
          onClick: () => setOpen((value) => !value),
          'aria-expanded': open,
          style: {
            width: '100%',
            border: 0,
            background: 'transparent',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 14px',
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'left',
          },
        }, [
          h('span', { key: 's', style: { fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }, server.name),
          h(Pill, { key: 'tools' }, `${server.tools} ${t('tools')}`),
          h(Pill, { key: 'tokens' }, fill(t('tokens'), { n: formatNumber(server.tokens) })),
          server.findings > 0 ? h(Pill, { key: 'risk', tone: COLORS.medium, strong: true }, fill(t('riskSignals'), { n: server.findings })) : null,
          h('span', { key: 'chev', style: { color: COLORS.muted } }, open ? '−' : '+'),
        ]),
        open ? h('div', { key: 'body', style: { borderTop: `1px solid ${COLORS.border}`, padding: '12px 14px', background: COLORS.base } }, [
          server.capabilities?.length > 0 ? h('div', { key: 'caps', style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 } },
            server.capabilities.map((id) => h(Pill, { key: id, tone: COLORS.brand }, capabilityLabel(t, id)))) : null,
          ...server.items.map((tool) => h('div', {
            key: tool.name,
            style: {
              padding: '8px 9px',
              marginBottom: 6,
              borderRadius: 8,
              background: COLORS.surface2,
              border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('div', { key: 'top', style: { display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' } }, [
              h('span', { key: 'n', style: { fontFamily: 'var(--dsw-font-mono, monospace)', fontSize: 11.5, fontWeight: 650, overflowWrap: 'anywhere' } }, tool.name),
              h(Pill, { key: 'tok' }, fill(t('tokens'), { n: formatNumber(tool.tokens) })),
              tool.findings > 0 ? h(Pill, { key: 'f', tone: COLORS.medium }, fill(t('riskSignals'), { n: tool.findings })) : null,
            ]),
            tool.description ? h('div', { key: 'd', style: { marginTop: 4, fontSize: 11.5, lineHeight: 1.5, color: COLORS.muted } }, tool.description) : null,
            tool.capabilities?.length > 0 ? h('div', { key: 'c', style: { marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' } },
              tool.capabilities.map((capability) => h(Pill, { key: capability.id }, capabilityLabel(t, capability.id)))) : null,
          ])),
        ]) : null,
      ])
    }

    function SkillCard({ skill, lang, t }) {
      return h('div', {
        style: { ...card, marginBottom: 10, borderColor: skill.findings > 0 ? 'var(--dsw-alias-state-warn-primary)' : COLORS.border },
      }, [
        h('div', { key: 'head', style: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '13px 14px' } }, [
          h('div', { key: 'body', style: { flex: 1, minWidth: 0 } }, [
            h('div', { key: 'name', style: { fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' } }, skill.name),
            skill.description ? h('div', { key: 'd', style: { marginTop: 3, fontSize: 11.5, lineHeight: 1.5, color: COLORS.muted } }, skill.description) : null,
            h('div', { key: 'meta', style: { marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' } }, [
              h(Pill, { key: 'source' }, skill.source),
              h(Pill, { key: 'tokens' }, fill(t('tokens'), { n: formatNumber(skill.tokens) })),
              skill.findings > 0 ? h(Pill, { key: 'f', tone: COLORS.medium, strong: true }, fill(t('riskSignals'), { n: skill.findings })) : null,
            ]),
            skill.path ? h('div', { key: 'path', style: { marginTop: 6, fontSize: 10.5, color: COLORS.muted, fontFamily: 'var(--dsw-font-mono, monospace)', overflowWrap: 'anywhere' } }, skill.path) : null,
          ]),
          h('div', { key: 'side', style: { flex: '0 0 auto', color: COLORS.muted, fontSize: 11 } }, fill(t('chars'), { n: formatNumber(skill.chars) })),
        ]),
      ])
    }

    function Coverage({ data, t }) {
      const tools = data.coverage?.tools ?? {}
      const skills = data.coverage?.skills ?? {}
      const workspaces = skills.workspaces?.length > 0
        ? skills.workspaces
        : (skills.cwd ? [skills.cwd] : [])
      const workspaceText = workspaces.length > 3
        ? `${workspaces.slice(0, 3).join(' · ')} · +${workspaces.length - 3}`
        : workspaces.join(' · ')
      return h('div', {
        style: { ...card, padding: '12px 14px', marginTop: 12 },
      }, [
        h('div', { key: 't', style: { fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 8 } }, t('coverage')),
        h('div', { key: 'rows', style: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12 } }, [
          h('span', { key: 'tools' }, `${tools.available ? '✓' : '△'} ${tools.available ? t('toolsAvailable') : t('toolsUnavailable')} · ${formatNumber(tools.mcp ?? 0)} MCP / ${formatNumber(tools.total ?? 0)} native`),
          h('span', { key: 'skills' }, `${skills.available ? '✓' : '△'} ${skills.available ? t('skillsAvailable') : t('skillsUnavailable')} · ${formatNumber(skills.scanned ?? 0)} / ${formatNumber(skills.total ?? 0)}`),
          workspaceText ? h('span', { key: 'cwd', style: { color: COLORS.muted } }, `${t('workspace')}: ${workspaceText}`) : null,
        ]),
      ])
    }

    function TrustPage({ ctx }) {
      const t = React.useMemo(() => ctx.locale.bind(NS), [ctx])
      const lang = useLocaleId(ctx)
      const { loading, error, data, refresh } = useReport()
      const [tab, setTab] = React.useState('overview')
      const [busy, setBusy] = React.useState(false)
      const summary = data?.summary
      const findings = data?.findings ?? []
      const tone = summary ? toneForScore(summary.riskScore) : COLORS.muted

      const reload = React.useCallback(() => {
        setBusy(true)
        refresh()
        setTimeout(() => setBusy(false), 600)
      }, [refresh])

      const tabs = [
        ['overview', t('overview'), findings.length],
        ['mcp', t('mcp'), summary?.mcpServers ?? 0],
        ['skills', t('skillTab'), summary?.skills ?? 0],
      ]

      return h('div', {
        style: {
          height: '100%',
          overflowY: 'auto',
          background: COLORS.base,
          color: COLORS.text,
          fontFamily: 'inherit',
        },
      }, h('div', {
        style: { maxWidth: 1060, margin: '0 auto', padding: '26px 26px 64px', boxSizing: 'border-box' },
      }, [
        h('div', { key: 'head', style: { display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 18 } }, [
          h('div', { key: 'left', style: { flex: '1 1 360px', minWidth: 0 } }, [
            h('div', { key: 'eyebrow', style: { display: 'flex', alignItems: 'center', gap: 8, color: COLORS.muted, fontSize: 11, fontWeight: 650, letterSpacing: '.04em', textTransform: 'uppercase' } }, [
              h(Icon, { key: 'i', size: 16, active: true }),
              'MCP × SKILLS',
            ]),
            h('h1', { key: 'title', style: { margin: '5px 0 0', fontSize: 25, lineHeight: 1.25, letterSpacing: '-.02em' } }, t('title')),
            h('p', { key: 'sub', style: { margin: '7px 0 0', fontSize: 13, lineHeight: 1.6, color: COLORS.muted, maxWidth: 720 } }, t('subtitle')),
          ]),
          h('div', { key: 'refresh', style: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 } }, [
            data ? h('span', { key: 'time', style: { fontSize: 11, color: COLORS.muted } },
              `${t('generated')} ${new Date(data.generatedAt).toLocaleTimeString(lang)}`) : null,
            h(Button, { key: 'b', onClick: reload, busy: busy || loading, primary: true }, loading ? t('scanning') : t('refresh')),
          ]),
        ]),

        loading ? h('div', { key: 'loading', style: { ...card, padding: 18, fontSize: 13, color: COLORS.muted } }, t('loading')) : null,

        error !== undefined ? h('div', {
          key: 'err',
          style: { ...card, padding: 18, borderColor: 'var(--dsw-alias-state-error-primary)' },
        }, [
          h('div', { key: 't', style: { fontWeight: 650, fontSize: 13, color: COLORS.high } }, t('error')),
          h('div', { key: 'd', style: { marginTop: 5, fontSize: 12, color: COLORS.muted, overflowWrap: 'anywhere' } }, t('loadFailed')),
          h('div', { key: 'e', style: { marginTop: 4, fontSize: 11, color: COLORS.muted, overflowWrap: 'anywhere' } }, String(error.message ?? error)),
          h('div', { key: 'h', style: { marginTop: 4, fontSize: 11, color: COLORS.muted } }, t('localOnly')),
          h('div', { key: 'r', style: { marginTop: 12 } }, h(Button, { onClick: reload }, t('retry'))),
        ]) : null,

        !loading && data ? h('div', { key: 'data' }, [
          h('div', { key: 'hero', style: { ...card, padding: 18, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'stretch' } }, [
            h('div', {
              key: 'score',
              style: {
                flex: '0 0 190px',
                minWidth: 170,
                borderRadius: 12,
                background: COLORS.base,
                border: `1px solid ${COLORS.border}`,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 4,
              },
            }, [
              h('div', { key: 'l', style: { fontSize: 11, color: COLORS.muted } }, t('score')),
              h('div', { key: 'v', style: { display: 'flex', alignItems: 'baseline', gap: 8 } }, [
                h('span', { key: 'n', style: { fontSize: 46, fontWeight: 800, lineHeight: 1, color: tone, letterSpacing: '-.04em' } }, summary.riskScore),
                h('span', { key: 'max', style: { fontSize: 12, color: COLORS.muted } }, '/ 100'),
              ]),
              h('div', { key: 'g', style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 } }, [
                h(Pill, { tone, strong: true }, `${t('grade')} ${summary.grade}`),
                h('span', { key: 'gt', style: { fontSize: 11, color: COLORS.muted } }, gradeText(t, summary.grade)),
              ]),
            ]),
            h('div', { key: 'metrics', style: { flex: '1 1 520px', display: 'flex', flexWrap: 'wrap', gap: 8 } }, [
              h(Metric, { key: 'h', label: t('high'), value: formatNumber(summary.high), tone: COLORS.high }),
              h(Metric, { key: 'm', label: t('medium'), value: formatNumber(summary.medium), tone: COLORS.medium }),
              h(Metric, { key: 'l', label: t('low'), value: formatNumber(summary.low) }),
              h(Metric, { key: 's', label: t('findings'), value: formatNumber(summary.total) }),
              h(Metric, { key: 'ms', label: t('mcpServers'), value: formatNumber(summary.mcpServers), hint: `${formatNumber(summary.mcpTools)} ${t('mcpTools')}` }),
              h(Metric, { key: 'sk', label: t('skills'), value: formatNumber(summary.skills) }),
              h(Metric, { key: 'ct', label: t('contextTokens'), value: formatNumber(summary.contextTokens), hint: t('approximate') }),
            ]),
          ]),

          h('div', {
            key: 'banner',
            style: {
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 9,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.muted,
              fontSize: 11.5,
              lineHeight: 1.5,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            },
          }, [h('span', { key: 'i', style: { color: COLORS.medium } }, '◆'), h('span', { key: 't' }, t('heuristics'))]),

          h(Coverage, { key: 'coverage', data, t }),

          h('div', { key: 'tabs', style: { display: 'flex', gap: 4, marginTop: 18, marginBottom: 12, flexWrap: 'wrap' } },
            tabs.map(([id, label, count]) => h('button', {
              key: id,
              type: 'button',
              onClick: () => setTab(id),
              style: {
                border: 0,
                borderBottom: tab === id ? `2px solid ${COLORS.brand}` : '2px solid transparent',
                background: 'transparent',
                color: tab === id ? COLORS.text : COLORS.muted,
                font: 'inherit',
                fontSize: 12.5,
                fontWeight: tab === id ? 700 : 500,
                padding: '7px 11px',
                cursor: 'pointer',
              },
            }, `${label}${count > 0 ? ` · ${formatNumber(count)}` : ''}`))),

          tab === 'overview' ? h('div', { key: 'overview' }, [
            findings.length === 0 ? h('div', { key: 'empty', style: { ...card, padding: 20 } }, [
              h('div', { key: 't', style: { fontSize: 14, fontWeight: 650, color: COLORS.safe } }, t('noFindings')),
              h('div', { key: 'd', style: { marginTop: 6, fontSize: 12, lineHeight: 1.6, color: COLORS.muted } }, t('noFindingsDetail')),
            ]) : h('div', { key: 'findings' },
              findings.slice(0, 100).map((finding) => h(FindingCard, { key: finding.id, finding, lang, t }))),
            findings.length > 100 ? h('div', { key: 'more', style: { fontSize: 11, color: COLORS.muted, marginTop: 6 } },
              fill(t('showing'), { shown: 100, total: findings.length })) : null,
          ]) : null,

          tab === 'mcp' ? h('div', { key: 'mcp' }, [
            data.mcp.servers.length === 0 ? h('div', { key: 'empty', style: { ...card, padding: 20 } }, [
              h('div', { key: 't', style: { fontSize: 14, fontWeight: 650 } }, t('noMcp')),
              h('div', { key: 'd', style: { marginTop: 6, fontSize: 12, lineHeight: 1.6, color: COLORS.muted } }, t('noMcpDetail')),
            ]) : h('div', { key: 'servers' },
              data.mcp.servers.map((server) => h(ServerCard, { key: server.name, server, lang, t }))),
          ]) : null,

          tab === 'skills' ? h('div', { key: 'skills' }, [
            data.skills.items.length === 0 ? h('div', { key: 'empty', style: { ...card, padding: 20 } }, [
              h('div', { key: 't', style: { fontSize: 14, fontWeight: 650 } }, t('noSkills')),
              h('div', { key: 'd', style: { marginTop: 6, fontSize: 12, lineHeight: 1.6, color: COLORS.muted } }, t('noSkillsDetail')),
            ]) : h('div', { key: 'items' },
              data.skills.items.map((skill) => h(SkillCard, { key: skill.name, skill, lang, t }))),
          ]) : null,

          data.warnings?.length > 0 ? h('div', { key: 'warn', style: { ...card, marginTop: 16, padding: 14 } }, [
            h('div', { key: 't', style: { fontSize: 12, fontWeight: 700, color: COLORS.medium, marginBottom: 6 } }, t('warnings')),
            ...data.warnings.map((warning, index) => h('div', {
              key: index,
              style: { fontSize: 11.5, lineHeight: 1.55, color: COLORS.muted, overflowWrap: 'anywhere' },
            }, `${warning.code}: ${warning.message}`)),
          ]) : null,

          h('div', { key: 'limits', style: { ...card, marginTop: 16, padding: 14 } }, [
            h('div', { key: 't', style: { fontSize: 12, fontWeight: 700, marginBottom: 7 } }, t('limitations')),
            ...(data.limitations ?? []).map((limit) => h('div', {
              key: limit.code,
              style: { fontSize: 11.5, lineHeight: 1.55, color: COLORS.muted, marginBottom: 4 },
            }, `· ${lang.startsWith('zh') ? limit.zh : limit.en}`)),
          ]),

          h('div', { key: 'privacy', style: { marginTop: 16, padding: '4px 2px', fontSize: 11, lineHeight: 1.6, color: COLORS.muted } }, [
            h('div', { key: 't', style: { fontWeight: 700, marginBottom: 2 } }, t('privacyTitle')),
            h('div', { key: 'd' }, t('privacy')),
          ]),
        ]) : null,
      ]))
    }

    function TrustIcon(props) {
      return h(Icon, { size: props.size ?? 20, active: props.active })
    }

    function capabilityLabel(t, id) {
      const key = `capability_${id}`
      const value = t(key)
      return value === key ? id : value
    }

    function formatNumber(value) {
      return Number(value ?? 0).toLocaleString()
    }

    const name = 'dsh-trust-center-client'
    const inject = ['slots', 'locale']

    function apply(ctx) {
      try {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-trust-center: locale')
      } catch {
        // The UI still works with its fallback Chinese labels.
      }
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'trust-center',
        order: 20,
        locale: NS,
        label: () => t('nav'),
      }, TrustIcon))

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: 'trust-center',
        locale: NS,
        inject: () => ({ ctx }),
      }, TrustPage))

      // A Settings entry is a second, stable discovery surface. It also keeps
      // the panel reachable if a future shell changes global-panel navigation.
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'trust-center',
        order: 45,
        locale: NS,
        label: () => t('nav'),
        inject: () => ({ ctx }),
      }, TrustPage))
    }

    return { name, inject, apply }
  },
})
