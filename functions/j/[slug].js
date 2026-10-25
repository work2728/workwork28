// Shareable job link: /j/12-design-a-logo-for-my-bakery
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-US');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
async function sharePage(ctx, meta) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(new URL('/', url));
  let html = await res.text();
  const site = (env.SITE_URL || url.origin).replace(/\/+$/, '');
  if (meta) {
    const title = meta.title + ' · Fere';
    const img = site + '/og.jpg';
    const tags = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Fere">',
      '<meta property="og:title" content="' + esc(meta.title) + '">',
      '<meta property="og:description" content="' + esc(meta.desc) + '">',
      '<meta property="og:url" content="' + esc(site + url.pathname) + '">',
      '<meta property="og:image" content="' + esc(img) + '">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<link rel="canonical" href="' + esc(site + url.pathname) + '">'
    ].join('\n');
    html = html
      .replace(/<meta (?:property="og:|name="twitter:)[^>]*>\n?/g, '')
      .replace(/<link rel="canonical"[^>]*>\n?/g, '')
      .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
      .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="' + esc(meta.desc) + '">');
    html = html.replace('</head>', tags + '\n<script>window.__ROUTE=' + JSON.stringify(meta.route).replace(/</g, '\\u003c') + ';</script>\n</head>');
  }
  return new Response(html, { status: meta ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin' } });
}

export async function onRequestGet(ctx) {
  const id = parseInt(String(ctx.params.slug || ''), 10) || 0;
  let meta = null;
  if (id && ctx.env.DB) {
    try {
      const j = await ctx.env.DB.prepare("SELECT j.id, j.title, j.descr, j.budget, j.city, j.remote, j.status, u.name, u.business FROM jobs j JOIN users u ON u.id = j.client_id WHERE j.id = ? AND j.status != 'removed'").bind(id).first();
      if (j) {
        const where = j.remote ? 'Remote' : (j.city || 'Nigeria');
        meta = {
          title: j.title,
          desc: clip(naira(j.budget) + ' fixed price · ' + where + (j.status === 'open' ? '' : ' · No longer taking proposals') + '. ' + j.descr, 200),
          route: 'job/' + j.id
        };
      }
    } catch (e) { console.error('share job', e && e.message); }
  }
  return sharePage(ctx, meta);
}
