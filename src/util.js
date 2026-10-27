/** Small dependency-free helpers shared by the scanner, host routes, and tests. */

import { createHash } from 'node:crypto'

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u{1F000}-\u{1FAFF}]/u
const CONTROL_OR_FORMAT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|\uDB40[\uDC00-\uDFFF]/gu

/**
 * Approximate model tokens for a piece of text. This is deliberately labelled
 * approximate in the product; use provider usage for billing, not this.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  let weighted = 0
  for (const character of String(text ?? '')) {
    weighted += CJK.test(character) ? 1 : 0.25
  }
  return Math.ceil(weighted)
}

/** UTF-8 byte size without relying on Buffer in browser-facing code. */
export function utf8Bytes(text) {
  return new TextEncoder().encode(String(text ?? '')).length
}

/** Clamp a number. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/** Stable short identifier for a subject. */
export function shortHash(text) {
  return createHash('sha1').update(String(text)).digest('hex').slice(0, 12)
}

/** 1-based line number for a character offset. */
export function lineAt(text, offset) {
  if (typeof text !== 'string' || offset < 0) return undefined
  let line = 1
  const end = Math.min(offset, text.length)
  for (let index = 0; index < end; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1
  }
  return line
}

/**
 * Make a compact, single-line evidence snippet and escape invisible controls so
 * the reviewer can see what is actually present.
 * @param {string} text
 * @param {number} index
 * @param {number} [radius]
 * @returns {string}
 */
export function evidenceSnippet(text, index, radius = 72) {
  const source = String(text ?? '')
  const start = Math.max(0, index - radius)
  const end = Math.min(source.length, index + radius)
  const slice = source.slice(start, end)
  return slice
    .replace(CONTROL_OR_FORMAT, (character) => `⟦U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}⟧`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

/** Display a path without the user's home directory. */
export function displayPath(path) {
  if (typeof path !== 'string' || path.length === 0) return undefined
  const home = globalThis.process?.env?.USERPROFILE || globalThis.process?.env?.HOME
  if (typeof home === 'string' && home.length > 0 && path.toLowerCase().startsWith(home.toLowerCase())) {
    return `~${path.slice(home.length).replaceAll('\\', '/')}`
  }
  return path.replaceAll('\\', '/')
}

/** Sort findings by severity then surface/subject. */
export function compareFindings(a, b) {
  const rank = { high: 0, medium: 1, low: 2, info: 3 }
  return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)
    || String(a.surface).localeCompare(String(b.surface))
    || String(a.subject).localeCompare(String(b.subject))
    || String(a.rule).localeCompare(String(b.rule))
}

/** Cap a string for a UI field without splitting astral pairs. */
export function truncate(text, max) {
  const value = String(text ?? '')
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1))}…`
}
