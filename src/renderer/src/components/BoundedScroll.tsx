// SPDX-License-Identifier: MPL-2.0
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'

interface BoundedScrollProps {
  children: ReactNode
  /** When false, renders children without height constraints or overflow detection.
   * The same DOM structure is used so parent components can always render
   * BoundedScroll without causing a child remount when this flag changes. */
  bounded?: boolean
  /** When true, the container auto-scrolls to the bottom on content growth
   * (unless the user scrolled up or expanded the block). */
  streaming?: boolean
  /** Changes to this value (e.g. content length) trigger a bottom-stick check. */
  scrollToken?: unknown
  showMoreLabel: string
  showLessLabel: string
  ariaLabel?: string
}

/**
 * Wraps a block of content with a bounded height and an internal scroll area.
 * Used for the assistant's live streaming output while the agent is working,
 * so a single verbose step cannot push the rest of the chat off-screen.
 */
export function BoundedScroll({
  children,
  bounded = true,
  streaming = false,
  scrollToken,
  showMoreLabel,
  showLessLabel,
  ariaLabel
}: BoundedScrollProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const contentId = useId()
  const nearBottomRef = useRef(true)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  // Detect overflow whenever the content size changes.
  // We observe the inner content wrapper (contentRef), not the container — the
  // container is capped by max-height so its border-box stops changing once
  // content exceeds the cap, meaning a ResizeObserver on it never fires again
  // and the "show more" toggle never appears during streaming.
  useEffect(() => {
    if (!bounded) return
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      setOverflowing(container.scrollHeight > container.clientHeight + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [bounded])

  // Re-measure when collapsing back: removing the max-height cap (expand) lets
  // clientHeight grow so ResizeObserver reports "no overflow" and would hide the
  // toggle. We keep the toggle mounted while expanded (see render below), and on
  // collapse we recompute overflow directly so the toggle reappears immediately.
  useLayoutEffect(() => {
    if (!bounded) return
    const el = containerRef.current
    if (!el || expanded) return
    setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [bounded, expanded])

  // Keep the bottom in view while streaming, unless the user scrolled up or
  // expanded the block (expanded shows full height, no scroll needed).
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !streaming || expanded) return
    if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [streaming, expanded, scrollToken])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32
  }

  return (
    <div className={`bounded-scroll-wrapper${expanded ? ' expanded' : ''}${!bounded ? ' unbounded' : ''}`}>
      <div
        id={bounded ? contentId : undefined}
        ref={containerRef}
        className="bounded-scroll"
        role={bounded ? 'region' : undefined}
        aria-label={bounded ? ariaLabel : undefined}
        tabIndex={bounded && overflowing && !expanded ? 0 : -1}
        onScroll={handleScroll}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {bounded && (overflowing || expanded) ? (
        <button
          type="button"
          className="quiet-button bounded-scroll-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => { setExpanded((v) => !v) }}
        >
          {expanded ? showLessLabel : showMoreLabel}
        </button>
      ) : null}
    </div>
  )
}
