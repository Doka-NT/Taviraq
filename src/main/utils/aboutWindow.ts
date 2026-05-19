export interface AboutWindowHtmlOptions {
  version: string
  websiteHref: string
  iconDataUrl: string
}

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export function createAboutWindowHtml({ version, websiteHref, iconDataUrl }: AboutWindowHtmlOptions): string {
  const applicationVersion = escapeHtml(version)
  const safeWebsiteHref = escapeHtml(websiteHref)
  const safeIconDataUrl = escapeHtml(iconDataUrl)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>About Taviraq</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #10101a;
        color: #f4f4f8;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        text-align: center;
      }
      main {
        display: grid;
        gap: 12px;
        justify-items: center;
        padding: 28px;
      }
      h1 {
        margin: 0;
        font-size: 26px;
        font-weight: 650;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: #b8b8c6;
        font-size: 13px;
        line-height: 1.5;
      }
      a {
        color: #8bd5ff;
        font-size: 13px;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .mark {
        width: 72px;
        height: 72px;
        border-radius: 18px;
        display: block;
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);
      }
    </style>
  </head>
  <body>
    <main>
      <img class="mark" src="${safeIconDataUrl}" width="72" height="72" alt="Taviraq app icon">
      <h1>Taviraq</h1>
      <p>Version ${applicationVersion}</p>
      <a href="${safeWebsiteHref}" target="_blank" rel="noreferrer">${safeWebsiteHref}</a>
      <p>AI-native macOS terminal</p>
    </main>
    <script>
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          window.close()
        }
      })
      document.body.addEventListener('click', (event) => {
        if (event.target === document.body) {
          window.close()
        }
      })
    </script>
  </body>
</html>`
}
