import { describe, expect, it } from 'vitest'
import { normalizeHttpProxyUrl } from '@main/utils/proxy'

describe('proxy utilities', () => {
  it('normalizes HTTP and HTTPS proxy URLs to origins', () => {
    expect(normalizeHttpProxyUrl('http://proxy.local:8080/prefix?route=corp#ignored'))
      .toBe('http://proxy.local:8080')
    expect(normalizeHttpProxyUrl('https://proxy.local:8443')).toBe('https://proxy.local:8443')
  })

  it('rejects SOCKS proxy URLs', () => {
    expect(() => normalizeHttpProxyUrl('socks5://127.0.0.1:1080'))
      .toThrow('Proxy URL must start with http:// or https://')
  })

  it('rejects proxy credentials embedded in the URL', () => {
    expect(() => normalizeHttpProxyUrl('http://user:pass@proxy.local:8080'))
      .toThrow('Enter proxy credentials in the username and password fields.')
  })

  it('rejects invalid proxy URLs', () => {
    expect(() => normalizeHttpProxyUrl('not a url'))
      .toThrow('Proxy URL must be a valid http:// or https:// URL.')
  })
})
