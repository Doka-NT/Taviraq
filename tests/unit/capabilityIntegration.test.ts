// SPDX-License-Identifier: MPL-2.0
import { CapabilityRegistry, emitCapabilityAuditEvent } from '@main/capabilities'
import type { AuditSink, MaskingRuleProvider } from '@main/capabilities'
import { createExampleSafetyPolicy } from '@main/capabilities/reference/exampleSafetyPolicy'
import { assessCommandRisk } from '@main/services/llmService'
import { assessProtectedCommandRisk, mergeSafetyAssessments } from '@main/utils/commandRisk'
import { createContextFromTexts, maskText, resolveSecretPlaceholders } from '@main/utils/secretMasking'
import type { CommandRiskAssessmentRequest } from '@shared/types'

function createRiskRequest(command: string): CommandRiskAssessmentRequest {
  return {
    provider: {
      name: 'test',
      baseUrl: 'https://example.test',
      apiKeyRef: 'test',
      commandRiskModel: 'safety-model'
    },
    command,
    context: {
      selectedText: '',
      assistMode: 'agent'
    }
  }
}

describe('capability integration points', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps built-in command risk behavior unchanged with an empty registry', async () => {
    const registry = new CapabilityRegistry()
    const request = createRiskRequest('rm -rf ./build')

    await expect(assessCommandRisk(request, 'off', undefined, undefined, registry))
      .resolves.toEqual(assessProtectedCommandRisk(request))
  })

  it('uses a reference safety-policy without degrading built-in danger checks', async () => {
    const registry = new CapabilityRegistry()
    registry.register(createExampleSafetyPolicy())

    await expect(assessCommandRisk(
      createRiskRequest('taviraq:example-danger'),
      'off',
      undefined,
      undefined,
      registry
    )).resolves.toMatchObject({
      dangerous: true,
      riskLevel: 'warning'
    })

    await expect(assessCommandRisk(
      createRiskRequest('rm -rf ./build && taviraq:example-danger'),
      'off',
      undefined,
      undefined,
      registry
    )).resolves.toMatchObject({
      dangerous: true,
      riskLevel: 'danger'
    })
  })

  it('merges safety assessments by risk while keeping built-in priority on ties', () => {
    const builtinDanger = assessProtectedCommandRisk(createRiskRequest('rm -rf ./build'))
    const builtinWarning = assessProtectedCommandRisk(createRiskRequest('cat .env'))

    expect(mergeSafetyAssessments(builtinDanger, [{
      reason: 'Provider warning',
      riskLevel: 'warning'
    }])).toBe(builtinDanger)

    const providerAssessment = mergeSafetyAssessments(undefined, [{
      reason: 'Provider warning',
      riskLevel: 'warning'
    }])
    expect(providerAssessment).toMatchObject({
      dangerous: true,
      riskLevel: 'warning'
    })
    expect(providerAssessment?.reason).toContain('Provider warning')

    expect(mergeSafetyAssessments(builtinWarning, [{
      reason: 'Provider warning',
      riskLevel: 'warning'
    }])).toBe(builtinWarning)

    expect(mergeSafetyAssessments(undefined, [])).toBeUndefined()
  })

  it('lets masking-rule providers add secrets to the existing mask context', async () => {
    const provider: MaskingRuleProvider = {
      id: 'test.masking',
      kind: 'masking-rule',
      version: '1.0.0',
      findSecrets: (text) => text.includes('INTERNAL_SESSION=local-provider-secret-123456')
        ? [{
            ruleId: 'provider-session',
            secret: 'local-provider-secret-123456',
            match: 'INTERNAL_SESSION=local-provider-secret-123456'
          }]
        : []
    }

    const context = await createContextFromTexts([
      'INTERNAL_SESSION=local-provider-secret-123456'
    ], 'on', undefined, undefined, [provider])

    expect(maskText('token local-provider-secret-123456', context)).toBe('token [[TAVIRAQ_SECRET_1_PROVIDER_SESSION]]')
    expect(resolveSecretPlaceholders('[[TAVIRAQ_SECRET_1_PROVIDER_SESSION]]', context))
      .toBe('local-provider-secret-123456')
  })

  it('fans out audit events and isolates throwing sinks', () => {
    const events: unknown[] = []
    const sink: AuditSink = {
      id: 'test.audit',
      kind: 'audit-sink',
      version: '1.0.0',
      record: (event) => events.push(event)
    }
    const throwingSink: AuditSink = {
      id: 'test.throwing-audit',
      kind: 'audit-sink',
      version: '1.0.0',
      record: () => {
        throw new Error('audit sink failed')
      }
    }
    const errors: string[] = []

    expect(() => emitCapabilityAuditEvent([
      throwingSink,
      sink
    ], {
      type: 'secret-masking',
      at: 1,
      payload: { maskedSecretCount: 1 }
    }, (failedSink) => errors.push(failedSink.id))).not.toThrow()

    expect(errors).toEqual(['test.throwing-audit'])
    expect(events).toEqual([{
      type: 'secret-masking',
      at: 1,
      payload: { maskedSecretCount: 1 }
    }])
  })
})
