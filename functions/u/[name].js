// Shareable profile link: /u/tolu-designs
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
  const name = String(ctx.params.name || '').toLowerCase().slice(0, 40);
  let meta = null;
  if (/^[a-z0-9-]{3,30}$/.test(name) && ctx.env.DB) {
    try {
      const u = await ctx.env.DB.prepare("SELECT id, name, title, city, about, rate_from, rating_sum, rating_count, jobs_done FROM users WHERE username = ? AND cat != '' AND status = 'active'").bind(name).first();
      if (u) {
        const bits = [u.title || 'Freelancer', u.city || 'Nigeria'];
        if (u.rating_count) bits.push((u.rating_sum / u.rating_count).toFixed(1) + '★ from ' + u.rating_count + (u.rating_count === 1 ? ' review' : ' reviews'));
        if (u.rate_from) bits.push('jobs from ' + naira(u.rate_from));
        meta = { title: u.name + ' on Fere', desc: clip(bits.join(' · ') + '. ' + (u.about || ''), 200), route: 'freelancer/' + u.id };
      }
    } catch (e) { console.error('share profile', e && e.message); }
  }
  return sharePage(ctx, meta);
}
