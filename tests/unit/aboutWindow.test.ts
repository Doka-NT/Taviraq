import { createAboutWindowHtml } from '@main/utils/aboutWindow'

describe('about window html', () => {
  it('renders the Taviraq app icon instead of the placeholder mark', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2',
      websiteHref: 'https://taviraq.dev',
      supportHref: 'https://boosty.to/taviraq',
      iconDataUrl: 'data:image/png;base64,icon'
    })

    expect(html).toContain('img-src data:')
    expect(html).toContain('<img class="mark" src="data:image/png;base64,icon" width="72" height="72" alt="Taviraq app icon">')
    expect(html).not.toContain('>T</div>')
    expect(html).not.toContain('linear-gradient')
  })

  it('closes from background clicks without visible controls', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2',
      websiteHref: 'https://taviraq.dev',
      supportHref: 'https://boosty.to/taviraq',
      iconDataUrl: 'data:image/png;base64,icon'
    })

    expect(html).toContain("document.querySelector('main')")
    expect(html).toContain('!content?.contains(event.target)')
    expect(html).toContain('window.close()')
    expect(html).not.toContain('<button')
  })

  it('avoids a broken image when the icon data URL is unavailable', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2',
      websiteHref: 'https://taviraq.dev',
      supportHref: 'https://boosty.to/taviraq',
      iconDataUrl: ''
    })

    expect(html).toContain('<div class="mark mark-fallback" role="img" aria-label="Taviraq app icon"></div>')
    expect(html).not.toContain('src=""')
    expect(html).not.toContain('>T</div>')
  })

  it('escapes dynamic values before inserting them into the document', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2"><script>',
      websiteHref: 'https://taviraq.dev/?q=<x>',
      supportHref: 'https://boosty.to/taviraq?q=<x>',
      iconDataUrl: 'data:image/png;base64,&icon'
    })

    expect(html).toContain('Version 0.2.2&quot;&gt;&lt;script&gt;')
    expect(html).toContain('https://taviraq.dev/?q=&lt;x&gt;')
    expect(html).toContain('https://boosty.to/taviraq?q=&lt;x&gt;')
    expect(html).toContain('data:image/png;base64,&amp;icon')
    expect(html).not.toContain('0.2.2"><script>')
  })

  it('links to project support from the about window', () => {
    const html = createAboutWindowHtml({
      version: '0.2.2',
      websiteHref: 'https://taviraq.dev',
      supportHref: 'https://boosty.to/taviraq',
      iconDataUrl: 'data:image/png;base64,icon'
    })

    expect(html).toContain('<a href="https://boosty.to/taviraq" target="_blank" rel="noreferrer">Support development</a>')
  })
})
