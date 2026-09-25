import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
const buildEnv = loadEnv('production', process.cwd(), '');
const siteUrl = process.env.VITE_SITE_URL || buildEnv.VITE_SITE_URL || 'https://your-domain.example';
const common = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SITE_URL: siteUrl,
    }),
  },
};
await build({ ...common, entryPoints: ['edge/edgeone/entry.ts'], outfile: 'edge-functions/api/[[path]].js' });
await build({
  ...common,
  entryPoints: ['edge/cloudflare/pages.ts'],
  external: ['cloudflare:sockets'],
  outfile: 'dist/_worker.js',
});
// OpenAPI and SEO are generated from the same source configuration as the application.
const config = await build({ ...common, entryPoints: ['api/openapi.ts'], write: false });
const module = await import(
  'data:text/javascript;base64,' + Buffer.from(config.outputFiles[0].text).toString('base64')
);
await writeFile('dist/openapi.json', JSON.stringify(module.openApi(), null, 2));
await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
const siteSource = await readFile('src/config/site.ts', 'utf8');
const brand = siteSource.match(/name:\s*'([^']+)'/)?.[1] || 'Network';
const base = siteUrl.replace(/\/$/, '');
const pages = {
  '/': 'Overview',
  '/ip': 'IP Lookup',
  '/asn': 'ASN Lookup',
  '/risk': 'Risk Analysis',
  '/ping': 'Ping',
  '/tcping': 'TCP Ping',
  '/http-ping': 'HTTP Ping',
  '/latency': 'Latency Test',
  '/dns-lookup': 'DNS Lookup',
  '/reverse': 'Reverse DNS',
  '/global': 'Global Ping',
  '/trace': 'Traceroute',
  '/environment': 'Browser Environment',
  '/fingerprint': 'Browser Fingerprint',
  '/webrtc': 'WebRTC Leak Test',
  '/dns': 'DNS Leak Test',
  '/developers': 'API Reference',
  '/status': 'System Status',
  '/tools': 'Network Tools',
};
const escape = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const html = await readFile('dist/index.html', 'utf8');
for (const [path, title] of Object.entries(pages)) {
  const url = base + (path === '/' ? '' : path);
  const page = html
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/,
      `<meta name="description" content="${escape(title + ' — transparent network diagnostics with explicit sources and privacy-first browser tools.')}"/>`,
    )
    .replace(/<title>.*?<\/title>/, `<title>${escape(title + ' · ' + brand)}</title>`)
    .replace(
      '</head>',
      `<link rel="canonical" href="${escape(url)}"/><meta property="og:title" content="${escape(title + ' · ' + brand)}"/><meta property="og:description" content="Transparent ${escape(title.toLowerCase())} with explicit data sources and no fabricated results."/><meta property="og:type" content="website"/><meta property="og:url" content="${escape(url)}"/></head>`,
    );
  if (path === '/') await writeFile('dist/index.html', page);
  else {
    await mkdir(resolve('dist', '.' + path), { recursive: true });
    await writeFile(resolve('dist', '.' + path, 'index.html'), page);
  }
}
await writeFile(
  'dist/robots.txt',
  `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`,
);
await writeFile(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(
    pages,
  )
    .map((path) => `<url><loc>${escape(base + (path === '/' ? '' : path))}</loc></url>`)
    .join('')}</urlset>`,
);
console.log('Built Cloudflare Pages worker, EdgeOne Functions, OpenAPI, and per-page SEO.');
