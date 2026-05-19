import { createAboutWindowHtml } from '@main/utils/aboutWindow'

describe('about window html', () => {
  it('renders the Taviraq app icon instead of the placeholder mark', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2',
      websiteHref: 'https://taviraq.dev',
      iconDataUrl: 'data:image/png;base64,icon'
    })

    expect(html).toContain('img-src data:')
    expect(html).toContain('<img class="mark" src="data:image/png;base64,icon" width="72" height="72" alt="Taviraq app icon">')
    expect(html).not.toContain('>T</div>')
    expect(html).not.toContain('linear-gradient')
  })

  it('closes from Esc and background clicks without visible controls', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2',
      websiteHref: 'https://taviraq.dev',
      iconDataUrl: 'data:image/png;base64,icon'
    })

    expect(html).toContain("event.key === 'Escape'")
    expect(html).toContain('event.target === document.body')
    expect(html).toContain('window.close()')
    expect(html).not.toContain('<button')
  })

  it('escapes dynamic values before inserting them into the document', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2"><script>',
      websiteHref: 'https://taviraq.dev/?q=<x>',
      iconDataUrl: 'data:image/png;base64,&icon'
    })

    expect(html).toContain('Version 0.2.2&quot;&gt;&lt;script&gt;')
    expect(html).toContain('https://taviraq.dev/?q=&lt;x&gt;')
    expect(html).toContain('data:image/png;base64,&amp;icon')
    expect(html).not.toContain('0.2.2"><script>')
  })
})
