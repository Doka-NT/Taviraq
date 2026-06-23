// SPDX-License-Identifier: MPL-2.0
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, Play, TerminalSquare } from 'lucide-react'
import { buildActionChips, detectMiniBarRows } from '@renderer/utils/redesign'
import { TASK_LIST_FENCE_LANG, TASK_PLAN_FENCE_LANG } from '@shared/taskList'

interface MessageContentProps {
  content: string
  onRun?: (command: string) => void | Promise<void>
  onPrompt?: (prompt: string) => void
  redactContent?: (text: string) => string
  disabled?: boolean
  runLabel?: string
  expandCommandLabel?: string
  collapseCommandLabel?: string
  copyCodeLabel?: string
  copiedLabel?: string
}

type Segment =
  | { type: 'text'; text: string }
  | { type: 'code'; code: string; lang: string }

type TextBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; header: string[]; rows: string[][] }

const FENCE_RE = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'cmd', 'fish', 'ksh'])
// Planning fences are derived state rendered by TaskListPanel, so they must not
// also surface as raw code blocks inside the message body (issue #163).
const HIDDEN_FENCE_LANGS = new Set([TASK_LIST_FENCE_LANG, TASK_PLAN_FENCE_LANG])
const COLLAPSIBLE_SHELL_LINE_COUNT = 3
const COLLAPSIBLE_SHELL_CHAR_COUNT = 96

function parseContent(content: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of content.matchAll(FENCE_RE)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, match.index) })
    }
    if (!HIDDEN_FENCE_LANGS.has(match[1].toLowerCase())) {
      segments.push({ type: 'code', lang: match[1], code: match[2].trim() })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', text: content.slice(lastIndex) })
  }

  return segments
}

function parseTextBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = []
  const paragraphLines: string[] = []
  const lines = text.split('\n')

  const flushParagraph = (): void => {
    const paragraph = paragraphLines.join('\n').trim()
    if (paragraph) {
      blocks.push({ type: 'paragraph', text: paragraph })
    }
    paragraphLines.length = 0
  }

  for (let index = 0; index < lines.length; index += 1) {
    const heading = parseHeading(lines[index])
    const header = parseTableRow(lines[index])
    const separator = parseTableRow(lines[index + 1] ?? '')

    if (heading) {
      flushParagraph()
      blocks.push(heading)
      continue
    }

    if (header && separator && isTableSeparator(separator) && header.length === separator.length) {
      const rows: string[][] = []
      index += 2

      while (index < lines.length) {
        const row = parseTableRow(lines[index])
        if (!row || row.length !== header.length) break
        rows.push(row)
        index += 1
      }

      flushParagraph()
      blocks.push({ type: 'table', header, rows })
      index -= 1
      continue
    }

    if (!lines[index].trim()) {
      flushParagraph()
      continue
    }

    paragraphLines.push(lines[index])
  }

  flushParagraph()
  return blocks
}

function parseHeading(line: string): TextBlock | undefined {
  const match = /^(#{1,6})\s+(.+)$/.exec(line.trim())
  if (!match) return undefined

  return {
    type: 'heading',
    level: match[1].length,
    text: match[2].trim()
  }
}

function parseTableRow(line: string): string[] | undefined {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return undefined

  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

  return cells.length > 1 ? cells : undefined
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function renderInline(text: string, redactContent: (text: string) => string = (value) => value): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(redactContent(text.slice(last, m.index)))
    const token = m[0]
    if (token.startsWith('`')) {
      parts.push(<code key={m.index} className="inline-code">{redactContent(token.slice(1, -1))}</code>)
    } else {
      parts.push(<strong key={m.index}>{redactContent(token.slice(2, -2))}</strong>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(redactContent(text.slice(last)))
  return parts
}

export function MessageContent({
  content,
  onRun,
  onPrompt,
  redactContent = (value) => value,
  disabled,
  runLabel = 'Run in terminal',
  expandCommandLabel = 'Show full command',
  collapseCommandLabel = 'Collapse command',
  copyCodeLabel = 'Copy code',
  copiedLabel = 'Copied'
}: MessageContentProps): JSX.Element {
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Set<number>>(() => new Set())
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<number | null>(null)
  const copiedCodeBlockTimerRef = useRef<number>()
  const segments = parseContent(content)
  const actionChips = onPrompt ? buildActionChips(content) : []

  useEffect(() => {
    return () => {
      if (copiedCodeBlockTimerRef.current) {
        window.clearTimeout(copiedCodeBlockTimerRef.current)
      }
    }
  }, [])

  const toggleCodeBlock = (index: number): void => {
    setExpandedCodeBlocks((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const copyCodeBlock = async (index: number, code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(redactContent(code))
    } catch {
      return
    }
    setCopiedCodeBlock(index)
    if (copiedCodeBlockTimerRef.current) {
      window.clearTimeout(copiedCodeBlockTimerRef.current)
    }
    copiedCodeBlockTimerRef.current = window.setTimeout(() => {
      setCopiedCodeBlock(null)
      copiedCodeBlockTimerRef.current = undefined
    }, 1500)
  }

  return (
    <div className="message-content">
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          const normalizedLang = seg.lang.toLowerCase()
          const isShell = SHELL_LANGS.has(normalizedLang)
          const codeLanguage = normalizedLang || 'code'
          const isCollapsibleShell = isShell && (
            seg.code.split('\n').length > COLLAPSIBLE_SHELL_LINE_COUNT ||
            seg.code.length > COLLAPSIBLE_SHELL_CHAR_COUNT
          )
          const isExpanded = expandedCodeBlocks.has(i)

          if (!isShell) {
            return (
              <div className="msg-code-block" key={i}>
                <div className="msg-code-block-header">
                  <span>{codeLanguage}</span>
                  <button
                    className="msg-copy-button"
                    type="button"
                    onClick={() => { void copyCodeBlock(i, seg.code) }}
                    title={copiedCodeBlock === i ? copiedLabel : copyCodeLabel}
                    aria-label={copiedCodeBlock === i ? copiedLabel : copyCodeLabel}
                  >
                    {copiedCodeBlock === i ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                  </button>
                </div>
                <pre><code>{redactContent(seg.code)}</code></pre>
              </div>
            )
          }

          return (
            <div
              className={[
                'msg-action-pill',
                isCollapsibleShell ? 'msg-action-pill--multiline' : '',
                isCollapsibleShell && !isExpanded ? 'msg-action-pill--collapsed' : ''
              ].filter(Boolean).join(' ')}
              key={i}
            >
              <TerminalSquare size={12} aria-hidden />
              <code>{redactContent(seg.code)}</code>
              {isCollapsibleShell ? (
                <button
                  className="msg-expand-button"
                  type="button"
                  onClick={() => toggleCodeBlock(i)}
                  title={isExpanded ? collapseCommandLabel : expandCommandLabel}
                  aria-label={isExpanded ? collapseCommandLabel : expandCommandLabel}
                >
                  {isExpanded ? <ChevronUp size={11} aria-hidden /> : <ChevronDown size={11} aria-hidden />}
                </button>
              ) : null}
              <button
                className="msg-copy-button"
                type="button"
                onClick={() => { void copyCodeBlock(i, seg.code) }}
                title={copiedCodeBlock === i ? copiedLabel : copyCodeLabel}
                aria-label={copiedCodeBlock === i ? copiedLabel : copyCodeLabel}
              >
                {copiedCodeBlock === i ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
              </button>
              {onRun ? (
                <button
                  className="msg-run-button"
                  type="button"
                  disabled={disabled}
                  onClick={() => { void onRun(seg.code) }}
                  title={runLabel}
                  aria-label={runLabel}
                >
                  <Play size={11} aria-hidden />
                </button>
              ) : null}
            </div>
          )
        }

        return parseTextBlocks(seg.text).map((block, j) => {
          if (block.type === 'table') {
            const miniBars = detectMiniBarRows(block.header, block.rows)

            return (
              <div className="message-table-group" key={`${i}-${j}`}>
                <div className="message-table-wrap">
                  <table className="message-table">
                    <thead>
                      <tr>
                        {block.header.map((cell, cellIndex) => (
                          <th key={cellIndex}>{renderInline(cell, redactContent)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{renderInline(cell, redactContent)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {miniBars.length > 0 ? (
                  <div className="mini-bars" aria-label="Visual summary">
                    {miniBars.map((bar) => (
                      <div className="mini-bar-row" key={`${bar.label}-${bar.displayValue}`}>
                        <div className="mini-bar-labels">
                          <span>{bar.label}</span>
                          <strong>{bar.displayValue}</strong>
                        </div>
                        <div className="mini-bar-track">
                          <span style={{ width: `${Math.max(4, Math.round(bar.ratio * 100))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          }

          if (block.type === 'heading') {
            const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements

            return (
              <HeadingTag className={`message-heading message-heading--${block.level}`} key={`${i}-${j}`}>
                {renderInline(block.text, redactContent)}
              </HeadingTag>
            )
          }

          return <p key={`${i}-${j}`}>{renderInline(block.text, redactContent)}</p>
        })
      })}
      {actionChips.length > 0 ? (
        <div className="message-action-chips">
          {actionChips.map((chip) => (
            <button type="button" key={chip.label} onClick={() => onPrompt?.(chip.prompt)}>
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
