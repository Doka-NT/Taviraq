import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateStatus } from '@shared/types'
import { UpdateNotice } from '@renderer/components/UpdateNotice'
import { LanguageProvider } from '@renderer/i18n/LanguageContext'

let statusListener: ((status: UpdateStatus) => void) | undefined
const install = vi.fn()

function renderNotice() {
  return render(
    <LanguageProvider language="en">
      <UpdateNotice />
    </LanguageProvider>
  )
}

function emit(status: UpdateStatus) {
  act(() => {
    statusListener?.(status)
  })
}

beforeEach(() => {
  statusListener = undefined
  install.mockReset()
  vi.stubGlobal('api', {
    update: {
      getStatus: vi.fn().mockResolvedValue({ state: 'idle' } satisfies UpdateStatus),
      check: vi.fn().mockResolvedValue(undefined),
      install,
      onStatus: (cb: (status: UpdateStatus) => void) => {
        statusListener = cb
        return () => {
          statusListener = undefined
        }
      }
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UpdateNotice', () => {
  it('renders nothing while idle', async () => {
    const { container } = renderNotice()
    await waitFor(() => expect(window.api.update.getStatus).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('shows download progress', async () => {
    renderNotice()
    await waitFor(() => expect(statusListener).toBeDefined())
    emit({ state: 'downloading', percent: 42 })
    expect(screen.getByText(/42%/)).toBeInTheDocument()
  })

  it('offers a restart when the update is downloaded and installs on click', async () => {
    renderNotice()
    await waitFor(() => expect(statusListener).toBeDefined())
    emit({ state: 'downloaded', version: '0.6.0' })
    expect(screen.getByText(/0\.6\.0/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('can be dismissed', async () => {
    const { container } = renderNotice()
    await waitFor(() => expect(statusListener).toBeDefined())
    emit({ state: 'downloaded', version: '0.6.0' })
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(container.firstChild).toBeNull()
  })
})
