import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function siteOrigin(value, required = false) {
  if (!value) {
    if (required) throw new Error('Set SITE_URL to the production HTTPS origin before building a release.')
    return null
  }
  const url = new URL(value)
  if (url.protocol !== 'https:' || !/^[a-z0-9.-]+$/i.test(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be an HTTPS origin without credentials, a path, query, or fragment.')
  }
  return url.origin
}

export function applySiteMetadata(html, canonical) {
  const image = new URL('/free-roam/coast.jpg', canonical).href
  return html.replace('content="/free-roam/coast.jpg"', `content="${image}"`)
    .replace('</head>', `    <link rel="canonical" href="${canonical}" />\n    <meta property="og:url" content="${canonical}" />\n    <meta name="twitter:image" content="${image}" />\n  </head>`)
}

export function writeSiteMetadata(directory, origin) {
  if (!origin) return
  const routes = [{ file: 'index.html', path: '/' }, { file: 'free-roam/index.html', path: '/free-roam/' }]
  for (const route of routes) {
    const file = join(directory, route.file)
    writeFileSync(file, applySiteMetadata(readFileSync(file, 'utf8'), `${origin}${route.path}`))
  }
  writeFileSync(join(directory, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /studio.html\nDisallow: /library/\nSitemap: ${origin}/sitemap.xml\n`)
  writeFileSync(join(directory, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${origin}${route.path}</loc></url>`).join('\n')}\n</urlset>\n`)
}
