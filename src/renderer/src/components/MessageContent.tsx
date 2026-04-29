import { Play } from 'lucide-react'

interface MessageContentProps {
  content: string
  onRun?: (command: string) => void
  disabled?: boolean
}

type Segment =
  | { type: 'text'; text: string }
  | { type: 'code'; code: string }

type TextBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'table'; header: string[]; rows: string[][] }

const FENCE_RE = /```(?:bash|sh|shell|zsh|cmd)?\n([\s\S]*?)```/g

function parseContent(content: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of content.matchAll(FENCE_RE)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'code', code: match[1].trim() })
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
    const header = parseTableRow(lines[index])
    const separator = parseTableRow(lines[index + 1] ?? '')

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

function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('`')) {
      parts.push(<code key={m.index} className="inline-code">{token.slice(1, -1)}</code>)
    } else {
      parts.push(<strong key={m.index}>{token.slice(2, -2)}</strong>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function MessageContent({ content, onRun, disabled }: MessageContentProps): JSX.Element {
  const segments = parseContent(content)

  return (
    <div className="message-content">
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          return (
            <div className="msg-code-block" key={i}>
              <pre><code>{seg.code}</code></pre>
              {onRun ? (
                <button
                  className="msg-run-button"
                  type="button"
                  disabled={disabled}
                  onClick={() => onRun(seg.code)}
                  title="Run in terminal"
                >
                  <Play size={11} aria-hidden />
                  Run
                </button>
              ) : null}
            </div>
          )
        }

        return parseTextBlocks(seg.text).map((block, j) => {
          if (block.type === 'table') {
            return (
              <div className="message-table-wrap" key={`${i}-${j}`}>
                <table className="message-table">
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex}>{renderInline(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          return <p key={`${i}-${j}`}>{renderInline(block.text)}</p>
        })
      })}
    </div>
  )
}
