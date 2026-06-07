// SPDX-License-Identifier: MPL-2.0
import type { AuditSink, CapabilityAuditEvent } from './types'

export function emitCapabilityAuditEvent(
  sinks: readonly AuditSink[],
  event: CapabilityAuditEvent,
  onError?: (sink: AuditSink, error: unknown) => void
): void {
  for (const sink of sinks) {
    try {
      sink.record(event)
    } catch (error) {
      onError?.(sink, error)
    }
  }
}
