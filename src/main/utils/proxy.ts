export function normalizeHttpProxyUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Proxy URL must be a valid http:// or https:// URL.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Proxy URL must start with http:// or https://')
  }
  if (url.username || url.password) {
    throw new Error('Enter proxy credentials in the username and password fields.')
  }

  url.hash = ''
  return url.toString()
}
