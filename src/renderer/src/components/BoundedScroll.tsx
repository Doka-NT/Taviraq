// SPDX-License-Identifier: MPL-2.0
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'

interface BoundedScrollProps {
  children: ReactNode
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
  streaming = false,
  scrollToken,
  showMoreLabel,
  showLessLabel,
  ariaLabel
}: BoundedScrollProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  // Detect overflow whenever the measured content size changes.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      setOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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

  const contentId = 'bounded-scroll-content'

  return (
    <div className={`bounded-scroll-wrapper${expanded ? ' expanded' : ''}`}>
      <div
        id={contentId}
        ref={containerRef}
        className="bounded-scroll"
        role="region"
        aria-label={ariaLabel}
        tabIndex={overflowing && !expanded ? 0 : -1}
        onScroll={handleScroll}
      >
        {children}
      </div>
      {overflowing ? (
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
