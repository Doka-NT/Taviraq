// SPDX-License-Identifier: MPL-2.0
import { act } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoundedScroll } from '@renderer/components/BoundedScroll'

// jsdom reports 0/0 sizes and has no ResizeObserver; stub the observer so the
// overflow effect runs its initial measurement during render.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

/** Force HTMLElement sizes so the overflow detector (scrollHeight > clientHeight)
 *  resolves deterministically in jsdom. Returns a restore callback. */
function overrideSizes(scrollHeight: number, clientHeight: number): () => void {
  const proto = HTMLElement.prototype as unknown as Record<string, PropertyDescriptor>
  const scrollDesc = Object.getOwnPropertyDescriptor(proto, 'scrollHeight')
  const clientDesc = Object.getOwnPropertyDescriptor(proto, 'clientHeight')
  Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => clientHeight })
  return () => {
    if (scrollDesc) Object.defineProperty(proto, 'scrollHeight', scrollDesc)
    else delete proto.scrollHeight
    if (clientDesc) Object.defineProperty(proto, 'clientHeight', clientDesc)
    else delete proto.clientHeight
  }
}

describe('BoundedScroll', () => {
  it('renders its children inside the bounded region', () => {
    const { container } = render(
      <BoundedScroll showMoreLabel="more" showLessLabel="less">hello world</BoundedScroll>
    )
    expect(container.querySelector('.bounded-scroll')?.textContent).toContain('hello world')
  })

  it('uses unique ARIA targets and only labels bounded messages as the current step', () => {
    const restore = overrideSizes(500, 100)
    const { container } = render(
      <>
        <BoundedScroll bounded={false} ariaLabel="current step" showMoreLabel="more" showLessLabel="less">
          historical message
        </BoundedScroll>
        <BoundedScroll ariaLabel="current step" showMoreLabel="more" showLessLabel="less">
          first live message
        </BoundedScroll>
        <BoundedScroll ariaLabel="current step" showMoreLabel="more" showLessLabel="less">
          second live message
        </BoundedScroll>
      </>
    )

    const regions = Array.from(container.querySelectorAll<HTMLElement>('[role="region"]'))
    const toggles = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    expect(regions).toHaveLength(2)
    expect(toggles).toHaveLength(2)
    expect(container.querySelector('.unbounded .bounded-scroll')?.hasAttribute('id')).toBe(false)
    expect(container.querySelector('.unbounded .bounded-scroll')?.hasAttribute('aria-label')).toBe(false)
    expect(regions[0].id).not.toBe(regions[1].id)
    expect(toggles[0].getAttribute('aria-controls')).toBe(regions[0].id)
    expect(toggles[1].getAttribute('aria-controls')).toBe(regions[1].id)
    expect(document.getElementById(regions[0].id)).toBe(regions[0])
    expect(document.getElementById(regions[1].id)).toBe(regions[1])
    restore()
  })

  it('does not show the toggle when content fits', () => {
    const { container } = render(
      <BoundedScroll showMoreLabel="more" showLessLabel="less">short</BoundedScroll>
    )
    // jsdom defaults: scrollHeight 0, clientHeight 0 -> no overflow
    expect(container.querySelector('button')).toBeNull()
  })

  it('shows the toggle and flips expansion state when content overflows', () => {
    const restore = overrideSizes(500, 100)
    const { container } = render(
      <BoundedScroll showMoreLabel="more" showLessLabel="less">long body</BoundedScroll>
    )
    const toggle = container.querySelector('button') as HTMLButtonElement
    const region = container.querySelector('[role="region"]') as HTMLElement
    expect(toggle).not.toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-controls')).toBe(region.id)
    fireEvent.click(toggle)
    expect(container.querySelector('.bounded-scroll-wrapper')?.classList.contains('expanded')).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    restore()
  })

  it('sticks to the bottom while streaming', () => {
    const restore = overrideSizes(500, 100)
    const { container } = render(
      <BoundedScroll streaming showMoreLabel="more" showLessLabel="less">streaming body</BoundedScroll>
    )
    const region = container.querySelector('.bounded-scroll') as HTMLElement
    // nearBottomRef starts true -> scrollTop pinned to scrollHeight
    expect(region.scrollTop).toBe(500)
    restore()
  })

  it('shows the toggle when content grows past the cap during streaming', () => {
    // Regression: the fix observes the inner content wrapper (not the max-height-
    // capped container), so ResizeObserver fires again as tokens arrive and the
    // "show more" button appears even when the cap is already hit.
    let triggerResize: (() => void) | null = null
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) {
        triggerResize = () => cb([], this as unknown as ResizeObserver)
      }
      observe() { /* noop */ }
      disconnect() { triggerResize = null }
    })

    // Phase 1: content fits — no toggle.
    let restoreSizes = overrideSizes(50, 50)
    const { container } = render(
      <BoundedScroll streaming scrollToken={1} showMoreLabel="more" showLessLabel="less">
        content
      </BoundedScroll>
    )
    expect(container.querySelector('button')).toBeNull()

    // Phase 2: content grows past the bounded cap — simulate ResizeObserver firing.
    restoreSizes()
    restoreSizes = overrideSizes(500, 100)
    act(() => { triggerResize!() })

    expect(container.querySelector('button')).not.toBeNull()
    expect(container.querySelector('button')?.textContent).toBe('more')
    restoreSizes()
  })

  it('keeps the toggle reachable after expanding so it can collapse again', () => {
    const restore = overrideSizes(500, 100)
    const { container } = render(
      <BoundedScroll showMoreLabel="more" showLessLabel="less">long body</BoundedScroll>
    )
    const toggle = container.querySelector('button') as HTMLButtonElement
    fireEvent.click(toggle)
    // After expand the toggle must stay mounted ("Show less"); otherwise once the
    // max-height cap is removed the overflow check would hide it and trap the user
    // in the expanded state.
    const toggleAfterExpand = container.querySelector('button') as HTMLButtonElement
    expect(toggleAfterExpand).not.toBeNull()
    expect(toggleAfterExpand.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggleAfterExpand)
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false')
    restore()
  })
})
