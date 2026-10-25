/* PadiHire web app. Talks to /api (Cloudflare Pages Functions). Needs common.js first. */
(function () {
  'use strict';

  var S = {
    me: { user: null }, view: '', arg: '', qs: null, data: null, seq: 0, navs: 0,
    q: blankQ(), xmode: 'jobs', wtab: 'best', ptab: 'active', ktab: 'active', ctab: 'open', mtab: 'props', pcat: '',
    join: { step: 1, role: null }, next: '', poll: null, mePoll: null,
    picks: {}, att: { apply: [], msg: [] }, cv: undefined
  };
  function blankQ() { return { q: '', cat: '', city: '', budget: '', level: '', verified: '', remote: '', today: '', sort: 'new' }; }
  function U() { return S.me.user; }
  function role() { return U() ? U().role : null; }
  function needsSetup() {
    var u = U(); if (!u) return false;
    if (!u.city) return true;
    if (u.role === 'fre') return !(u.title && u.cat && u.skills && u.skills.length && u.about && u.about.length >= 30);
    return false;
  }
  function home() { return !U() ? 'explore' : role() === 'cli' ? 'dash' : 'home'; }
  function locText(j) { return j.remote ? 'Remote' : (j.city || 'Nigeria'); }
  function feePct() { return (S.me.fee || {}); }

  /* ---------- routing ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), qi = h.indexOf('?');
    return { path: (qi >= 0 ? h.slice(0, qi) : h).split('/').filter(Boolean), qs: new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '') };
  }
  function go(route) { var target = '#/' + route; if (location.hash === target) router(); else location.hash = target; }
  function back() { if (S.navs > 1) history.back(); else go(home()); }
  window.addEventListener('hashchange', function () { S.navs++; router(); });

  function router(keep) {
    stopPoll(); closeDrawer(); if (!keep) closeModal();
    var h = parseHash(), name = h.path[0] || '', arg = h.path[1] || '';
    if (!name || !V[name]) name = home();
    var v = V[name];
    if (v.need && !U()) { S.next = location.hash; return go('login'); }
    if (v.need === 'fre' && role() !== 'fre') return go(home());
    if (v.need === 'cli' && role() !== 'cli') return go(home());
    if (v.guest && U()) return go(home());
    if (needsSetup() && ['setup', 'terms', 'privacy', 'verify', 'reset', 'how', 'pricing', 'about', 'help'].indexOf(name) < 0) { if (S.view === 'setup' && $('#f-profile')) { toast('Finish your profile first.'); history.replaceState(null, '', '#/setup'); return; } return go('setup'); }
    if (name === 'setup' && U() && !needsSetup()) return go('edit-profile');
    var y = window.scrollY, changed = S.view !== name || S.arg !== arg;
    S.view = name; S.arg = arg; S.qs = h.qs;
    var seq = ++S.seq;
    document.body.setAttribute('data-current', name);
    chrome();
    var slow = setTimeout(function () { if (seq === S.seq) $('#app').innerHTML = '<div class="wrap scr"><p class="loading">Loading…</p></div>'; }, 180);
    Promise.resolve(v.load ? v.load(arg, h.qs) : null).then(function (data) {
      clearTimeout(slow);
      if (seq !== S.seq) return;
      S.data = data;
      try {
        $('#app').innerHTML = v.html(data, arg);
        if (v.after) v.after(data, arg);
      } catch (err) {
        console.error(err);
        $('#app').innerHTML = '<div class="wrap scr col">' + emptyBox('Something went wrong', 'This page couldn\u2019t be shown. Please reload and try again.', '<button type="button" class="btn btn-ghost" data-act="reload">Reload</button>') + '</div>';
      }
      document.title = (v.title ? v.title(data) + ' · ' : '') + 'PadiHire';
      window.scrollTo(0, keep && !changed ? y : 0);
    }, function (e) {
      clearTimeout(slow);
      if (seq !== S.seq) return;
      if (e.status === 401) { S.me = { user: null }; S.next = location.hash; return go('login'); }
      $('#app').innerHTML = '<div class="wrap scr col">' + emptyBox(e.status === 404 ? 'Not found' : 'Couldn’t load this page', esc(e.message), '<button type="button" class="btn btn-ghost" data-act="reload">Try again</button>') + '</div>';
    });
  }
  function refresh() { return loadMe().then(function () { router(true); }); }
  function loadMe() { return api('GET', 'me').then(function (m) { S.me = m; chrome(); }, function () { /* keep last */ }); }
  function rerender() { var v = V[S.view]; $('#app').innerHTML = v.html(S.data, S.arg); if (v.after) v.after(S.data, S.arg); }

  /* ---------- small pieces ---------- */
  function emptyBox(title, body, btn) { return '<div class="empty"><h2>' + title + '</h2><p>' + body + '</p>' + (btn || '') + '</div>'; }
  function secHead(title, link) { return '<div class="sec-head"><h2>' + title + '</h2>' + (link || '') + '</div>'; }
  function utabs(name, items, cur) {
    return '<div class="utabs" role="tablist">' + items.map(function (it) { return '<button type="button" role="tab" aria-selected="' + (it[0] === cur) + '" data-act="tab" data-tab="' + name + '" data-v="' + it[0] + '">' + it[1] + '</button>'; }).join('') + '</div>';
  }
  function sbar(id, placeholder, value) {
    return '<form id="' + id + '" class="sbar" novalidate role="search">' + ic('search') + '<label class="sr-only" for="' + id + '-in">' + placeholder + '</label><input id="' + id + '-in" type="search" placeholder="' + placeholder + '" value="' + esc(value || '') + '" autocomplete="off"><button type="submit" class="btn btn-primary">Search</button></form>';
  }
  function backBtn(label) { return '<button type="button" class="back" data-act="back">' + ic('back') + (label || 'Back') + '</button>'; }
  function jsave(j) {
    if (role() === 'cli' || j.mine) return '';
    var on = !!j.saved;
    return '<button type="button" class="jsave' + (on ? ' on' : '') + '" data-act="save" data-id="' + j.id + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove from saved: ' : 'Save job: ') + esc(j.title) + '">' + ic('heart') + '</button>';
  }
  function jrow(j) {
    return '<article class="jrow">' +
      '<p class="jr-time">Posted ' + ago(j.created_at) + (j.applied ? '<span class="ok-t">' + ic('tick') + 'Applied</span>' : '') + (j.mine ? '<span class="mine-t">Your job</span>' : '') + '</p>' +
      '<h3 class="jr-title"><a class="jr-link" href="#/job/' + j.id + '">' + esc(j.title) + '</a></h3>' + jsave(j) +
      '<p class="jr-terms">Fixed price · ' + esc(j.level) + ' · ' + daysText(j.days) + ' · Budget: <b>' + naira(j.budget) + '</b></p>' +
      '<p class="jr-desc">' + esc(j.descr) + '</p>' +
      (j.skills.length ? '<ul class="chips">' + j.skills.map(li).join('') + '</ul>' : '') +
      '<p class="jr-client">' + (j.client.verified ? '<span class="fund">' + ic('shield') + 'Payment verified</span>' : '<span class="nofund">Payment not verified</span>') +
      '<span>' + ic('pin') + esc(locText(j)) + '</span></p>' +
      '<p class="jr-props">Proposals: ' + band(j.props) + '</p></article>';
  }
  function rows(list) { return '<div class="rows">' + list.map(jrow).join('') + '</div>'; }
  function stars(r, n) { return n ? '<span class="stars">' + ic('star', 'is') + '<b>' + r.toFixed(1) + '</b> (' + n + ')</span>' : '<span>New</span>'; }
  function frow(p) {
    return '<article class="frow">' + face(p.name, 'av-md', p.photo) +
      '<div class="fr-main"><h3 class="fr-name"><a class="jr-link" href="#/freelancer/' + p.id + '">' + esc(p.name) + '</a></h3>' +
      '<p class="fr-title">' + esc(p.title || CAT[p.cat].label) + '</p>' +
      '<p class="fr-meta">' + (p.city ? '<span>' + ic('pin') + esc(p.city) + '</span>' : '') + stars(p.rating, p.reviews) + (p.jobs_done ? '<span>' + p.jobs_done + (p.jobs_done === 1 ? ' job' : ' jobs') + '</span>' : '') + '</p></div>' +
      (p.rate_from ? '<p class="fr-rate"><b>' + nk(p.rate_from) + '+</b><span>per job</span></p>' : '<p class="fr-rate"></p>') +
      (p.about ? '<p class="fr-about">' + esc(p.about) + '</p>' : '') + (p.skills.length ? '<ul class="chips">' + p.skills.map(li).join('') + '</ul>' : '') + '</article>';
  }
  function catOptions(any) { return '<option value="">' + (any || 'All categories') + '</option>' + CATS.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join(''); }
  function cityOptions(any, remote) { return (any ? '<option value="">' + any + '</option>' : '') + (remote ? '<option value="Remote">' + remote + '</option>' : '') + CITIES.map(function (c) { return '<option>' + c + '</option>'; }).join(''); }
  function promo(title, body, btn, r) { return '<div class="promo"><div><h2>' + title + '</h2><p>' + body + '</p></div><button type="button" class="btn btn-dark" data-act="join" data-v="' + r + '">' + btn + '</button></div>'; }
  function slug(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, ''); }
  function jobUrl(j) { var sl = slug(j.title); return location.origin + '/j/' + j.id + (sl ? '-' + sl : ''); }
  function proUrl(p) { return p.username ? location.origin + '/u/' + p.username : location.origin + '/#/freelancer/' + p.id; }
  function shareBtn(url, title, label) { return '<button type="button" class="btn btn-ghost btn-sm" data-act="share" data-url="' + esc(url) + '" data-title="' + esc(title) + '">' + ic('share') + (label || 'Share') + '</button>'; }
  function copyText(text, done) {
    function fallback() {
      var t = document.createElement('textarea'), ok = false;
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.top = '0'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove(); toast(ok ? done : text);
    }
    try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast(done); }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function fullDate(ts) { var d = new Date(ts * 1000); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + timeText(ts).split(' | ')[0]; }
  function sideBox(title, body, link) { return '<section class="side-box">' + (title ? '<h2 class="sb-h">' + title + '</h2>' : '') + body + (link || '') + '</section>'; }

  /* ---------- skill picker ---------- */
  function skillPicker(key, max, selected, cat) {
    S.picks[key] = { max: max, list: (selected || []).slice(0, max), cat: cat || '' };
    return '<div class="skillpick" data-pick="' + key + '"><ul class="chips sp-chips" id="sp-' + key + '-chips">' + spChips(key) + '</ul>' +
      '<div class="sp-search">' + ic('search') + '<label class="sr-only" for="sp-' + key + '-in">Search skills</label><input id="sp-' + key + '-in" class="sp-input" data-pick="' + key + '" type="text" autocomplete="off" placeholder="Search skills, e.g. Canva"></div>' +
      '<div class="sp-sugs" id="sp-' + key + '-sugs">' + spSugs(key, '') + '</div><p class="hint" id="sp-' + key + '-count">' + spCount(key) + '</p></div>';
  }
  function spChips(key) { return S.picks[key].list.map(function (sk) { return '<li class="sp-chip">' + esc(sk) + '<button type="button" data-act="sp-del" data-pick="' + key + '" data-v="' + esc(sk) + '" aria-label="Remove ' + esc(sk) + '">' + ic('close') + '</button></li>'; }).join(''); }
  function spCount(key) { var p = S.picks[key]; return p.list.length + ' of ' + p.max + ' chosen' + (p.list.length >= p.max ? '. Remove one to pick another.' : ''); }
  function spSugs(key, q) {
    var p = S.picks[key]; if (p.list.length >= p.max) return '';
    var list = skillSearch(q, p.cat, p.list), t = String(q || '').trim(), exact = list.some(function (x) { return x.toLowerCase() === t.toLowerCase(); });
    var out = list.map(function (sk) { return '<button type="button" data-act="sp-add" data-pick="' + key + '" data-v="' + esc(sk) + '">' + esc(sk) + '</button>'; }).join('');
    if (t.length >= 2 && !exact) out += '<button type="button" class="sp-custom" data-act="sp-add" data-pick="' + key + '" data-v="' + esc(t.slice(0, 30)) + '">' + ic('plus') + 'Add \u201C' + esc(t.slice(0, 30)) + '\u201D</button>';
    return out;
  }
  function spRefresh(key) {
    $('#sp-' + key + '-chips').innerHTML = spChips(key);
    var inp = $('#sp-' + key + '-in');
    $('#sp-' + key + '-sugs').innerHTML = spSugs(key, inp ? inp.value : '');
    $('#sp-' + key + '-count').textContent = spCount(key);
  }

  /* ---------- attachments ---------- */
  var UP_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.zip,.psd,.ai,.mp4,.mov,.mp3';
  function attList(key) {
    return S.att[key].map(function (f, i) {
      return '<li class="att-chip' + (f.busy ? ' busy' : '') + '">' + ic(f.image ? 'eye' : 'file') + '<span>' + esc(f.name) + '</span><small>' + (f.busy ? 'Uploading\u2026' : fileSize(f.size)) + '</small>' +
        (f.busy ? '' : '<button type="button" data-act="att-del" data-k="' + key + '" data-i="' + i + '" aria-label="Remove ' + esc(f.name) + '">' + ic('close') + '</button>') + '</li>';
    }).join('');
  }
  function attRefresh(key) { var el = $('#att-' + key); if (el) el.innerHTML = attList(key); }
  function attBox(key, max, label) {
    if (!S.me.uploads) return '';
    return '<div class="att-box"><label class="btn btn-ghost btn-sm att-add" for="up-' + key + '">' + ic('clip') + label + '</label><input type="file" id="up-' + key + '" class="sr-only" data-up="' + key + '" data-max="' + max + '" accept="' + UP_ACCEPT + '" multiple><ul class="att-list" id="att-' + key + '">' + attList(key) + '</ul></div>';
  }
  function handleFiles(el) {
    var key = el.getAttribute('data-up'), files = Array.prototype.slice.call(el.files || []);
    el.value = '';
    if (key === 'cv') return handleCv(files[0]);
    var max = +el.getAttribute('data-max'), kind = key === 'msg' ? 'message' : 'proposal';
    var room = max - S.att[key].length;
    if (files.length > room) toast('You can attach up to ' + max + ' files.');
    files.slice(0, Math.max(0, room)).forEach(function (file) {
      if (file.size > 20 * 1048576) { toast(file.name + ' is over 20 MB.'); return; }
      var item = { name: file.name, size: file.size, busy: true };
      S.att[key].push(item); attRefresh(key);
      upload(file, kind).then(function (r) { Object.assign(item, r, { busy: false }); attRefresh(key); }, function (er) { S.att[key] = S.att[key].filter(function (x) { return x !== item; }); attRefresh(key); toast(er.message); });
    });
  }
  function cvBlock() {
    var cv = S.cv === undefined ? U().cv : S.cv;
    if (!S.me.uploads) return '<p class="small">CV upload will be available soon.</p>';
    return '<div class="cv-box" id="cv-box">' + (cv ? (cv.busy ? '<p class="att-chip busy">' + ic('file') + '<span>' + esc(cv.name) + '</span><small>Uploading\u2026</small></p>'
      : '<p class="att-chip">' + ic('file') + '<span>' + esc(cv.name) + '</span>' + (cv.id ? '<a class="link-btn small-link" href="/api/files/' + cv.id + '" target="_blank" rel="noopener">View</a>' : '') + '<button type="button" data-act="cv-del" aria-label="Remove CV">' + ic('close') + '</button></p>') : '') +
      '<label class="btn btn-ghost btn-sm att-add" for="up-cv">' + ic('clip') + (cv ? 'Replace CV' : 'Upload CV') + '</label><input type="file" id="up-cv" class="sr-only" data-up="cv" accept=".pdf,.doc,.docx">' +
      '<p class="hint">PDF or Word, up to 5 MB. Remove your phone number, email and social handles from your CV first. Clients contact you through PadiHire.</p></div>';
  }
  function cvFillBox(setup) {
    var st = S.cvfill || {};
    var body = st.busy ? '<p class="cvf-t"><strong>Reading your CV…</strong><span class="small">This takes about 10 seconds.</span></p>'
      : st.done ? '<p class="cvf-t"><strong>' + ic('tick') + 'Filled in from your CV</strong><span class="small">Check the category, headline, skills and bio below, change anything you like, then save.</span></p><label class="btn btn-ghost btn-sm" for="up-cvfill">Use another CV</label>'
      : '<p class="cvf-t"><strong>' + (setup ? 'Fill this in from your CV' : 'Update this from your CV') + '</strong><span class="small">Upload your CV (PDF or Word .docx) and we’ll fill in your category, headline, skills and bio. You can change anything before saving.</span>' + (st.err ? '<span class="cvf-err">' + esc(st.err) + '</span>' : '') + '</p><label class="btn btn-primary btn-sm" for="up-cvfill">' + ic('doc') + 'Upload CV</label>';
    return '<section class="cvfill' + (st.busy ? ' busy' : '') + '" id="cvfill" aria-live="polite">' + body + '<input type="file" id="up-cvfill" class="sr-only" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"' + (st.busy ? ' disabled' : '') + '></section>';
  }
  function cvFillRefresh() { var b = $('#cvfill'); if (b) b.outerHTML = cvFillBox(S.view === 'setup'); }
  function readCv(file) {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) { S.cvfill = { err: 'Use a PDF or Word .docx file. Older .doc files can’t be read, so save it as a PDF first.' }; cvFillRefresh(); return; }
    if (file.size > 5 * 1048576) { S.cvfill = { err: 'Your CV must be 5 MB or less.' }; cvFillRefresh(); return; }
    S.cvfill = { busy: true }; cvFillRefresh();
    upload(file, 'cv').then(function (f) {
      S.cv = f; var box = $('#cv-box'); if (box) box.outerHTML = cvBlock();
      return api('POST', 'me/cv/read', { file_id: f.id });
    }).then(function (r) {
      var cat = $('#pf-cat'); if (cat && r.cat) { cat.value = r.cat; if (S.picks.pf) S.picks.pf.cat = r.cat; }
      if (r.title && $('#pf-title')) $('#pf-title').value = r.title;
      if (r.about && $('#pf-about')) $('#pf-about').value = r.about;
      if (r.skills && r.skills.length && S.picks.pf) { S.picks.pf.list = r.skills.slice(0, 3); }
      if (S.picks.pf) spRefresh('pf');
      ['pf-cat', 'pf-title', 'pf-about'].forEach(function (id) { var el = $('#' + id); if (el) { el.classList.add('filled'); setTimeout(function () { el.classList.remove('filled'); }, 2500); } });
      S.cvfill = { done: true }; cvFillRefresh(); toast('Filled in from your CV. Check it, then save.');
    }).catch(function (er) { S.cvfill = { err: er.message || 'We couldn’t read your CV. Please fill in the form yourself.' }; cvFillRefresh(); });
  }
  function handleCv(file) {
    if (!file) return;
    if (file.size > 5 * 1048576) { toast('Your CV must be 5 MB or less.'); return; }
    S.cv = { name: file.name, busy: true }; $('#cv-box').outerHTML = cvBlock();
    upload(file, 'cv').then(function (r) { S.cv = r; $('#cv-box').outerHTML = cvBlock(); toast('CV uploaded. Save your profile to keep it.'); }, function (er) { S.cv = undefined; $('#cv-box').outerHTML = cvBlock(); toast(er.message); });
  }

  /* ---------- views ---------- */
  var V = {};

  ICONS.lock = '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>';
  ICONS.bell = '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>';
  ICONS.mail = '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>';
  var CAT_IC = { design: 'pen', writing: 'doc', web: 'code', video: 'video', social: 'megaphone', admin: 'table' };
  function verifyBanner() {
    var u = U(); if (!u || !S.me.mail || u.email_verified) return '';
    return '<div class="vbanner">' + ic('mail') + '<p><strong>Confirm your email.</strong> We sent a link to ' + esc(u.email) + '. It keeps your account safe and makes sure you get job alerts.</p><button type="button" class="btn btn-ghost btn-sm" data-act="verify-resend">Send again</button></div>';
  }
  function supportLine(text) { var wa = S.me.support_whatsapp; return wa ? '<p class="center-line small">' + (text || 'Can’t get in?') + ' <a class="link-btn" href="https://wa.me/' + esc(waNum(wa)) + '?text=' + encodeURIComponent('Hello PadiHire, I need help logging in. My email is: ') + '" target="_blank" rel="noopener">Message us on WhatsApp</a></p>' : ''; }
  function portGrid(items, own) {
    var s = (items || []).map(function (it) {
      return '<figure class="port-it"><a class="port-img" href="/api/files/' + it.file_id + '" target="_blank" rel="noopener"><img src="/api/files/' + it.file_id + '" alt="' + esc(it.title) + '" loading="lazy"></a><figcaption><span>' + esc(it.title) + '</span>' +
        (it.link ? '<a class="link-btn" href="' + esc(it.link) + '" target="_blank" rel="noopener nofollow">View project</a>' : '') + '</figcaption>' +
        (own ? '<button type="button" class="port-del" data-act="port-del" data-id="' + it.id + '" aria-label="Remove ' + esc(it.title) + '">' + ic('close') + '</button>' : '') + '</figure>';
    }).join('');
    if (own && (items || []).length < 8) s += '<button type="button" class="port-add" data-act="port-add">' + ic('plus') + '<span>Add work</span></button>';
    return s;
  }
  function mountTurnstile() {
    var box = $('#jn-human'); if (!box || !S.me.turnstile) return;
    S.tsToken = '';
    function draw() {
      var b = $('#jn-human'); if (!b || !window.turnstile) return;
      try { S.tsWidget = window.turnstile.render(b, { sitekey: S.me.turnstile, theme: 'auto', callback: function (t) { S.tsToken = t; fieldErr('jn-human', ''); }, 'expired-callback': function () { S.tsToken = ''; }, 'error-callback': function () { S.tsToken = ''; } }); } catch (e) { console.error(e); }
    }
    if (window.turnstile) return draw();
    if (!S.tsLoading) { S.tsLoading = true; var sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true; sc.onload = function () { S.tsLoading = false; draw(); }; document.head.appendChild(sc); }
  }
  function greet() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function hello(sub, title, extra) { return '<div class="hello">' + face(U().name, 'av-md', U().photo) + '<div class="hello-t"><p class="small">' + sub + '</p><h1 class="pg-title">' + title + '</h1></div>' + (extra || '') + '</div>'; }
  function stat(href, n, label) { return '<a class="stat" href="' + href + '"><b>' + n + '</b><span>' + label + '</span></a>'; }
  function stChip(text, cls) { return '<span class="st ' + cls + '">' + text + '</span>'; }
  function jcard(j) {
    var c = CAT[j.cat];
    return '<article class="jcard"><p class="jc-meta"><span class="cat-chip">' + esc(c ? c.short : 'Other') + '</span><span>' + ago(j.created_at) + '</span></p>' +
      '<h3 class="jc-title"><a class="jr-link" href="#/job/' + j.id + '">' + esc(j.title) + '</a></h3>' +
      '<p class="jc-sub"><b>' + naira(j.budget) + '</b> · ' + daysText(j.days) + ' · ' + esc(locText(j)) + '</p>' +
      '<p class="jc-foot">' + (j.client.verified ? '<span class="vt">' + ic('shield') + 'Payment verified</span>' : '') + '<span>Proposals: ' + band(j.props) + '</span>' + (j.applied ? '<span class="ok-t">' + ic('tick') + 'Applied</span>' : '') + (j.mine ? '<span class="mine-t">Your job</span>' : '') + '</p>' + jsave(j) + '</article>';
  }
  function cjcard(j) {
    var href, st, sub, prog = '';
    if (j.status === 'open') { href = '#/myjob/' + j.id; st = j.props ? stChip(j.props + (j.props === 1 ? ' proposal' : ' proposals'), 'st-new') : stChip('Open', 'st-open'); sub = 'Posted ' + ago(j.created_at) + ' · Budget ' + naira(j.budget) + (j.props ? '' : ' · Invite freelancers'); }
    else if (!j.contract_id) { href = '#/myjob/' + j.id; st = stChip('Closed', 'st-done'); sub = 'Closed without hiring'; }
    else {
      href = '#/chat/' + j.thread_id;
      var n = j.stage === 'active' ? 1 : (j.stage === 'delivered' || j.stage === 'disputed') ? 2 : 3;
      st = j.stage === 'active' ? stChip('In progress', 'st-ok') : j.stage === 'delivered' ? stChip('Delivered', 'st-act') : j.stage === 'disputed' ? stChip('In dispute', 'st-warn') : j.stage === 'paid' ? stChip('Paid', 'st-done') : stChip('Refunded', 'st-done');
      sub = j.stage === 'active' ? esc(j.fre_name) + ' is working on it · ' + naira(j.amount) + ' in escrow'
        : j.stage === 'delivered' ? esc(j.fre_name) + ' delivered. Check the work and approve'
        : j.stage === 'disputed' ? 'PadiHire is reviewing this job'
        : j.stage === 'paid' ? 'Paid ' + naira(j.amount) + ' to ' + esc(j.fre_name) + (j.rated ? '' : ' · Leave a review') : 'Refunded to your wallet';
      if (n < 3) prog = '<span class="prog" aria-hidden="true"><span class="on"></span><span' + (n >= 2 ? ' class="on"' : '') + '></span><span></span></span>';
    }
    return '<a class="jcard" href="' + href + '"><span class="jc-top"><strong class="jc-title">' + esc(j.title) + '</strong>' + st + '</span>' + prog + '<span class="jc-sub">' + sub + '</span></a>';
  }
  function missing(u) {
    var m = [];
    if (!u.cv) m.push('CV'); if (!(u.rate_from > 0)) m.push('starting price'); if (!(u.about && u.about.length >= 40)) m.push('a longer bio'); if (!(u.bank && u.bank.acct)) m.push('bank account');
    return m.length > 1 ? m.slice(0, -1).join(', ') + ' and ' + m[m.length - 1] : m.join('');
  }
  V.explore = {
    load: function () { return api('GET', 'jobs?limit=6'); },
    html: function (d) {
      return '<section class="hero"><div class="wrap home"><h1>Get work done by trusted Nigerian freelancers</h1>' +
        '<form class="hero-search" id="x-search" role="search" novalidate><label>' + ic('search') + '<input id="x-search-in" type="search" placeholder="Logo, flyer, website…" aria-label="Search jobs" enterkeyhint="search"></label><button type="submit" class="btn">Search</button></form>' +
        '<div class="hero-btns"><button type="button" class="btn hb-1" data-act="join" data-v="cli">Hire a padi</button><button type="button" class="btn hb-2" data-act="join" data-v="fre">Find work</button></div></div></section>' +
        '<div class="wrap scr home">' + secHead('Categories', '<a class="see" href="#/jobs">See all jobs</a>') +
        '<div class="cat-grid">' + CATS.map(function (c) { return '<a class="cat-tile" href="#/jobs?cat=' + c.id + '"><span class="ct-ic">' + ic(CAT_IC[c.id] || 'briefcase') + '</span>' + esc(c.short) + '</a>'; }).join('') + '</div>' +
        '<div class="trust"><span class="tr-ic">' + ic('shield') + '</span><span class="tr-t"><strong>Your money is safe</strong><span class="small">You pay into escrow. The freelancer is paid only when you approve the work.</span></span><button type="button" class="link-btn" data-act="help">How it works</button></div>' +
        secHead('New jobs', d.jobs.length ? '<a class="see" href="#/jobs">See all</a>' : '') +
        (d.jobs.length ? '<div class="cards">' + d.jobs.map(jcard).join('') + '</div>' : emptyBox('No jobs yet', 'Be the first to post a job. Posting is free, and you only pay when you hire.', '<button type="button" class="btn btn-primary" data-act="join" data-v="cli">Post a job</button>')) +
        promo('Looking for work?', 'Create a free profile and send proposals to clients across Nigeria.', 'Create a profile', 'fre') + '</div>';
    }
  };
  function visitorSide() {
    return '<aside class="side" aria-label="About PadiHire">' +
      sideBox('How payment works', '<ol class="steps"><li>The client posts a job for free.</li><li>When they hire, they deposit the agreed price into escrow, before work starts.</li><li>The freelancer delivers. The client approves and the freelancer is paid.</li></ol>', '<button type="button" class="link-btn" data-act="help">Read more</button>') +
      sideBox('Hiring?', '<p class="small">Post a job for free and get proposals from freelancers across Nigeria.</p>', '<button type="button" class="btn btn-primary btn-sm" data-act="join" data-v="cli">Post a job</button>') +
      sideBox('Looking for work?', '<p class="small">Create a profile and send proposals to clients across Nigeria.</p>', '<button type="button" class="btn btn-ghost btn-sm" data-act="join" data-v="fre">Create a profile</button>') +
      '</aside>';
  }

  function jobsQuery() { var q = S.q, p = []; Object.keys(q).forEach(function (k) { if (q[k] && !(k === 'sort' && q[k] === 'new')) p.push(k + '=' + encodeURIComponent(q[k])); }); return p.join('&'); }
  V.jobs = {
    title: function () { return 'Jobs'; },
    load: function (a, qs) {
      S.q = blankQ(); qs.forEach(function (v, k) { if (k in S.q) S.q[k] = v; });
      return api('GET', 'jobs?' + jobsQuery());
    },
    html: function (d) {
      var tog = [['verified', 'Payment verified'], ['remote', 'Remote'], ['today', 'Posted today']].map(function (t) { return '<button type="button" data-act="tog" data-k="' + t[0] + '" aria-pressed="' + (S.q[t[0]] === '1') + '">' + t[1] + '</button>'; }).join('');
      function sel(id, key, opts, label) { return '<div><label class="sr-only" for="' + id + '">' + label + '</label><select id="' + id + '" data-q="' + key + '">' + opts + '</select></div>'; }
      return '<div class="wrap scr col"><h1 class="pg-title">Jobs</h1>' +
        sbar('s-form', 'Search titles, skills or clients', S.q.q) +
        '<div class="fsel">' + sel('s-cat', 'cat', catOptions(), 'Category') + sel('s-city', 'city', cityOptions('All locations', 'Remote only'), 'Location') +
        sel('s-budget', 'budget', '<option value="">Any budget</option>' + BUDGETS.map(function (b) { return '<option value="' + b.id + '">' + b.label + '</option>'; }).join(''), 'Budget') +
        sel('s-level', 'level', '<option value="">Any level</option>' + LEVELS.map(function (l) { return '<option>' + l + '</option>'; }).join(''), 'Experience level') + '</div>' +
        '<div class="chip-row" role="group" aria-label="More filters">' + tog + '</div>' +
        '<div class="toolbar"><p class="res-count" id="res-count" aria-live="polite"></p><div class="sort"><label for="s-sort">Sort</label><select id="s-sort" data-q="sort"><option value="new">Newest</option><option value="high">Highest budget</option><option value="low">Lowest budget</option><option value="few">Fewest proposals</option></select></div></div>' +
        '<div id="results">' + resultsHtml(d.jobs) + '</div></div>';
    },
    after: function (d) { ['cat', 'city', 'budget', 'level', 'sort'].forEach(function (k) { var el = $('[data-q="' + k + '"]'); if (el) el.value = S.q[k]; }); countLine(d.jobs.length); }
  };
  function resultsHtml(list) { return list.length ? rows(list) : emptyBox('No jobs match', 'Try another category, a wider budget or fewer filters.', '<button type="button" class="btn btn-ghost" data-act="clear">Clear filters</button>'); }
  function countLine(n) {
    var active = ['q', 'cat', 'city', 'budget', 'level', 'verified', 'remote', 'today'].filter(function (k) { return S.q[k]; }).length;
    var el = $('#res-count'); if (el) el.innerHTML = n + (n === 1 ? ' job' : ' jobs') + (active ? '<button type="button" data-act="clear">Clear filters</button>' : '');
  }
  var resT, resSeq = 0;
  function reloadResults() {
    var qs = jobsQuery();
    history.replaceState(null, '', '#/jobs' + (qs ? '?' + qs : ''));
    clearTimeout(resT);
    resT = setTimeout(function () {
      var my = ++resSeq;
      api('GET', 'jobs?' + qs).then(function (d) { if (my !== resSeq || S.view !== 'jobs') return; $('#results').innerHTML = resultsHtml(d.jobs); countLine(d.jobs.length); }, function (e) { toast(e.message); });
    }, 200);
  }

  V.job = {
    title: function (d) { return d.job.title; },
    load: function (id) { return api('GET', 'jobs/' + encodeURIComponent(id)); },
    html: function (d) {
      var j = d.job, cl = j.client, mine = j.mine, cliR = role() === 'cli', open = j.status === 'open';
      var sv = !!j.saved;
      var saveB = cliR || mine || !open ? '' : '<button type="button" class="btn btn-ghost save-inline' + (sv ? ' on' : '') + '" data-act="save" data-id="' + j.id + '" aria-pressed="' + sv + '">' + ic('heart') + (sv ? 'Saved' : 'Save job') + '</button>';
      var mainB = mine ? '<a class="btn btn-primary" href="#/myjob/' + j.id + '">View proposals</a>'
        : !open ? '<button type="button" class="btn btn-primary" disabled>No longer taking proposals</button>'
        : cliR ? '<button type="button" class="btn btn-primary" data-act="switch" data-v="fre">Switch to freelancing to apply</button>'
        : j.applied ? '<button type="button" class="btn btn-primary" disabled>' + ic('tick') + 'Proposal sent</button>'
        : '<button type="button" class="btn btn-primary" data-act="apply">Apply now</button>';
      var fee = j.fre_fee_pct ? Math.round(j.budget * j.fre_fee_pct / 100) : 0;
      return '<div class="wrap d-wrap"><div class="d-top">' + backBtn() + (j.status === 'removed' ? '' : shareBtn(jobUrl(j), j.title)) + '</div><div class="d-layout"><div class="d-content">' +
        '<p class="jr-time">Posted ' + ago(j.created_at) + (j.edited_at ? ' · Edited' : '') + ' · ' + esc(CAT[j.cat] ? CAT[j.cat].label : '') + '</p>' +
        '<h1 class="d-title">' + esc(j.title) + '</h1>' +
        (open ? '<p class="fund-line">' + ic('shield') + 'Paid through escrow. The client deposits the agreed price when they hire, before work starts.</p>' : '<p class="nofund-line">' + ic('clock') + 'This job is no longer taking proposals.</p>') +
        '<section class="d-block"><p class="d-desc">' + esc(j.descr) + '</p></section>' +
        '<section class="d-block"><ul class="facts">' +
        '<li>' + ic('briefcase') + '<b>' + naira(j.budget) + '</b><span>Fixed price</span></li>' +
        '<li>' + ic('level') + '<b>' + esc(j.level) + '</b><span>Experience level</span></li>' +
        '<li>' + ic('clock') + '<b>' + daysText(j.days) + '</b><span>Delivery time</span></li>' +
        '<li>' + ic('pin') + '<b>' + esc(j.remote ? 'Remote' : j.city) + '</b><span>' + (j.remote ? 'Work from anywhere' : 'On-site work') + '</span></li></ul></section>' +
        (j.skills.length ? '<section class="d-block"><h2 class="sub">Skills and expertise</h2><ul class="chips">' + j.skills.map(li).join('') + '</ul></section>' : '') +
        (j.fre_fee_pct ? '<section class="d-block"><h2 class="sub">What you’ll earn at this budget</h2><dl class="kv">' + kv('Client’s budget', naira(j.budget)) + kv('PadiHire fee (' + j.fre_fee_pct + '%)', '−' + naira(fee)) + kv('You receive', naira(j.budget - fee), true) + '</dl>' +
          '<p class="small">Paid when the client approves the work. If the client doesn’t respond within 5 days of delivery, payment is released automatically.</p></section>' : '') +
        (mine && j.client_fee_pct != null ? '<section class="d-block"><h2 class="sub">What you’ll pay at this budget</h2><dl class="kv">' + kv('Freelancer’s price', naira(j.budget)) + kv('PadiHire service fee (' + j.client_fee_pct + '%)', naira(Math.round(j.budget * j.client_fee_pct / 100))) + kv('Total to deposit when you hire', naira(j.budget + Math.round(j.budget * j.client_fee_pct / 100)), true) + '</dl>' +
          '<p class="small">The freelancer’s price is held in escrow until you approve the work.</p></section>' : '') +
        '<section class="d-block"><h2 class="sub">Activity on this job</h2><dl class="kv">' + kv('Proposals', band(j.props)) + kv('Interviewing', j.interviewing) + kv('Posted', ago(j.created_at)) + '</dl></section>' +
        '<section class="d-block"><h2 class="sub">About the client</h2><div class="cb-head">' + face(cl.name, 'av-md', cl.photo) + '<div><p class="cb-name">' + esc(cl.name) + '</p>' + (cl.person !== cl.name ? '<p class="small">' + esc(cl.person) + '</p>' : '') + '</div></div>' +
        '<ul class="cb-list">' + (cl.verified ? '<li class="ok-t">' + ic('shield') + 'Payment verified · has deposited money on PadiHire</li>' : '<li>' + ic('shield') + 'Payment not verified yet</li>') +
        (cl.city ? '<li>' + ic('pin') + esc(cl.city) + '</li>' : '') + '<li>' + ic('briefcase') + cl.posted + (cl.posted === 1 ? ' job' : ' jobs') + ' posted · ' + cl.hires + (cl.hires === 1 ? ' hire' : ' hires') + '</li><li>' + ic('user') + 'Member since ' + new Date(cl.since * 1000).getFullYear() + '</li></ul></section>' +
        (mine ? '' : '<p class="d-report"><button type="button" data-act="report">' + ic('flag') + 'Report this job</button></p>') +
        (d.job.similar && d.job.similar.length ? secHead('Similar jobs') + rows(d.job.similar) : '') +
        '</div><aside class="d-side"><div class="side-card"><p class="small">Fixed price</p><p class="side-price">' + naira(j.budget) + '</p>' + mainB + saveB +
        '<p class="small">' + (mine ? 'Freelancers send proposals with their own price and timeline.' : 'Your proposal shows your price, timeline and rating.') + '</p></div></aside></div></div>' +
        '<div class="d-bar' + (saveB ? '' : ' one') + '">' + saveB + mainB + '</div>';
    }
  };

  V.freelancers = {
    title: function () { return 'Freelancers'; },
    load: function (a, qs) { S.pq = qs.get('q') || ''; S.pcat = qs.get('cat') || ''; return api('GET', 'freelancers?q=' + encodeURIComponent(S.pq) + '&cat=' + S.pcat); },
    html: function (d) {
      return '<div class="wrap scr col"><h1 class="pg-title">' + (role() === 'cli' ? 'Find talent' : 'Freelancers') + '</h1>' + sbar('pro-search', 'Search by skill or name', S.pq) +
        '<div class="chip-row" role="group" aria-label="Skill">' + [['', 'All']].concat(CATS.map(function (c) { return [c.id, c.label]; })).map(function (c) { return '<button type="button" data-act="pcat" data-v="' + c[0] + '" aria-pressed="' + (S.pcat === c[0]) + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>' +
        '<p class="res-count" style="margin-top:16px">' + d.freelancers.length + (d.freelancers.length === 1 ? ' freelancer' : ' freelancers') + '</p>' +
        (d.freelancers.length ? '<div class="rows" style="margin-top:8px">' + d.freelancers.map(frow).join('') + '</div>' : emptyBox('No freelancers match', 'Try another skill, or post a job and let freelancers come to you.')) + '</div>';
    }
  };
  V.freelancer = {
    title: function (d) { return d.freelancer.name; },
    load: function (id) { return api('GET', 'freelancers/' + encodeURIComponent(id)); },
    html: function (d) {
      var p = d.freelancer, me = U() && U().id === p.id;
      var act = me ? '<a class="btn btn-ghost" href="#/edit-profile">Edit profile</a>'
        : role() === 'cli' ? '<button type="button" class="btn btn-primary" data-act="invite" data-id="' + p.id + '">Invite to a job</button>'
        : !U() ? '<button type="button" class="btn btn-primary" data-act="join" data-v="cli">Hire ' + esc(first(p.name)) + '</button>' : '';
      return '<div class="wrap scr col">' + backBtn() + '<div class="p-head">' + face(p.name, 'av-lg', p.photo) + '<div style="min-width:0"><h1 class="pg-title">' + esc(p.name) + '</h1><p class="fr-title">' + esc(p.title || CAT[p.cat].label) + '</p>' +
        '<p class="fr-meta">' + (p.city ? '<span>' + ic('pin') + esc(p.city) + '</span>' : '') + stars(p.rating, p.reviews) + '<span>' + p.jobs_done + (p.jobs_done === 1 ? ' job done' : ' jobs done') + '</span></p></div></div>' +
        '<div class="pf-act">' + act + shareBtn(proUrl(p), p.name + ' on PadiHire', me ? 'Share my profile' : 'Share') + '</div>' +
        '<section class="d-block"><h2 class="sub">About</h2><p class="d-desc">' + esc(p.about || 'No bio yet.') + '</p>' + (p.skills.length ? '<ul class="chips" style="margin-top:12px">' + p.skills.map(li).join('') + '</ul>' : '') + '</section>' +
        ((d.portfolio || []).length ? '<section class="d-block"><h2 class="sub">Portfolio</h2><div class="port-grid">' + portGrid(d.portfolio, false) + '</div></section>' : '') +
        '<section class="d-block"><dl class="kv">' + kv('Category', esc(CAT[p.cat].label)) + (p.rate_from ? kv('Jobs from', naira(p.rate_from)) : '') + kv('Member since', new Date(p.since * 1000).getFullYear()) +
        (p.cv ? kv('CV', p.cv.locked ? '<a class="link-btn" href="#/login">Log in to view</a>' : '<a class="link-btn" href="/api/files/' + p.cv.id + '" target="_blank" rel="noopener">' + esc(p.cv.name) + '</a>') : '') + '</dl></section>' +
        '<section class="d-block"><h2 class="sub">Reviews</h2>' + (d.reviews.length ? '<ul class="reviews">' + d.reviews.map(function (r) {
          return '<li><p class="rv-top"><span class="stars">' + ic('star', 'is') + '<b>' + r.stars + '.0</b></span><span class="small">' + esc(r.title) + ' · ' + dateText(r.created_at) + '</span></p>' + (r.note ? '<p>' + esc(r.note) + '</p>' : '') + '<p class="small">' + esc(r.client) + '</p></li>';
        }).join('') + '</ul>' : '<p class="small">No reviews yet.</p>') + '</section></div>';
    }
  };

  V.login = {
    guest: true, title: function () { return 'Log in'; },
    html: function () {
      var wa = S.me.support_whatsapp; S.forgotSent = '';
      return '<div class="wrap scr narrow"><h1 class="pg-title">Log in to PadiHire</h1><form id="f-login" class="form" novalidate>' +
        field('lg-login', 'Email or phone number', '<input id="lg-login" type="text" autocomplete="username" inputmode="email">') +
        field('lg-pass', 'Password', '<input id="lg-pass" type="password" autocomplete="current-password">') +
        '<button type="submit" class="btn btn-primary full">Log in</button></form>' +
        '<p class="center-line">Don’t have an account? <button type="button" class="link-btn" data-act="join">Sign up</button></p>' +
        (S.me.mail ? '<p class="center-line small"><a class="link-btn" href="#/forgot">Forgot your password?</a></p>'
          : '<p class="center-line small">Forgot your password? ' + (wa ? '<a class="link-btn" href="https://wa.me/' + esc(waNum(wa)) + '?text=' + encodeURIComponent('Hello PadiHire, I forgot my password. My email is: ') + '" target="_blank" rel="noopener">Message us on WhatsApp</a>' : 'Contact PadiHire support.') + '</p>') + '</div>';
    }
  };
  V.forgot = {
    guest: true, title: function () { return 'Reset your password'; },
    html: function () {
      if (S.forgotSent) return '<div class="wrap scr narrow"><h1 class="pg-title">Check your email</h1><p class="pg-sub">If an account matches <b>' + esc(S.forgotSent) + '</b>, we’ve emailed it a link to choose a new password. The link works for 1 hour. Check your spam folder too.</p><p class="center-line"><a class="link-btn" href="#/login">Back to log in</a></p>' + supportLine('Didn’t get it?') + '</div>';
      return '<div class="wrap scr narrow">' + backBtn() + '<h1 class="pg-title">Forgot your password?</h1><p class="pg-sub">Enter the email or phone number on your account. We’ll email you a link to choose a new password.</p><form id="f-forgot" class="form" novalidate>' +
        field('fg-login', 'Email or phone number', '<input id="fg-login" type="text" autocomplete="username" inputmode="email">') +
        '<button type="submit" class="btn btn-primary full">Send reset link</button></form>' + supportLine() + '</div>';
    }
  };
  V.reset = {
    title: function () { return 'Choose a new password'; },
    html: function (d, arg) {
      return '<div class="wrap scr narrow"><h1 class="pg-title">Choose a new password</h1><p class="pg-sub">You’ll be logged in on this device, and logged out everywhere else.</p><form id="f-reset" class="form" novalidate data-token="' + esc(arg) + '">' +
        field('rs-password', 'New password', '<input id="rs-password" type="password" autocomplete="new-password" placeholder="At least 8 characters">') +
        '<button type="submit" class="btn btn-primary full">Save and log in</button></form><p class="center-line small"><a class="link-btn" href="#/forgot">Ask for a new link</a></p></div>';
    }
  };
  V.verify = {
    title: function () { return 'Confirm your email'; },
    load: function (t) {
      return api('POST', 'auth/verify', { token: t }).then(function () { return (U() ? loadMe() : Promise.resolve()).then(function () { return { ok: true }; }); },
        function (e) { return { ok: !!(U() && U().email_verified), msg: e.message }; });
    },
    html: function (d) {
      var u = U();
      return '<div class="wrap scr narrow"><h1 class="pg-title">' + (d.ok ? 'Email confirmed' : 'This link didn’t work') + '</h1><p class="pg-sub">' + (d.ok ? 'Thanks. Your email is confirmed, so you’ll get alerts about your jobs and payments.' : esc(d.msg)) + '</p>' +
        '<p style="margin-top:18px"><a class="btn btn-primary" href="#/' + (u ? home() : 'login') + '">' + (u ? 'Continue' : 'Log in') + '</a></p>' +
        (!d.ok && u ? '<p class="center-line small"><button type="button" class="link-btn" data-act="verify-resend">Send a new link</button></p>' : '') + '</div>';
    }
  };
  function waNum(n) { var s = String(n).replace(/\D/g, ''); return s.charAt(0) === '0' ? '234' + s.slice(1) : s; }
  function jopt(v, icon, title, body) { return '<button type="button" class="jopt" role="radio" aria-checked="' + (S.join.role === v) + '" data-act="pick-role" data-v="' + v + '">' + ic(icon) + '<span class="radio" aria-hidden="true"></span><strong>' + title + '</strong><span class="small">' + body + '</span></button>'; }
  V.join = {
    guest: true, title: function () { return 'Sign up'; }, after: function () { if (S.join.step !== 1) mountTurnstile(); },
    html: function () {
      var j = S.join;
      if (j.step === 1) {
        return '<div class="wrap scr narrow"><h1 class="pg-title">Join as a client or freelancer</h1><div class="jopts" role="radiogroup" aria-label="Account type">' +
          jopt('cli', 'briefcase', 'I’m a client, hiring for a job', 'Post jobs, compare proposals and pay through escrow.') +
          jopt('fre', 'laptop', 'I’m a freelancer, looking for work', 'Send proposals and get paid to your bank.') + '</div>' +
          '<button type="button" class="btn btn-primary full" data-act="join-next"' + (j.role ? '' : ' disabled') + '>' + (j.role === 'cli' ? 'Join as a client' : j.role === 'fre' ? 'Join as a freelancer' : 'Create account') + '</button>' +
          '<p class="center-line">Already have an account? <a class="link-btn" href="#/login">Log in</a></p></div>';
      }
      var fre = j.role === 'fre';
      return '<div class="wrap scr narrow"><button type="button" class="back" data-act="join-back">' + ic('back') + 'Change account type</button><h1 class="pg-title">' + (fre ? 'Sign up to find work' : 'Sign up to hire') + '</h1><p class="pg-sub">' + (fre ? 'Freelancer account. You’ll set up your profile next.' : 'Client account. Posting jobs is free.') + '</p>' +
        '<form id="f-join" class="form" novalidate>' +
        '<div class="field-row">' + field('jn-first_name', 'First name', '<input id="jn-first_name" type="text" autocomplete="given-name" placeholder="e.g. Chioma">') + field('jn-last_name', 'Last name', '<input id="jn-last_name" type="text" autocomplete="family-name" placeholder="e.g. Okeke">') + '</div>' +
        field('jn-email', 'Email', '<input id="jn-email" type="email" autocomplete="email" placeholder="you@example.com">') +
        field('jn-password', 'Password', '<input id="jn-password" type="password" autocomplete="new-password" placeholder="At least 8 characters">') +
        field('jn-state', 'State', '<select id="jn-state">' + cityOptions('Choose your state') + '</select>') +
        '<label class="check"><input type="checkbox" id="jn-terms"><span>I am 18 or older, I agree to the <a class="link-btn" href="#/terms" target="_blank">terms</a> and <a class="link-btn" href="#/privacy" target="_blank">privacy policy</a>, and I’ll keep all payments on PadiHire.</span></label><p class="err" id="jn-terms-err" hidden></p>' +
        (S.me.turnstile ? '<div class="field"><div id="jn-human" class="ts-box"></div><p class="err" id="jn-human-err" hidden></p></div>' : '') +
        '<button type="submit" class="btn btn-primary full">Create my account</button></form></div>';
    }
  };

  /* freelancer */
  function profileScore(u) {
    var parts = [u.title, u.about && u.about.length >= 40, u.skills.length >= 1, u.rate_from > 0, u.cv, u.bank && u.bank.acct];
    return Math.round(parts.filter(Boolean).length / parts.length * 100);
  }
  V.home = {
    need: 'fre', title: function () { return 'Home'; },
    load: function () {
      var u = U();
      return Promise.all([api('GET', 'jobs?limit=6' + (u.cat ? '&cat=' + u.cat : '')), api('GET', 'proposals')]).then(function (r) {
        if (r[0].jobs.length || !u.cat) return { jobs: r[0].jobs, props: r[1], all: !u.cat };
        return api('GET', 'jobs?limit=6').then(function (a) { return { jobs: a.jobs, props: r[1], all: true }; });
      });
    },
    html: function (d) {
      var u = U(), w = S.me.wallet || {}, score = profileScore(u), sent = d.props.proposals.filter(function (x) { return x.status === 'sent'; }).length, act = S.me.active || 0;
      return '<div class="wrap scr home">' + hello(greet(), esc(u.name), '<a class="icon-btn" href="#/freelancer/' + u.id + '" aria-label="View your public profile">' + ic('eye') + '</a>') + verifyBanner() +
        '<section class="wcard" aria-label="Wallet"><p class="wc-l">Available balance</p><p class="wc-n">' + naira(w.avail) + '</p>' +
        '<p class="wc-s">' + ic('lock') + (w.escrow_in ? naira(w.escrow_in) + ' held in escrow for you' : 'Client payments are held safely in escrow') + '</p>' +
        '<div class="wc-btns"><button type="button" class="btn wc-b1" data-act="withdraw">Withdraw</button><a class="btn wc-b2" href="#/wallet">History</a></div></section>' +
        '<div class="stats">' + stat('#/proposals', sent, sent === 1 ? 'Proposal' : 'Proposals') + stat('#/contracts', act, act === 1 ? 'Active job' : 'Active jobs') + stat('#/proposals', d.props.left, 'Bids left') + '</div>' +
        (score < 100 ? '<a class="nudge" href="#/edit-profile"><span class="nudge-t"><strong>Your profile is ' + score + '% complete</strong><span class="small">Add your ' + missing(u) + '. Complete profiles get hired more.</span></span><span class="bar"><span style="width:' + score + '%"></span></span></a>' : '') +
        secHead(d.all ? 'Newest jobs' : 'Jobs for you', '<a class="see" href="#/work">See all</a>') +
        (d.jobs.length ? '<div class="cards">' + d.jobs.map(jcard).join('') + '</div>' : emptyBox('No jobs here yet', 'New jobs are posted every day. Check back soon, or look in other categories.', '<a class="btn btn-ghost" href="#/work">Browse all jobs</a>')) + '</div>';
    }
  };
  V.work = {
    need: 'fre', title: function () { return 'Find work'; },
    load: function () {
      var u = U(), src = S.wtab === 'saved' ? api('GET', 'saved') : api('GET', 'jobs?limit=40' + (S.wtab === 'best' && u.cat ? '&cat=' + u.cat : ''));
      return Promise.all([src, api('GET', 'proposals')]).then(function (r) { return { jobs: r[0].jobs, props: r[1] }; });
    },
    html: function (d) {
      var u = U(), score = profileScore(u), note = S.wtab === 'best' ? (u.cat ? 'Jobs in ' + CAT[u.cat].label.toLowerCase() + ', newest first' : '') : S.wtab === 'recent' ? 'Newest jobs in every category' : '';
      var s = '<div class="wrap scr with-side"><div class="mcol">' + sbar('x-search', 'Search for jobs') +
        utabs('wtab', [['best', 'Best matches'], ['recent', 'Most recent'], ['saved', 'Saved']], S.wtab) + (note ? '<p class="tab-note">' + note + '</p>' : '');
      s += d.jobs.length ? rows(d.jobs) : S.wtab === 'saved' ? emptyBox('No saved jobs', 'Tap the heart on a job to save it for later.') : emptyBox('No jobs here yet', 'New jobs are posted every day. Check back soon, or look in other categories.', '<button type="button" class="btn btn-ghost" data-act="tab" data-tab="wtab" data-v="recent">See all jobs</button>');
      return s + '</div>' + freSide(d.props) + '</div>';
    }
  };
  function freSide(p) {
    var u = U(), w = S.me.wallet || {};
    var act = p.proposals.filter(function (x) { return x.status === 'sent'; }).length;
    return '<aside class="side" aria-label="Your account">' +
      sideBox('', '<div class="sb-me">' + face(u.name, 'av-md', u.photo) + '<div style="min-width:0"><p class="cb-name">' + esc(u.name) + '</p><p class="small">' + esc(u.title || (CAT[u.cat] ? CAT[u.cat].label : 'Freelancer')) + '</p></div></div>', '<a class="link-btn" href="#/freelancer/' + u.id + '">View public profile</a>') +
      sideBox('Wallet', '<dl class="kv">' + kv('Available', naira(w.avail)) + kv('In escrow', naira(w.escrow_in)) + '</dl>', '<a class="link-btn" href="#/wallet">Go to wallet</a>') +
      sideBox('Your work', '<dl class="kv">' + kv('Active proposals', act) + kv('Proposals left this month', p.left + ' of ' + p.monthly) + kv('Active contracts', S.me.active || 0) + '</dl>', '<a class="link-btn" href="#/proposals">See proposals</a>') +
      '</aside>';
  }
  function workSeg(cur) { return '<nav class="seg" aria-label="My work">' + [['proposals', 'Proposals'], ['contracts', 'Contracts']].map(function (x) { return '<a href="#/' + x[0] + '"' + (x[0] === cur ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>'; }
  V.proposals = {
    need: 'fre', title: function () { return 'Proposals'; },
    load: function () { return api('GET', 'proposals'); },
    html: function (d) {
      var act = d.proposals.filter(function (p) { return p.status !== 'lost'; }), arch = d.proposals.filter(function (p) { return p.status === 'lost'; });
      var list = S.ptab === 'active' ? act : arch;
      return '<div class="wrap scr col"><h1 class="pg-title">My work</h1>' + workSeg('proposals') + '<p class="small" style="margin-top:10px">' + d.left + ' of ' + d.monthly + ' proposals left this month</p>' +
        utabs('ptab', [['active', 'Active (' + act.length + ')'], ['archived', 'Archived (' + arch.length + ')']], S.ptab) +
        (list.length ? '<div class="rows">' + list.map(function (p) {
          var st = p.status === 'hired' ? '<span class="st-line ok-t">' + ic('tick') + 'You were hired. <a class="link-btn" href="#/contracts">See contract</a></span>' : p.status === 'lost' ? '<span class="st-line">This job is closed or another freelancer was hired</span>' : '<span class="st-line">Waiting for ' + esc(p.client) + ' to reply</span>';
          return '<article class="jrow"><p class="jr-time">Submitted ' + ago(p.created_at) + '</p><h3 class="jr-title"><a class="jr-link" href="#/job/' + p.job_id + '">' + esc(p.title) + '</a></h3>' +
            '<p class="jr-terms">Your bid: <b>' + naira(p.price) + '</b> · ' + daysText(p.days) + ' · you receive ' + naira(p.price - Math.round(p.price * d.fre_fee_pct / 100)) + '</p>' + st + '</article>';
        }).join('') + '</div>' : emptyBox(S.ptab === 'active' ? 'No active proposals' : 'Nothing archived', S.ptab === 'active' ? 'Find a job that fits your skills and send your first proposal.' : 'Proposals for jobs that closed move here.', S.ptab === 'active' ? '<a class="btn btn-primary" href="#/work">Find work</a>' : '')) + '</div>';
    }
  };
  V.contracts = {
    need: 'fre', title: function () { return 'Contracts'; },
    load: function () { return api('GET', 'contracts'); },
    html: function (d) {
      var act = d.contracts.filter(function (k) { return k.stage === 'active' || k.stage === 'delivered' || k.stage === 'disputed'; }), done = d.contracts.filter(function (k) { return k.stage === 'paid' || k.stage === 'refunded'; });
      var list = S.ktab === 'active' ? act : done;
      return '<div class="wrap scr col"><h1 class="pg-title">My work</h1>' + workSeg('contracts') + utabs('ktab', [['active', 'Active (' + act.length + ')'], ['done', 'Completed (' + done.length + ')']], S.ktab) +
        (list.length ? '<div class="rows">' + list.map(function (k) {
          var line = k.stage === 'active' ? '<span class="fund">' + ic('shield') + naira(k.amount) + ' in escrow</span><span>Due ' + dateText(k.due_at) + '</span>'
            : k.stage === 'delivered' ? '<span>Delivered, waiting for approval</span>' : k.stage === 'disputed' ? '<span class="act-t">In dispute. PadiHire is reviewing</span>'
            : k.stage === 'paid' ? '<span class="ok-t">' + ic('tick') + naira(k.net) + ' paid to you</span>' : '<span>Refunded to the client</span>';
          return '<article class="jrow"><h3 class="jr-title"><a class="jr-link" href="#/chat/' + k.thread_id + '">' + esc(k.title) + '</a></h3><p class="who-line">' + face(k.client, 'av-sm', k.client_photo) + esc(k.client) + '</p><p class="jr-client">' + line + '</p></article>';
        }).join('') + '</div>' : emptyBox(S.ktab === 'active' ? 'No active contracts' : 'No completed contracts', 'When a client hires you, the job and its escrow payment show here.')) + '</div>';
    }
  };

  /* client */
  V.dash = {
    need: 'cli', title: function () { return 'Home'; },
    load: function () { return Promise.all([api('GET', 'myjobs'), api('GET', 'wallet'), api('GET', 'freelancers?limit=3')]).then(function (r) { return { jobs: r[0].jobs, wallet: r[1], pros: r[2].freelancers }; }); },
    html: function (d) {
      var u = U(), g = { open: [], progress: [], done: [] };
      d.jobs.forEach(function (j) {
        if (j.status === 'open') g.open.push(j);
        else if (j.contract_id && (j.stage === 'active' || j.stage === 'delivered' || j.stage === 'disputed')) g.progress.push(j);
        else g.done.push(j);
      });
      var s = '<div class="wrap scr home">' + hello(esc(u.business || 'Welcome back'), 'Hi, ' + esc(first(u.name)), '<a class="icon-btn" href="#/wallet" aria-label="Wallet history">' + ic('wallet') + '</a>') + verifyBanner() +
        '<section class="wcard light" aria-label="Wallet"><div class="wc-row"><div><p class="wc-l">Wallet</p><p class="wc-n">' + naira(d.wallet.avail) + '</p><p class="wc-s">' + (d.wallet.escrow_out ? ic('lock') + naira(d.wallet.escrow_out) + ' held in escrow' : 'Add money when you are ready to hire') + '</p></div><button type="button" class="btn btn-primary" data-act="topup">' + ic('plus') + 'Add money</button></div></section>' +
        '<section class="cta"><h2>Need something done?</h2><p>Post a job for free. Freelancers send you proposals, and you pay only when you hire.</p><a class="btn btn-primary" href="#/post">' + ic('plus') + 'Post a job</a></section>';
      d.jobs.filter(function (j) { return j.stage === 'delivered'; }).forEach(function (j) { s += '<div class="flag"><p><strong>' + esc(j.fre_name) + '</strong> delivered “' + esc(j.title) + '”. Review it to release ' + naira(j.amount) + '.</p><a class="btn btn-dark btn-sm" href="#/chat/' + j.thread_id + '">Review</a></div>'; });
      d.wallet.topups.filter(function (t) { return t.status === 'pending'; }).forEach(function (t) { s += '<div class="flag"><p>We’re checking your transfer of <strong>' + naira(t.amount) + '</strong> (reference ' + esc(t.ref) + '). Your wallet updates once it’s confirmed.</p></div>'; });
      if (!g[S.ctab].length && !(S.picked && S.picked.ctab)) { var alt = ['progress', 'open', 'done'].filter(function (k) { return g[k].length; })[0]; if (alt) S.ctab = alt; }
      s += secHead('Your jobs') + utabs('ctab', [['open', 'Open (' + g.open.length + ')'], ['progress', 'In progress (' + g.progress.length + ')'], ['done', 'Completed (' + g.done.length + ')']], S.ctab);
      var list = g[S.ctab];
      s += list.length ? '<div class="cards one">' + list.map(cjcard).join('') + '</div>'
        : S.ctab === 'open' ? emptyBox(d.jobs.length ? 'No open jobs' : 'No jobs yet', d.jobs.length ? 'Jobs you post show here while freelancers send proposals.' : 'Your jobs show here after you post one. Posting is free.')
        : emptyBox(S.ctab === 'progress' ? 'Nothing in progress' : 'No completed jobs yet', S.ctab === 'progress' ? 'When you hire someone, the job shows here until you approve the work.' : 'Jobs you have paid for or closed show here.');
      if (d.pros.length) s += secHead('Freelancers you may like', '<a class="see" href="#/freelancers">See all</a>') + '<div class="rows">' + d.pros.map(frow).join('') + '</div>';
      return s + '</div>';
    }
  };
  function cjrow(j) {
    if (j.status === 'open') {
      return '<article class="jrow"><p class="jr-time">Posted ' + ago(j.created_at) + '</p><h3 class="jr-title"><a class="jr-link" href="#/myjob/' + j.id + '">' + esc(j.title) + '</a></h3>' +
        '<p class="jr-terms">Fixed price · Budget: <b>' + naira(j.budget) + '</b></p><p class="jr-client"><span><b class="ink">' + j.props + (j.props === 1 ? ' proposal' : ' proposals') + '</b></span><span class="go-t">' + (j.props ? 'Review proposals' : 'Invite freelancers') + ic('next') + '</span></p></article>';
    }
    if (!j.contract_id) return '<article class="jrow"><h3 class="jr-title"><a class="jr-link" href="#/myjob/' + j.id + '">' + esc(j.title) + '</a></h3><p class="jr-client"><span>Closed without hiring</span></p></article>';
    var line = j.stage === 'paid' ? '<span class="ok-t">' + ic('tick') + 'Paid ' + naira(j.amount) + '</span>' + (j.rated ? '' : '<span class="go-t">Leave a review' + ic('next') + '</span>')
      : j.stage === 'refunded' ? '<span>Refunded to your wallet</span>' : j.stage === 'delivered' ? '<span class="act-t">Delivered. Review and approve</span>'
      : j.stage === 'disputed' ? '<span class="act-t">In dispute. PadiHire is reviewing</span>' : '<span class="fund">' + ic('shield') + naira(j.amount) + ' in escrow</span>';
    return '<article class="jrow"><h3 class="jr-title"><a class="jr-link" href="#/chat/' + j.thread_id + '">' + esc(j.title) + '</a></h3><p class="who-line">' + face(j.fre_name, 'av-sm', j.fre_photo) + esc(j.fre_name) + '</p><p class="jr-client">' + line + '</p></article>';
  }
  function cliSide(w) {
    return '<aside class="side" aria-label="Your account">' +
      sideBox('Wallet', '<p class="sb-n">' + naira(w.avail) + '</p><p class="small">' + naira(w.escrow_out) + ' held in escrow</p>', '<button type="button" class="btn btn-ghost btn-sm" data-act="topup">' + ic('plus') + 'Add money</button>') +
      sideBox('How you pay', '<p class="small">Posting a job is free. When you hire someone, you deposit their price plus a ' + (feePct().client_fee_pct || 0) + '% service fee. PadiHire holds their price in escrow until you approve the work.</p>', '<button type="button" class="link-btn" data-act="help">Read more</button>') +
      '</aside>';
  }
  V.myjob = {
    need: 'cli', title: function (d) { return d.job.title; },
    load: function (id) { return api('GET', 'myjobs/' + encodeURIComponent(id)); },
    html: function (d) {
      var j = d.job, open = j.status === 'open', pct = d.client_fee_pct;
      var s = '<div class="wrap scr col"><a class="back" href="#/dash">' + ic('back') + 'My jobs</a><h1 class="pg-title">' + esc(j.title) + '</h1>' +
        '<p class="jr-terms" style="margin-top:6px">Fixed price · Budget: <b>' + naira(j.budget) + '</b> · ' + daysText(j.days) + ' · ' + (open ? 'Open' : j.status === 'hired' ? 'Hired' : 'Closed') + '</p>' +
        (open ? '<p class="pf-act" style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="#/edit-job/' + j.id + '">' + ic('pen') + 'Edit job</a>' + shareBtn(jobUrl(j), j.title) + '</p>' : '') +
        (open ? '<p class="small" style="margin-top:4px">You pay nothing until you hire. Then you deposit the freelancer’s price plus a ' + pct + '% service fee, and the price is held in escrow until you approve the work.</p>' : '') +
        (j.thread_id ? '<p style="margin-top:10px"><a class="btn btn-primary btn-sm" href="#/chat/' + j.thread_id + '">Go to contract</a></p>' : '');
      s += utabs('mtab', [['props', 'Proposals (' + d.proposals.length + ')'], ['post', 'Job post']], S.mtab);
      if (S.mtab === 'post') {
        s += '<section class="d-block" style="margin-top:0;border-top:0"><p class="d-desc">' + esc(j.descr) + '</p>' + (j.skills.length ? '<ul class="chips" style="margin-top:12px">' + j.skills.map(li).join('') + '</ul>' : '') + '</section>' +
          '<p class="pf-act"><a class="btn btn-ghost btn-sm" href="#/job/' + j.id + '">See it as freelancers do</a>' + (open ? '<button type="button" class="btn btn-ghost btn-sm" data-act="close-job" data-id="' + j.id + '">Close job</button>' : '') + '</p>';
      } else {
        s += d.proposals.length ? '<div class="rows">' + d.proposals.map(function (p) {
          var hired = p.status === 'hired';
          return '<article class="prop' + (hired ? ' hired' : '') + '"><div class="prop-head">' + face(p.name, 'av-md', p.photo) +
            '<div style="min-width:0"><p class="fr-name"><a class="name-link" href="#/freelancer/' + p.fre_id + '">' + esc(p.name) + '</a></p><p class="fr-title">' + esc(p.title) + '</p><p class="fr-meta">' + (p.city ? '<span>' + ic('pin') + esc(p.city) + '</span>' : '') + stars(p.rating, p.reviews) + '</p></div>' +
            '<p class="fr-rate"><b>' + naira(p.price) + '</b><span>' + daysText(p.days) + '</span></p></div>' +
            '<p class="prop-note">' + esc(p.note) + '</p>' + filesBlock(p.files) +
            '<p class="small">Submitted ' + ago(p.created_at) + (p.cv ? ' \u00B7 <a class="link-btn" href="/api/files/' + p.cv.id + '" target="_blank" rel="noopener">View CV</a>' : '') + '</p>' +
            (open ? '<div class="prop-btns"><button type="button" class="btn btn-ghost" data-act="msg-pro" data-id="' + p.fre_id + '">Message</button><button type="button" class="btn btn-primary" data-act="hire" data-id="' + p.id + '">Hire</button></div>' : hired ? '<p class="ok-t">' + ic('tick') + 'Hired</p>' : '') + '</article>';
        }).join('') + '</div>' : emptyBox('No proposals yet', 'Freelancers usually reply within a few hours. You can also invite people you like.', open ? '<a class="btn btn-primary" href="#/freelancers">Invite freelancers</a>' : '');
      }
      return s + '</div>';
    }
  };
  function postForm(j) {
    var pct = feePct().client_fee_pct || 0, ed = !!j, lvl;
    j = j || {}; lvl = j.level || 'Intermediate';
    return '<div class="wrap scr narrow">' + (ed ? '<a class="back" href="#/myjob/' + j.id + '">' + ic('back') + 'Back to job</a>' : '') + '<h1 class="pg-title">' + (ed ? 'Edit job' : 'Post a job') + '</h1>' +
      '<p class="pg-sub">' + (ed ? 'Your changes show straight away. Proposals you already have stay as they are.' : 'Posting is free. Freelancers send proposals with their price. When you hire, you deposit that price plus a ' + pct + '% service fee, and PadiHire holds the price in escrow until you approve the work.') + '</p>' +
      '<form id="f-post" class="form" novalidate' + (ed ? ' data-edit="' + j.id + '"' : '') + '>' +
      field('pj-title', 'Job title', '<input id="pj-title" type="text" placeholder="e.g. Design a logo for my bakery" autocomplete="off" maxlength="120" value="' + esc(j.title || '') + '">') +
      '<div class="field-row">' + field('pj-cat', 'Category', '<select id="pj-cat">' + catOptions('Choose a category') + '</select>') + field('pj-level', 'Experience needed', '<select id="pj-level">' + LEVELS.map(function (l) { return '<option' + (l === lvl ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>') + '</div>' +
      '<div class="field-row">' + field('pj-budget', 'Budget (₦)', '<input id="pj-budget" type="text" inputmode="numeric" placeholder="25,000" value="' + (j.budget ? num(j.budget) : '') + '">', 'Fixed price for the whole job') + field('pj-days', 'Delivery (days)', '<input id="pj-days" type="text" inputmode="numeric" placeholder="3" value="' + (j.days || '') + '">') + '</div>' +
      field('pj-city', 'Location', '<select id="pj-city"><option value="Remote">Remote (anywhere in Nigeria)</option>' + cityOptions() + '</select>') +
      '<div class="field"><span class="flabel">Skills needed (up to 5)</span>' + skillPicker('pj', 5, j.skills || [], j.cat || '') + '</div>' +
      field('pj-descr', 'Describe the job', '<textarea id="pj-descr" rows="6" maxlength="4000" placeholder="What do you need, what will you send the freelancer, and what should they deliver?">' + esc(j.descr || '') + '</textarea>') +
      '<button type="submit" class="btn btn-primary full">' + (ed ? 'Save changes' : 'Post job') + '</button></form></div>';
  }
  V.post = { need: 'cli', title: function () { return 'Post a job'; }, html: function () { return postForm(null); } };
  V['edit-job'] = {
    need: 'cli', title: function () { return 'Edit job'; },
    load: function (id) { return api('GET', 'myjobs/' + encodeURIComponent(id)); },
    html: function (d) {
      var j = d.job;
      if (j.status !== 'open') return '<div class="wrap scr col">' + emptyBox('This job can’t be edited', 'You can only edit a job while it’s open. ' + (j.status === 'hired' ? 'You’ve already hired someone for it.' : 'This one is closed.'), '<a class="btn btn-ghost" href="#/myjob/' + j.id + '">Back to job</a>') + '</div>';
      return postForm(j);
    },
    after: function (d) {
      var j = d.job, c = $('#pj-cat'), w = $('#pj-city');
      if (c) c.value = j.cat || '';
      if (w) { w.value = j.remote ? 'Remote' : (j.city || 'Remote'); if (!w.value) w.value = 'Remote'; }
    }
  };

  /* messages */
  V.messages = {
    need: 'any', title: function () { return 'Messages'; },
    load: function () { return api('GET', 'threads'); },
    html: function (d) {
      var cliR = role() === 'cli';
      return '<div class="wrap scr col"><h1 class="pg-title">Messages</h1>' +
        (S.me.unread_other ? '<p class="small" style="margin-top:6px">You have ' + S.me.unread_other + ' unread as a ' + (cliR ? 'freelancer' : 'client') + '. <button type="button" class="link-btn" data-act="switch" data-v="' + (cliR ? 'fre' : 'cli') + '">Switch to see them</button></p>' : '') +
        (d.threads.length ? '<div class="rows" style="margin-top:14px">' + d.threads.map(function (t) {
          return '<a class="mrow' + (t.unread ? ' unread' : '') + '" href="#/chat/' + t.id + '">' + face(t.other, '', t.other_photo) + '<span class="m-main"><span class="m-name">' + esc(t.other) + '</span><span class="m-job">' + esc(t.job) + '</span><span class="m-last">' + (t.mine ? 'You: ' : '') + esc(t.last_text || 'No messages yet') + '</span></span>' +
            '<span class="m-right"><span>' + (t.last_at ? ago(t.last_at).replace(' ago', '') : '') + '</span>' + (t.unread ? '<span class="dot" aria-label="Unread"></span>' : '') + '</span></a>';
        }).join('') + '</div>' : emptyBox('No messages yet', cliR ? 'Message a freelancer from their proposal, or invite someone to your job.' : 'When a client messages you about a proposal, you can chat here.')) + '</div>';
    }
  };
  function timeline(items) { return '<ol class="tl">' + items.map(function (it) { return '<li class="' + (it[1] ? 'done' : '') + '"><span class="tl-dot">' + (it[1] ? ic('tick') : '') + '</span><span>' + it[0] + '</span></li>'; }).join('') + '</ol>'; }
  function contractPanel(t) {
    var k = t.contract, cliR = t.side === 'client', other = cliR ? first(t.fre.name) : esc(t.client.name), st = k.stage, acts = '';
    var dlv = st === 'delivered' || st === 'paid', paid = st === 'paid';
    var items = cliR ? [['You deposited ' + naira(k.amount) + ' into escrow', true], [esc(first(t.fre.name)) + ' delivers the work', dlv], ['You approve and ' + esc(first(t.fre.name)) + ' is paid', paid]]
      : [['Client deposited ' + naira(k.amount) + ' into escrow', true], ['You deliver the work', dlv], ['Client approves and you are paid', paid]];
    var autoAt = k.delivered_at ? k.delivered_at + k.auto_days * 86400 : 0;
    var disputeLink = '<button type="button" class="link-btn small-link" data-act="dispute" data-id="' + k.id + '">Open a dispute</button>';
    if (st === 'refunded') acts = '<p class="small">PadiHire refunded this contract to the client. It’s closed.</p>';
    else if (st === 'disputed') acts = '<p class="small"><strong>In dispute.</strong> The money stays in escrow until PadiHire reviews this chat and decides. Keep all your evidence here.</p>';
    else if (cliR) {
      if (st === 'active') acts = '<p class="small">Waiting for ' + esc(other) + ' to deliver. Due ' + dateText(k.due_at) + '.</p><div class="cp-btns"><button type="button" class="btn btn-ghost btn-sm" data-act="approve" data-id="' + k.id + '">Release payment now</button>' + disputeLink + '</div>';
      else if (st === 'delivered') acts = '<p class="small">' + esc(other) + ' has delivered. Check the work in the chat below, then approve to release the money. If you don’t respond, it’s released automatically on ' + dateText(autoAt) + '.</p><div class="cp-btns"><button type="button" class="btn btn-primary" data-act="approve" data-id="' + k.id + '">Approve and pay</button><button type="button" class="btn btn-ghost" data-act="changes" data-id="' + k.id + '">Request changes</button></div>' + disputeLink;
      else acts = '<p class="small">Paid on ' + dateText(k.closed_at) + '.</p>' + (k.rated ? '' : '<button type="button" class="btn btn-ghost" data-act="rate" data-id="' + k.id + '">' + ic('star', 'is') + 'Leave a review for ' + esc(other) + '</button>');
    } else {
      if (st === 'active') acts = '<p class="small">Due ' + dateText(k.due_at) + '. Share drafts here, then mark the job as delivered with a link to your files.</p><div class="cp-btns"><button type="button" class="btn btn-primary" data-act="deliver" data-id="' + k.id + '">Mark as delivered</button>' + disputeLink + '</div>';
      else if (st === 'delivered') acts = '<p class="small">Waiting for the client to approve. If they don’t respond, payment is released automatically on ' + dateText(autoAt) + '.</p>' + disputeLink;
      else acts = '<p class="small">' + naira(k.amount - k.fre_fee) + ' was added to your wallet (' + naira(k.amount) + ' minus the ' + k.fre_fee_pct + '% PadiHire fee).</p>';
    }
    var label = { active: 'Held', delivered: 'Held', disputed: 'Frozen', paid: 'Released', refunded: 'Refunded' }[st];
    acts += '<a class="link-btn rc-link" href="#/receipt/contract-' + k.id + '">' + ic('receipt') + 'View receipt</a>';
    return '<section class="cpanel"><dl class="cp-rows"><div><dt>Fixed price</dt><dd>' + naira(k.amount) + '</dd></div><div><dt>Escrow</dt><dd class="' + (st === 'active' || st === 'delivered' ? 'fund' : '') + '">' + label + '</dd></div><div><dt>Due</dt><dd>' + dateText(k.due_at) + '</dd></div></dl>' + timeline(items) + '<div class="cp-act">' + acts + '</div></section>';
  }
  function bubble(m) {
    if (m.system) return '<p class="bub sys">' + esc(m.body) + '<small>' + timeText(m.created_at) + '</small></p>';
    return '<p class="bub' + (m.me ? ' me' : '') + '">' + (m.body ? '<span class="bub-text">' + linkify(esc(m.body)) + '</span>' : '') + filesBlock(m.files) + '<small>' + timeText(m.created_at) + '</small></p>';
  }
  function linkify(t) { return t.replace(/\bhttps?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener nofollow">' + u + '</a>'; }); }
  V.chat = {
    need: 'any', title: function (d) { return d.thread.job; },
    load: function (id) { return api('GET', 'threads/' + encodeURIComponent(id)); },
    html: function (d) {
      var t = d.thread, cliR = t.side === 'client', who = cliR ? t.fre : t.client, name = cliR ? t.fre.name : t.client.name;
      return '<div class="wrap scr col"><button type="button" class="back" data-act="back">' + ic('back') + 'Back</button>' +
        '<div class="th-head">' + face(name, '', who.photo) + '<div style="min-width:0"><p class="th-name">' + (cliR ? '<a class="name-link" href="#/freelancer/' + who.id + '">' + esc(name) + '</a>' : esc(name)) + '</p><p class="small"><a class="link-btn" href="#/' + (cliR ? 'myjob/' : 'job/') + t.job_id + '">' + esc(t.job) + '</a></p></div></div>' +
        '<div id="cpanel">' + (t.contract ? contractPanel(t) : '<p class="notice-line">' + ic('shield') + 'Keep chats and payments on PadiHire. Phone numbers, emails, WhatsApp and Telegram details are hidden automatically.</p>') + '</div>' +
        (t.contract ? '<h2 class="sub" style="margin-top:22px">Messages</h2>' : '') +
        '<div class="bubbles" id="bubbles">' + (d.messages.length ? d.messages.map(bubble).join('') : '<p class="small" id="no-msgs">Say hello and ask anything about the job.</p>') + '</div>' +
        (t.side ? '<form id="f-msg" class="composer' + (S.me.uploads ? ' has-att' : '') + '" novalidate>' + (S.me.uploads ? '<label class="att-icon" for="up-msg" aria-label="Attach files">' + ic('clip') + '</label><input type="file" id="up-msg" class="sr-only" data-up="msg" data-max="5" accept="' + UP_ACCEPT + '" multiple>' : '') +
          '<label class="sr-only" for="m-text">Message ' + esc(name) + '</label><textarea id="m-text" rows="1" placeholder="Write a message" maxlength="2000"></textarea><button type="submit" class="btn btn-primary" aria-label="Send message">' + ic('send') + '</button></form><ul class="att-list" id="att-msg">' + attList('msg') + '</ul>' : '') + '</div>';
    },
    after: function (d) {
      S.att.msg = []; attRefresh('msg');
      S.lastMsg = d.messages.length ? d.messages[d.messages.length - 1].id : 0;
      S.contractKey = JSON.stringify(d.thread.contract);
      var b = $('#bubbles'); if (b && d.messages.length > 4) { var last = b.lastElementChild; if (last) last.scrollIntoView({ block: 'nearest' }); }
      startPoll(d.thread.id);
      loadMe();
    }
  };
  function startPoll(id) {
    stopPoll();
    S.poll = setInterval(function () {
      if (document.hidden || S.view !== 'chat') return;
      api('GET', 'threads/' + id + '?after=' + S.lastMsg).then(function (d) {
        if (S.view !== 'chat' || String(d.thread.id) !== String(S.arg)) return;
        if (d.messages.length) {
          var b = $('#bubbles'), none = $('#no-msgs'); if (none) none.remove();
          d.messages.forEach(function (m) { if (!$('[data-mid="' + m.id + '"]')) b.insertAdjacentHTML('beforeend', bubble(m).replace('<p class="bub', '<p data-mid="' + m.id + '" class="bub')); });
          S.lastMsg = d.messages[d.messages.length - 1].id;
          S.data.messages = S.data.messages.concat(d.messages);
          var near = window.innerHeight + window.scrollY > document.body.scrollHeight - 220;
          if (near) b.lastElementChild.scrollIntoView({ block: 'nearest' });
        }
        var key = JSON.stringify(d.thread.contract);
        if (key !== S.contractKey) { S.contractKey = key; S.data.thread = d.thread; var cp = $('#cpanel'); if (cp && d.thread.contract) cp.innerHTML = contractPanel(d.thread); loadMe(); }
      }, function () { /* try again next tick */ });
    }, 4000);
  }
  function stopPoll() { if (S.poll) { clearInterval(S.poll); S.poll = null; } }

  /* wallet + account */
  V.wallet = {
    need: 'any', title: function () { return 'Wallet'; },
    load: function () { return api('GET', 'wallet'); },
    html: function (d) {
      var cliR = role() === 'cli', pend = d.topups.filter(function (t) { return t.status === 'pending'; });
      var s = '<div class="wrap scr col"><h1 class="pg-title">Wallet</h1><section class="bal"><p class="small">Available balance</p><p class="bal-n">' + naira(d.avail) + '</p>' +
        (d.escrow_out ? '<p class="small">' + naira(d.escrow_out) + ' held in escrow for your hires</p>' : '') + (d.escrow_in ? '<p class="small">' + naira(d.escrow_in) + ' in escrow, paid to you when clients approve</p>' : '') +
        '<div class="bal-btns">' + (cliR ? '<button type="button" class="btn btn-primary" data-act="topup">' + ic('plus') + 'Add money</button>' : '') +
        '<button type="button" class="btn ' + (cliR ? 'btn-ghost' : 'btn-primary') + '" data-act="withdraw">Withdraw</button><button type="button" class="btn btn-ghost" data-act="bank">' + ic('bank') + (d.bank.acct ? 'Bank account' : 'Add bank account') + '</button>' +
        (!cliR ? '<button type="button" class="btn btn-ghost" data-act="topup">' + ic('plus') + 'Add money</button>' : '') + '</div></section>';
      pend.forEach(function (t) { s += '<div class="flag"><p>We’re checking your transfer of <strong>' + naira(t.amount) + '</strong> (reference <strong>' + esc(t.ref) + '</strong>). This usually takes less than an hour on working days.</p><button type="button" class="btn btn-ghost btn-sm" data-act="show-bank" data-ref="' + esc(t.ref) + '" data-amt="' + t.amount + '">Show bank details</button></div>'; });
      d.topups.filter(function (t) { return t.status === 'rejected'; }).forEach(function (t) { s += '<div class="flag warn"><p>Your transfer of ' + naira(t.amount) + ' (' + esc(t.ref) + ') couldn’t be confirmed: ' + esc(t.note) + '. If you sent it, message support with your receipt.</p></div>'; });
      var wds = d.withdrawals.filter(function (w) { return w.status === 'pending'; });
      if (wds.length) s += '<p class="small" style="margin-top:14px">' + wds.map(function (w) { return 'Withdrawal of ' + naira(w.amount) + ' is being processed.'; }).join(' ') + '</p>';
      s += secHead('Transactions') + (d.ledger.length ? '<ul class="tx">' + d.ledger.map(function (a) {
        var amt = a.kind === 'release' ? '<b class="rel">' + naira(a.info) + '<small>from escrow</small></b>' : '<b class="' + (a.amount > 0 ? 'pos' : '') + '">' + (a.amount > 0 ? '+' : '−') + naira(Math.abs(a.amount)).replace('−', '') + '</b>';
        return '<li><span class="tx-d">' + dateText(a.created_at) + '</span><span class="tx-l">' + esc(a.label) + (a.receipt ? '<a class="tx-rc" href="#/receipt/' + a.receipt + '">' + ic('receipt') + 'Receipt</a>' : '') + '</span>' + amt + '</li>';
      }).join('') + '</ul>' : emptyBox('No transactions yet', cliR ? 'Top-ups, escrow deposits and refunds show here.' : 'Payments from clients and withdrawals show here.'));
      return s + '</div>';
    }
  };
  function receiptBody(r) {
    var rows = '', money = '', status = '', tone = '', head = '';
    if (r.kind === 'contract') {
      var cl = r.side === 'client', refunded = r.stage === 'refunded';
      head = 'Contract receipt';
      status = cl ? { active: 'Paid into escrow', delivered: 'Paid into escrow', disputed: 'In dispute', paid: 'Completed', refunded: 'Refunded to you' }[r.stage]
        : { active: 'Held in escrow', delivered: 'Held in escrow', disputed: 'In dispute', paid: 'Paid to you', refunded: 'Refunded to the client' }[r.stage];
      tone = r.stage === 'paid' ? 'ok' : (refunded || r.stage === 'disputed') ? 'warn' : '';
      rows = kv('Job', esc(r.title)) + kv('Client', esc(r.client)) + kv('Freelancer', esc(r.freelancer)) + kv('Hired on', fullDate(r.date)) + kv('Delivery time', daysText(r.days)) +
        (r.closed_at ? kv(refunded ? 'Refunded on' : 'Paid on', fullDate(r.closed_at)) : '');
      money = cl ? kv('Freelancer’s price', naira(r.amount)) + kv('PadiHire service fee', naira(r.fee)) + kv('Total paid', naira(r.total), true) +
          (refunded ? kv('Refunded to your wallet', naira(r.amount + (r.fee_refunded ? r.fee : 0))) : '')
        : kv('Contract price', naira(r.amount)) + kv('PadiHire fee (' + r.fee_pct + '%)', '−' + naira(r.fee)) + (refunded ? kv('Paid to you', naira(0), true) : kv(r.stage === 'paid' ? 'You received' : 'You receive when approved', naira(r.net), true));
    } else if (r.kind === 'topup') {
      head = 'Wallet top-up receipt';
      status = { pending: 'Being checked', confirmed: 'Confirmed', rejected: 'Not confirmed' }[r.status] || r.status;
      tone = r.status === 'confirmed' ? 'ok' : r.status === 'rejected' ? 'warn' : '';
      rows = kv('Account', esc(r.name)) + kv('Method', 'Bank transfer') + kv('Transfer reference', esc(r.ref)) + kv('Requested on', fullDate(r.date)) +
        (r.decided_at ? kv(r.status === 'confirmed' ? 'Confirmed on' : 'Checked on', fullDate(r.decided_at)) : '') + (r.status === 'rejected' && r.note ? kv('Reason', esc(r.note)) : '');
      money = kv(r.status === 'confirmed' ? 'Added to wallet' : 'Amount', naira(r.amount), true);
    } else {
      head = 'Withdrawal receipt';
      status = { pending: 'Processing', paid: 'Paid', rejected: 'Not paid' }[r.status] || r.status;
      tone = r.status === 'paid' ? 'ok' : r.status === 'rejected' ? 'warn' : '';
      rows = kv('Account', esc(r.name)) + kv('Paid to', esc(r.bank) + ' ' + esc(r.acct)) + kv('Account name', esc(r.holder)) + kv('Requested on', fullDate(r.date)) +
        (r.decided_at ? kv(r.status === 'paid' ? 'Paid on' : 'Checked on', fullDate(r.decided_at)) : '') + (r.status === 'rejected' ? kv('What happened', esc(r.note || 'Not paid') + '. The money went back to your wallet.') : '');
      money = kv('Amount', naira(r.amount), true);
    }
    return '<article class="rcpt" aria-label="' + head + '"><header class="rc-head">' + brandHtml('#/', 'PadiHire home') + '<div class="rc-no"><p class="rc-kind">' + head + '</p><p class="rc-num">' + esc(r.number) + '</p></div></header>' +
      '<p class="rc-status' + (tone ? ' ' + tone : '') + '">' + esc(status) + '</p>' +
      '<dl class="kv rc-rows">' + rows + '</dl><dl class="kv box rc-money">' + money + '</dl>' +
      '<p class="rc-foot">PadiHire · Freelance work and talent in Nigeria' + (S.me.support_whatsapp ? ' · Support on WhatsApp: ' + esc(S.me.support_whatsapp) : '') + '<br>Printed ' + fullDate(Math.floor(Date.now() / 1000)) + '</p></article>';
  }
  V.receipt = {
    need: 'any', title: function (d) { return 'Receipt ' + d.receipt.number; },
    load: function (arg) { var m = /^(contract|topup|withdrawal)-(\d+)$/.exec(arg || ''); return m ? api('GET', 'receipts/' + m[1] + '/' + m[2]) : Promise.reject({ status: 404, message: 'Receipt not found.' }); },
    html: function (d) {
      return '<div class="wrap scr narrow"><div class="rc-top no-print">' + backBtn() + '<button type="button" class="btn btn-primary btn-sm" data-act="print">' + ic('down') + 'Save as PDF</button></div>' + receiptBody(d.receipt) +
        '<p class="small no-print rc-tip">Tap “Save as PDF”, then choose “Save as PDF” as the printer. On iPhone, tap Share in the print screen to save it to Files.</p></div>';
    }
  };
  function mitem(icon, title, sub, attrs) { return '<li><' + (attrs.indexOf('href=') === 0 ? 'a ' : 'button type="button" ') + attrs + '>' + ic(icon) + '<span><strong>' + title + '</strong>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + ic('next') + '</' + (attrs.indexOf('href=') === 0 ? 'a' : 'button') + '></li>'; }
  V.account = {
    need: 'any', title: function () { return 'Account'; },
    html: function () {
      var u = U(), cliR = role() === 'cli', w = S.me.wallet || {};
      var line = cliR ? (u.business || 'Client') + (u.city ? ' · ' + u.city : '') : (u.title || 'Freelancer') + (u.city ? ' · ' + u.city : '');
      return '<div class="wrap scr col"><div class="p-head">' + face(u.name, 'av-lg', u.photo) + '<div style="min-width:0"><h1 class="pg-title">' + esc(u.name) + '</h1><p class="small">' + esc(line) + '</p>' + (!cliR && u.reviews ? '<p class="stars">' + ic('star', 'is') + '<b>' + u.rating.toFixed(1) + '</b> · ' + u.jobs_done + ' jobs done</p>' : '') + '</div></div>' +
        '<ul class="mlist">' + mitem('wallet', 'Wallet', naira(w.avail) + ' available', 'href="#/wallet"') +
        mitem('pen', 'Edit profile', cliR ? 'Name, business, city, password' : 'Headline, bio, skills, price, password', 'href="#/edit-profile"') +
        (cliR ? mitem('plus', 'Post a job', '', 'href="#/post"') : mitem('eye', 'View public profile', '', 'href="#/freelancer/' + u.id + '"') + (u.username ? mitem('share', 'Share your profile', esc(location.host + '/u/' + u.username), 'data-act="share" data-url="' + esc(proUrl(u)) + '" data-title="' + esc(u.name + ' on PadiHire') + '"') : '') + mitem('heart', 'Saved jobs', '', 'href="#/work" data-saved="1"')) +
        mitem('bank', 'Bank account', u.bank.acct ? esc(u.bank.name) + ' •••• ' + esc(u.bank.acct.slice(-4)) : 'Not added yet', 'data-act="bank"') +
        mitem(cliR ? 'laptop' : 'briefcase', cliR ? 'Switch to freelancing' : 'Switch to hiring', cliR ? 'Find work with the same account' : 'Post jobs with the same account', 'data-act="switch" data-v="' + (cliR ? 'fre' : 'cli') + '"') +
        (S.me.mail ? mitem('bell', 'Email alerts', u.email_alerts ? 'On for messages and proposals' : 'Off. Payment emails still come', 'data-act="alerts"') : '') +
        mitem('help', 'Help and FAQ', 'How payments, escrow and fees work', 'href="#/help"') + mitem('doc', 'Terms and rules', '', 'href="#/terms"') + mitem('shield', 'Privacy policy', 'How we use and protect your data', 'href="#/privacy"') +
        (S.me.support_whatsapp ? mitem('whatsapp', 'Contact support', 'WhatsApp', 'href="https://wa.me/' + esc(waNum(S.me.support_whatsapp)) + '" target="_blank" rel="noopener"') : '') +
        (S.me.is_admin ? mitem('gear', 'Admin panel', 'Top-ups, withdrawals, disputes', 'href="/admin"') : '') +
        mitem('logout', 'Log out', '', 'data-act="signout"') + '</ul></div>';
    }
  };
  function profileHtml(setup) {
      var u = U(), fre = role() === 'fre';
      S.cv = undefined; S.cvfill = null;
      return '<div class="wrap scr narrow">' + (setup ? '<p class="step-note">Last step</p>' : backBtn()) + '<h1 class="pg-title">' + (setup ? (fre ? 'Set up your profile' : 'Finish your profile') : 'Edit profile') + '</h1>' +
        (setup ? '<p class="pg-sub">' + (fre ? 'Clients see this when you apply. Fill it in to start using PadiHire.' : 'Tell freelancers where you are. This takes a few seconds.') + '</p>' : '') +
        (S.me.uploads ? photoRow(u) : '') +
        (fre && S.me.ai ? cvFillBox(setup) : '') +
        '<form id="f-profile" class="form" novalidate data-setup="' + (setup ? 1 : 0) + '">' +
        field('pf-name', 'Full name', '<input id="pf-name" type="text" value="' + esc(u.name) + '" autocomplete="name">') +
        field('pf-city', 'State', '<select id="pf-city">' + cityOptions('Choose your state') + '</select>') +
        (fre ? field('pf-cat', 'Category', '<select id="pf-cat">' + catOptions('Choose one') + '</select>') +
          field('pf-title', 'Headline', '<input id="pf-title" type="text" maxlength="80" value="' + esc(u.title) + '" placeholder="e.g. Brand and social media designer">', 'Shown under your name') +
          '<div class="field" id="pf-skills"><span class="flabel">Your skills (up to 3)</span>' + skillPicker('pf', 3, u.skills, u.cat) + '<p class="err" id="pf-skills-err" hidden></p></div>' +
          field('pf-about', 'About you', '<textarea id="pf-about" rows="5" maxlength="1200" placeholder="What you do, who you have worked for, and how fast you deliver.">' + esc(u.about) + '</textarea>', 'At least a sentence or two') +
          '<div class="field"><span class="flabel">CV <span class="opt">(optional)</span></span>' + cvBlock() + '</div>' +
          field('pf-rate', 'Jobs from (₦) <span class="opt">(optional)</span>', '<input id="pf-rate" type="text" inputmode="numeric" value="' + (u.rate_from ? num(u.rate_from) : '') + '" placeholder="15,000">', 'Your usual starting price')
          : field('pf-business', 'Business or brand name <span class="opt">(optional)</span>', '<input id="pf-business" type="text" value="' + esc(u.business) + '">')) +
        (fre && !setup ? field('pf-username', 'Your profile link', '<div class="ulink"><span class="ulink-pre" aria-hidden="true">' + esc(location.host) + '/u/</span><input id="pf-username" type="text" value="' + esc(u.username || '') + '" autocapitalize="off" autocomplete="off" spellcheck="false" maxlength="30"></div>', 'Share it on WhatsApp, Instagram or your CV. Letters, numbers and dashes.') : '') +
        field('pf-phone', 'Phone number <span class="opt">(optional)</span>', '<input id="pf-phone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(u.phone) + '" placeholder="0803 123 4567">', 'Only PadiHire sees it, for support and logging in. Never shown to anyone else.') +
        '<button type="submit" class="btn btn-primary full">' + (setup ? (fre ? 'Save and find work' : 'Save and continue') : 'Save profile') + '</button></form>' +
        (fre && !setup ? '<h2 class="sub" style="margin-top:34px">Portfolio</h2><p class="small">Show up to 8 pictures of your best work. Clients see them on your profile.</p><div id="pf-port" class="port-grid">' + portGrid(S.port, true) + '</div>' : '') +
        (setup ? '<p class="center-line small">Not you? <button type="button" class="link-btn" data-act="signout">Log out</button></p>' :
        '<h2 class="sub" style="margin-top:34px">Change password</h2><form id="f-pass" class="form" novalidate>' +
        field('pw-current', 'Current password', '<input id="pw-current" type="password" autocomplete="current-password">') +
        field('pw-password', 'New password', '<input id="pw-password" type="password" autocomplete="new-password" placeholder="At least 8 characters">') +
        '<button type="submit" class="btn btn-ghost full">Change password</button></form>') + '</div>';
  }
  function photoRow(u) {
    return '<div class="ph-row" id="ph-row">' + face(u.name, 'av-xl', u.photo) + '<div class="ph-main"><p class="ph-t">Profile photo <span class="opt">(optional)</span></p><p class="hint" id="ph-hint">' + (role() === 'fre' ? 'A clear photo of your face helps clients trust you.' : 'Freelancers see it on your jobs and messages.') + '</p>' +
      '<div class="ph-btns"><label class="btn btn-ghost btn-sm ph-pick">' + ic('camera') + (u.photo ? 'Change photo' : 'Add photo') + '<input type="file" id="up-photo" class="sr-only" accept="image/png,image/jpeg,image/webp"></label>' + (u.photo ? '<button type="button" class="link-btn" data-act="photo-del">Remove</button>' : '') + '</div><p class="err" id="ph-err" hidden></p></div></div>';
  }
  function squarePhoto(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, sz = Math.min(w, h), out = Math.min(400, sz), cv = document.createElement('canvas');
        URL.revokeObjectURL(url);
        if (!sz) return no(new Error('bad image'));
        cv.width = cv.height = out;
        var g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.fillStyle = '#fff'; g.fillRect(0, 0, out, out);
        g.drawImage(img, (w - sz) / 2, (h - sz) / 2, sz, sz, 0, 0, out, out);
        cv.toBlob(function (b) { if (!b) return no(new Error('bad image')); try { ok(new File([b], 'photo.jpg', { type: 'image/jpeg' })); } catch (e) { b.name = 'photo.jpg'; ok(b); } }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('bad image')); };
      img.src = url;
    });
  }
  function photoDone(msg, err) { var row = $('#ph-row'); if (row) row.outerHTML = photoRow(U()); if (err) fieldErr('ph', err); else toast(msg); }
  function setPhoto(file) {
    fieldErr('ph', '');
    var hint = $('#ph-hint'); if (hint) hint.textContent = 'Uploading your photo…';
    squarePhoto(file).then(null, function () { if (file.size > 5 * 1048576) throw new Error('That picture is too big. The limit is 5 MB.'); return file; })
      .then(function (f2) { return upload(f2, 'avatar'); })
      .then(function (r) { return api('POST', 'me/photo', { file_id: r.id }); })
      .then(function () { return loadMe(); })
      .then(function () { photoDone('Photo saved'); }, function (er) { photoDone('', er.message); });
  }
  function profileAfter() { var u = U(); var c = $('#pf-city'); if (c) c.value = u.city || ''; var k = $('#pf-cat'); if (k) k.value = u.cat || ''; }
  V['edit-profile'] = { need: 'any', title: function () { return 'Edit profile'; }, load: function () { return role() === 'fre' ? api('GET', 'me/portfolio').then(function (r) { S.port = r.items; }) : null; }, html: function () { return profileHtml(false); }, after: profileAfter };
  V.setup = { need: 'any', title: function () { return 'Set up your profile'; }, html: function () { return profileHtml(true); }, after: profileAfter };
  V.terms = {
    title: function () { return 'Terms and rules'; },
    html: function () {
      function sec(t, items) { return '<section class="d-block"><h2 class="sub">' + t + '</h2><ul class="terms">' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></section>'; }
      return '<div class="wrap scr col">' + backBtn() + '<h1 class="pg-title">Terms and rules</h1><p class="pg-sub">The short version of how PadiHire works. By creating an account you agree to these rules.</p>' +
        sec('Payments and escrow', ['Posting a job is free. A client deposits the freelancer’s agreed price into escrow when they hire, before work starts.', 'PadiHire holds the money until the client approves the work. If the client doesn’t respond within 5 days of delivery, the money is released to the freelancer automatically.', 'Wallet top-ups are made by bank transfer to PadiHire and are added to your wallet once confirmed.', 'Withdrawals are paid to a Nigerian bank account in your own name, usually within 24 hours on working days.']) +
        sec('Fees', ['Clients pay a service fee when they hire. Freelancers pay a fee on what they earn. Each side sees its own fee before committing.', 'Fees may change. Any change is shown before you commit to a new job or proposal.']) +
        sec('Keep everything on PadiHire', ['Don’t ask for or share phone numbers, emails or payment details before a hire. They are hidden automatically.', 'Paying or being paid outside PadiHire removes your escrow protection and can get your account suspended.', 'Never pay anyone to apply for a job. Report it.']) +
        sec('Disputes', ['Either side can open a dispute on a live contract. The money stays in escrow until PadiHire reviews the chat and files, then releases it or refunds the client.', 'Our decision is based on what was agreed and delivered in the PadiHire chat.']) +
        sec('Accounts', ['One person, one account. Use your real name and a phone number you own.', 'We can suspend accounts for fraud, abuse, fake jobs or attempts to move payments off PadiHire.']) + '</div>';
    }
  };

  V.privacy = {
    title: function () { return 'Privacy policy'; },
    html: function () {
      function sec(t, items) { return '<section class="d-block"><h2 class="sub">' + t + '</h2><ul class="terms">' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></section>'; }
      var wa = S.me.support_whatsapp;
      return '<div class="wrap scr col">' + backBtn() + '<h1 class="pg-title">Privacy policy</h1><p class="pg-sub">How PadiHire collects, uses and protects your personal data. Last updated 24 October 2026.</p>' +
        sec('What we collect', ['Account details: your name, email address, phone number, city, and whether you hire or freelance.', 'Profile details you add: headline, category, skills, bio, starting price, business name and CV.', 'Your activity on PadiHire: jobs, proposals, messages, files you upload, reviews and reports.', 'Money records: wallet top-ups, payments held in escrow, fees, withdrawals, and the bank account you add for withdrawals.', 'One login cookie that keeps you signed in for up to 30 days. We don’t use advertising or tracking cookies.']) +
        sec('How we use it', ['To run your account and show your profile, jobs and proposals to the right people.', 'To hold payments in escrow, pay freelancers, make refunds and keep accurate records.', 'To keep PadiHire safe. Messages are checked automatically for phone numbers, emails, social handles and talk of paying outside PadiHire. Those details are hidden, and the message may be flagged for our team to review.', 'To settle disputes. When a dispute is opened, our team reads the chat and files for that contract.', 'To give support and tell you about important changes to your account.']) +
        sec('Who can see what', ['Anyone can see a freelancer’s public profile: name, headline, city, skills, bio, rating and reviews.', 'Job posts show the client’s name or business name.', 'Only signed-in users can open a freelancer’s CV.', 'Proposals and their files are seen only by the client who posted the job.', 'Messages are seen only by the two people in the chat, and by our team when a message is flagged or a dispute is opened.', 'Your phone number, email address and bank details are never shown to other users.']) +
        sec('Who we share it with', ['We don’t sell your personal data.', 'Companies that run PadiHire for us, such as Cloudflare for hosting, the database and file storage. Pages also load fonts from Google Fonts. Some of this data may be stored on servers outside Nigeria.', 'Banks, to send withdrawals and refunds.', 'The police, courts or regulators, when the law requires it or to deal with fraud.']) +
        sec('How long we keep it', ['We keep your data while your account is open.', 'If you close your account, we delete or anonymise your profile. We keep payment, contract and dispute records for as long as the law and our accounts require.']) +
        sec('Keeping it safe', ['Passwords are stored scrambled (hashed), never as plain text.', 'The site uses an encrypted connection (HTTPS), and only a small team can use the admin tools.', 'If a data breach affects you, we will tell you and the regulator as the law requires.']) +
        sec('Your rights', ['Under the Nigeria Data Protection Act 2023 you can ask to see, correct or delete your data, get a copy of it, or object to how we use it.', 'You can correct most details yourself in Edit profile. For anything else, contact support.', 'If you are not happy with our answer, you can complain to the Nigeria Data Protection Commission (NDPC).']) +
        sec('Other', ['PadiHire is for people aged 18 and over.', 'If we change this policy, we will update it here and change the date at the top. Big changes will also be announced in the app.']) +
        (wa ? '<p style="margin-top:24px"><a class="btn btn-ghost" href="https://wa.me/' + esc(waNum(wa)) + '" target="_blank" rel="noopener">' + ic('whatsapp') + 'Contact support</a></p>' : '') + '</div>';
    }
  };

  /* ---------- public pages: how it works, pricing, about, help ---------- */
  ICONS.menu = '<path d="M4 7h16M4 12h16M4 17h16"/>';
  function pricingData() { return S.pricing ? Promise.resolve(S.pricing) : api('GET', 'pricing').then(function (p) { S.pricing = p; return p; }); }
  function joinBtn(r, label, cls) {
    if (U()) return r === 'cli' ? '<a class="btn ' + (cls || 'btn-primary') + '" href="#/post">' + label + '</a>' : '<a class="btn ' + (cls || 'btn-primary') + '" href="#/' + home() + '">' + label + '</a>';
    return '<button type="button" class="btn ' + (cls || 'btn-primary') + '" data-act="join" data-v="' + r + '">' + label + '</button>';
  }
  function pageHead(eyebrow, title, lead) { return '<header class="pp-head"><p class="eyebrow">' + eyebrow + '</p><h1 class="pp-title">' + title + '</h1>' + (lead ? '<p class="pp-lead">' + lead + '</p>' : '') + '</header>'; }
  function stepList(items) { return '<ol class="pp-steps">' + items.map(function (it) { return '<li><h3>' + it[0] + '</h3><p>' + it[1] + '</p></li>'; }).join('') + '</ol>'; }
  function checkList(items) { return '<ul class="pp-checks">' + items.map(function (x) { return '<li>' + ic('tick') + '<span>' + x + '</span></li>'; }).join('') + '</ul>'; }
  function faq(items) { return '<div class="faq">' + items.map(function (q) { return '<details><summary>' + q[0] + '</summary><p>' + q[1] + '</p></details>'; }).join('') + '</div>'; }
  function waBox(title, body) {
    var wa = S.me.support_whatsapp || (S.pricing && S.pricing.support_whatsapp);
    return '<section class="pp-contact"><div><h2>' + title + '</h2><p>' + body + '</p></div>' + (wa ? '<a class="btn btn-primary" href="https://wa.me/' + esc(waNum(wa)) + '" target="_blank" rel="noopener">' + ic('whatsapp') + 'Chat with us on WhatsApp</a>' : '') + '</section>';
  }
  V.how = {
    title: function () { return 'How it works'; },
    load: pricingData,
    html: function (p) {
      var fre = (S.howtab || (role() === 'fre' ? 'fre' : 'cli')) === 'fre';
      return '<div class="wrap scr pp">' + pageHead('How it works', 'Hire or get hired, with your money protected', 'PadiHire holds the payment in escrow from the moment a freelancer is hired until the client approves the work.') +
        utabs('howtab', [['cli', 'For clients'], ['fre', 'For freelancers']], fre ? 'fre' : 'cli') +
        (fre ? stepList([
          ['Create a free profile', 'Choose your category and skills, write a short bio and add your CV and portfolio. Clients see this when you apply.'],
          ['Send proposals', 'Find jobs that fit you and send your price, how long you need and samples of your work. You get ' + p.monthly_proposals + ' proposals every month.'],
          ['Start when the money is safe', 'When a client hires you, they have already paid into escrow. You can see the money is there before you start.'],
          ['Deliver and get paid', 'Deliver in the PadiHire chat. When the client approves, the money moves to your wallet and you can withdraw it to your bank.']
        ]) + '<div class="pp-cta">' + joinBtn('fre', 'Create a free profile') + '<a class="link-btn" href="#/jobs">See the latest jobs</a></div>'
          : stepList([
          ['Post a job for free', 'Say what you need, your budget and when you need it done. It takes about two minutes.'],
          ['Compare proposals', 'Freelancers send their price, timeline and samples. Chat with them on PadiHire before you decide.'],
          ['Hire and pay into escrow', 'Add money to your wallet and hire. PadiHire holds the payment safely while the work is being done.'],
          ['Approve and release payment', 'Check the work in the chat. Ask for changes, or approve to release the payment to the freelancer.']
        ]) + '<div class="pp-cta">' + joinBtn('cli', 'Post a job for free') + '<a class="link-btn" href="#/freelancers">Browse freelancers</a></div>') +
        '<section class="pp-box"><h2>' + ic('shield') + 'How your money is protected</h2>' + checkList([
          'The client pays before the work starts, and PadiHire holds the money, not the freelancer.',
          'If the client doesn’t respond within ' + p.auto_release_days + ' days of delivery, the payment is released to the freelancer automatically.',
          'If something goes wrong, either side can open a dispute. PadiHire reads the chat and decides whether to release or refund.',
          'Phone numbers and talk of paying outside PadiHire are hidden in chats, so nobody loses this protection by accident.'
        ]) + '</section></div>';
    }
  };
  V.pricing = {
    title: function () { return 'Pricing'; },
    load: pricingData,
    html: function (p) {
      var fre = (S.pricetab || (role() === 'fre' ? 'fre' : 'cli')) === 'fre';
      var ex = 50000, cfee = Math.round(ex * p.client_fee_pct / 100), ffee = Math.round(ex * p.fre_fee_pct / 100);
      var card = fre
        ? '<section class="price-card"><h2>For freelancers</h2><p class="price-big">' + p.fre_fee_pct + '%<span>of what you earn on each job</span></p>' +
          '<div class="price-ex"><span>Win a ' + naira(ex) + ' job</span><b>You receive ' + naira(ex - ffee) + '</b><small>' + naira(ffee) + ' PadiHire fee</small></div>' +
          checkList(['Free to join, with a free profile and portfolio', p.monthly_proposals + ' proposals every month, free', 'The client pays into escrow before you start', 'Withdraw your earnings to a Nigerian bank account', 'No fee to send proposals or chat with clients']) +
          joinBtn('fre', 'Create a free profile', 'btn-primary full') + '</section>'
        : '<section class="price-card"><h2>For clients</h2><p class="price-big">' + p.client_fee_pct + '%<span>service fee, only when you hire</span></p>' +
          '<div class="price-ex"><span>Hire a freelancer for ' + naira(ex) + '</span><b>You pay ' + naira(ex + cfee) + '</b><small>' + naira(ex) + ' for the work + ' + naira(cfee) + ' service fee</small></div>' +
          checkList(['Post jobs for free', 'Get proposals and chat with freelancers for free', 'Your payment stays in escrow until you approve the work', 'Ask for changes, or open a dispute if something goes wrong', 'Help from a real person on WhatsApp']) +
          joinBtn('cli', 'Post a job for free', 'btn-primary full') + '</section>';
      return '<div class="wrap scr pp">' + pageHead('Pricing', 'Free to join. Pay only when work happens.', 'Posting jobs, creating a profile, sending proposals and chatting are all free. PadiHire charges a small fee only when someone is hired.') +
        utabs('pricetab', [['cli', 'For clients'], ['fre', 'For freelancers']], fre ? 'fre' : 'cli') + card +
        '<h2 class="pp-h2">Questions about fees</h2>' + faq([
          ['When is the fee charged?', 'Clients pay the service fee when they hire, together with the price of the work. Freelancers’ fee is taken when the payment is released to them.'],
          ['Is there a monthly subscription?', 'No. There’s nothing to pay until someone is hired.'],
          ['What happens to fees if a job is refunded?', 'If PadiHire refunds a job after a dispute, the freelancer isn’t paid, so no freelancer fee is taken. The client’s service fee may also be refunded, depending on the decision.'],
          ['Can I see the fee before I commit?', 'Yes. Clients see the total before they hire, and freelancers see what they’ll receive before they send a proposal.']
        ]) + '</div>';
    }
  };
  V.about = {
    title: function () { return 'About PadiHire'; },
    load: pricingData,
    html: function () {
      return '<div class="wrap scr pp">' + pageHead('About PadiHire', 'Freelance work Nigerians can trust', 'PadiHire is a freelance marketplace for Nigeria. We help businesses find skilled freelancers for design, writing, websites, video, social media and admin work, and we help freelancers get paid safely for their skills.') +
        '<section class="pp-sec"><h2>Why we built PadiHire</h2><p>Hiring online in Nigeria often runs on trust alone. Clients pay upfront and hope the work arrives. Freelancers deliver and hope they get paid. PadiHire puts escrow in the middle: the client’s money is held safely until the work is approved, so both sides can get on with the job.</p></section>' +
        '<section class="pp-sec"><h2>What we stand for</h2><div class="pp-grid">' +
          '<div class="pp-card">' + ic('shield') + '<h3>Safe payments</h3><p>Every job is paid into escrow before work starts.</p></div>' +
          '<div class="pp-card">' + ic('wallet') + '<h3>Fair, simple fees</h3><p>Free to join and free to post. A small fee only when someone is hired.</p></div>' +
          '<div class="pp-card">' + ic('pin') + '<h3>Built for Nigeria</h3><p>Naira prices, Nigerian bank accounts, and people in all 36 states and the FCT.</p></div>' +
          '<div class="pp-card">' + ic('chat') + '<h3>Real support</h3><p>Questions or problems go to a real person on WhatsApp.</p></div>' +
        '</div></section>' +
        '<div class="pp-cta">' + joinBtn('cli', 'Hire talent') + joinBtn('fre', 'Find work', 'btn-ghost') + '</div>' +
        waBox('Talk to us', 'Questions about PadiHire, partnerships or press? Send us a message.') + '</div>';
    }
  };
  V.help = {
    title: function () { return 'Help and FAQ'; },
    load: pricingData,
    html: function (p) {
      return '<div class="wrap scr pp">' + pageHead('Help', 'Help and FAQ', 'Quick answers to the questions people ask most.') +
        '<h2 class="pp-h2">Payments</h2>' + faq([
          ['How does escrow work?', 'When a client hires a freelancer, the agreed price is held by PadiHire. The freelancer delivers in the chat, and when the client approves, the money is released to the freelancer’s wallet. If the client doesn’t respond within ' + p.auto_release_days + ' days of delivery, it’s released automatically.'],
          ['How do I add money to my wallet?', 'Go to your wallet, tap Add money and make a bank transfer using the reference shown. Your wallet updates once PadiHire confirms the transfer.'],
          ['How do I withdraw my earnings?', 'Add your bank account in your profile, then go to your wallet and tap Withdraw. The account must be in your own name.'],
          ['What if I’m not happy with the work?', 'Ask for changes in the chat first. If you still can’t agree, open a dispute. The money stays in escrow while PadiHire reviews the chat and decides.']
        ]) +
        '<h2 class="pp-h2">Your account</h2>' + faq([
          ['Can I be a client and a freelancer?', 'Yes. Use the same account and switch between hiring and freelancing from the Me page.'],
          ['I forgot my password', 'Tap “Forgot your password?” on the log in page. If you can’t get in, message us on WhatsApp.'],
          ['Why are phone numbers hidden in chats?', 'Deals made outside PadiHire lose escrow protection, and that’s where most scams happen. So phone numbers, emails, social handles and talk of paying outside PadiHire are hidden in chats.'],
          ['How do I report a scam or a fake job?', 'Use the Report button on the job, or message us on WhatsApp with the details. Never pay anyone to apply for a job.']
        ]) + waBox('Still need help?', 'Message PadiHire support on WhatsApp and a real person will help you.') + '</div>';
    }
  };
  var VNAV = [['freelancers', 'Hire talent'], ['jobs', 'Find work'], ['how', 'How it works'], ['pricing', 'Pricing']];
  function drawerHtml() {
    var key = navKey(S.view);
    function item(href, icon, title, sub) { return '<a class="dr-item" href="' + href + '"' + (href === '#/' + key ? ' aria-current="page"' : '') + '>' + ic(icon) + '<span><strong>' + title + '</strong>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></a>'; }
    return '<div class="dr-backdrop" data-act="menu-close"></div><nav class="dr-panel" role="dialog" aria-modal="true" aria-label="Menu">' +
      '<div class="dr-top">' + brandHtml('#/', 'PadiHire home') + '<button type="button" class="dr-x" data-act="menu-close" aria-label="Close menu">' + ic('close') + '</button></div>' +
      '<div class="dr-body">' +
      item('#/freelancers', 'users', 'Hire talent', 'Browse freelancers across Nigeria') +
      item('#/jobs', 'search', 'Find work', 'See the latest jobs') +
      item('#/how', 'help', 'How it works', 'Hiring and getting paid, step by step') +
      item('#/pricing', 'wallet', 'Pricing', 'Free to join, small fee when you hire') +
      item('#/about', 'shield', 'About PadiHire', '') +
      item('#/help', 'chat', 'Help and FAQ', '') +
      '<p class="dr-label">Browse by category</p><div class="dr-cats">' + CATS.map(function (c) { return '<a href="#/jobs?cat=' + c.id + '">' + esc(c.short) + '</a>'; }).join('') + '</div>' +
      '</div><div class="dr-foot"><button type="button" class="btn btn-primary full" data-act="join">Sign up</button><a class="btn btn-ghost full" href="#/login">Log in</a>' +
      '<p class="dr-legal"><a href="#/terms">Terms</a><a href="#/privacy">Privacy</a></p></div></nav>';
  }
  function openDrawer() {
    var d = $('#drawer');
    if (!d) { document.body.insertAdjacentHTML('beforeend', '<div id="drawer" class="drawer" hidden></div>'); d = $('#drawer'); }
    d.innerHTML = drawerHtml(); d.hidden = false; document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { d.classList.add('open'); });
    var b = $('.menu-btn'); if (b) b.setAttribute('aria-expanded', 'true');
    var x = $('#drawer .dr-x'); if (x) x.focus();
  }
  function closeDrawer() {
    var d = $('#drawer'); if (!d || d.hidden) return;
    d.classList.remove('open'); d.hidden = true; document.body.style.overflow = '';
    var b = $('.menu-btn'); if (b) { b.setAttribute('aria-expanded', 'false'); if (document.activeElement === document.body || !document.activeElement) b.focus(); }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  /* ---------- chrome ---------- */
  var NAV = {
    visitor: [['explore', 'Home', 'home'], ['jobs', 'Jobs', 'search'], ['freelancers', 'Freelancers', 'users'], ['login', 'Log in', 'user']],
    fre: [['home', 'Home', 'home'], ['work', 'Find work', 'search'], ['proposals', 'My work', 'briefcase'], ['messages', 'Chats', 'chat'], ['account', 'Me', 'user']],
    cli: [['dash', 'Home', 'home'], ['freelancers', 'Talent', 'users'], ['post', 'Post a job', 'plus'], ['messages', 'Chats', 'chat'], ['account', 'Me', 'user']]
  };
  function navKey(v) {
    if (v === 'job') return role() === 'fre' ? 'work' : role() === 'cli' ? 'dash' : 'jobs';
    if (v === 'chat') return 'messages';
    if (v === 'freelancer') return 'freelancers';
    if (v === 'myjob' || v === 'edit-job') return 'dash';
    if (v === 'receipt') return role() === 'cli' ? 'dash' : 'home';
    if (v === 'contracts') return 'proposals';
    if (v === 'wallet') return role() === 'cli' ? 'dash' : 'home';
    if (v === 'join') return 'login';
    if (v === 'edit-profile' || v === 'terms' || v === 'privacy' || v === 'setup') return 'account';
    return v;
  }
  function chrome() {
    var key = navKey(S.view), items = NAV[role() || 'visitor'], u = U();
    function badge(id) { var n = id === 'messages' ? S.me.unread : id === 'dash' ? S.me.waiting : 0; return n ? '<span class="count">' + n + '</span>' : ''; }
    var right = !u ? '<a class="login" href="#/login">Log in</a><button type="button" class="btn btn-primary btn-sm" data-act="join">Sign up</button>'
      : '<a class="me-btn" href="#/account" aria-label="Your account"' + (S.view === 'account' ? ' aria-current="page"' : '') + '>' + face(u.name, '', u.photo) + '</a>';
    var navItems = u ? items.filter(function (it) { return it[0] !== 'login' && it[0] !== 'account'; }) : VNAV;
    $('#top').innerHTML = '<div class="wrap top-in">' + (u ? '' : '<button type="button" class="menu-btn" data-act="menu" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">' + ic('menu') + '</button>') + brandHtml('#/', 'PadiHire home') +
      '<nav class="nav" aria-label="Main">' + navItems.map(function (it) { return '<a href="#/' + it[0] + '"' + (it[0] === key ? ' aria-current="page"' : '') + '>' + it[1] + badge(it[0]) + '</a>'; }).join('') + '</nav>' +
      '<div class="top-right">' + right + '</div></div>';
    document.body.classList.toggle('guest', !u);
    footer();
    document.body.classList.toggle('hero-top', S.view === 'explore' && !u);
    var tabs = $('#tabs'); tabs.style.setProperty('--n', items.length);
    if (!u) { tabs.innerHTML = ''; return; }
    tabs.innerHTML = items.map(function (it) {
      var cur = it[0] === key ? ' aria-current="page"' : '';
      if (it[0] === 'post') return '<a class="fab" href="#/post"' + cur + '><span class="fab-c">' + ic('plus') + '</span>Post</a>';
      return '<a href="#/' + it[0] + '"' + cur + '>' + ic(it[2]) + it[1] + badge(it[0]) + '</a>';
    }).join('');
  }
  function footer() {
    var f = $('#foot'), on = !U();
    f.classList.toggle('foot-min', !on);
    f.innerHTML = on ? '<div class="wrap foot"><p>© ' + new Date().getFullYear() + ' PadiHire · Freelance work and talent in Nigeria</p><p class="foot-links"><a class="link-btn" href="#/how">How it works</a><a class="link-btn" href="#/pricing">Pricing</a><a class="link-btn" href="#/about">About</a><a class="link-btn" href="#/help">Help</a><a class="link-btn" href="#/terms">Terms</a><a class="link-btn" href="#/privacy">Privacy</a></p></div>' : '';
  }

  /* ---------- modals ---------- */
  function gate(r, title, body) { openModal(modalHead(title, body) + '<div class="done-btns"><button type="button" class="btn btn-primary" data-act="join" data-v="' + r + '">' + (r === 'cli' ? 'Sign up as a client' : 'Sign up as a freelancer') + '</button><a class="btn btn-ghost" href="#/login">Log in</a></div>'); }
  function modalApply(j) {
    S.att.apply = [];
    var pct = j.fre_fee_pct || feePct().fre_fee_pct || 0;
    openModal(modalHead('Submit a proposal', esc(j.title)) + '<form id="f-apply" data-id="' + j.id + '" data-pct="' + pct + '" novalidate>' +
      '<div class="field-row">' + field('ap-price', 'Your bid (₦)', '<input id="ap-price" type="text" inputmode="numeric" value="' + num(j.budget) + '">', 'After the ' + pct + '% fee, you receive ' + naira(j.budget - Math.round(j.budget * pct / 100))) + field('ap-days', 'Days to deliver', '<input id="ap-days" type="text" inputmode="numeric" value="' + j.days + '">') + '</div>' +
      field('ap-note', 'Cover letter', '<textarea id="ap-note" rows="6" maxlength="3000" placeholder="Explain why you are a good fit, and share links to similar work."></textarea>') +
      (S.me.uploads ? '<div class="field"><span class="flabel">Attachments (optional, up to 3)</span>' + attBox('apply', 3, 'Add files') + '<p class="hint">Samples of your work. Up to 20 MB each.</p></div>' : '') +
      '<p class="small" style="margin-top:12px">If the client hires you, they deposit your price into escrow first. Only start when your contract shows the money is held.</p>' +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Submit proposal</button></div></form>');
  }
  function bankRows(b, ref) {
    return '<dl class="kv box">' + kv('Bank', esc(b.name)) + kv('Account number', '<span id="tp-acct">' + esc(b.acct) + '</span> <button type="button" class="copy" data-act="copy" data-copy="' + esc(b.acct) + '">' + ic('copy') + 'Copy</button>') + kv('Account name', esc(b.holder)) +
      kv('Reference', '<span id="tp-ref">' + esc(ref) + '</span> <button type="button" class="copy" data-act="copy" data-copy="' + esc(ref) + '">' + ic('copy') + 'Copy</button>', true) + '</dl>';
  }
  function modalTopup(need, sub) {
    openModal(modalHead('Add money by bank transfer', sub || 'Tell us how much you’ll send. We’ll show you where to send it and a reference to use.') +
      '<form id="f-topup" novalidate>' + field('tp-amount', 'Amount (₦)', '<input id="tp-amount" type="text" inputmode="numeric" value="' + (need ? num(need) : '') + '" placeholder="50,000">', need ? 'At least ' + naira(need) : '') +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Continue</button></div></form>');
  }
  function modalTransfer(d) {
    openModal(modalHead('Transfer ' + naira(d.amount), 'Send exactly this amount from any Nigerian bank app, and put the reference in the narration so we can match it.') + bankRows(d.bank, d.ref) +
      '<p class="small" style="margin-top:10px">We add it to your wallet once we see it, usually within an hour on working days.</p><div class="done-btns"><button type="button" class="btn btn-primary" data-act="sent">I’ve sent the money</button></div>');
  }
  function modalWithdraw() {
    var w = S.me.wallet || {}, u = U();
    if (!u.bank.acct) return modalBank('Add the bank account to pay your withdrawals into.');
    openModal(modalHead('Withdraw', 'To ' + esc(u.bank.name) + ' •••• ' + esc(u.bank.acct.slice(-4)) + ', usually within 24 hours on working days.') +
      '<form id="f-withdraw" novalidate>' + field('wd-amount', 'Amount (₦)', '<input id="wd-amount" type="text" inputmode="numeric" value="' + (w.avail ? num(w.avail) : '') + '">', 'Available: ' + naira(w.avail)) +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Withdraw</button></div></form>');
  }
  function modalBank(sub) {
    var b = U().bank;
    openModal(modalHead('Bank account', sub || 'Withdrawals are paid to this account. It must be in your own name.') + '<form id="f-bank" novalidate>' +
      field('bk-bank_name', 'Bank', '<input id="bk-bank_name" type="text" value="' + esc(b.name) + '" placeholder="e.g. Access Bank">') +
      field('bk-bank_acct', 'Account number', '<input id="bk-bank_acct" type="text" inputmode="numeric" maxlength="10" value="' + esc(b.acct) + '" placeholder="10 digits">') +
      field('bk-bank_holder', 'Account name', '<input id="bk-bank_holder" type="text" value="' + esc(b.holder || U().name) + '">') +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Save bank account</button></div></form>');
  }
  function modalReport(j) {
    openModal(modalHead('Report this job', esc(j.title)) + '<form id="f-report" data-id="' + j.id + '" novalidate><fieldset class="reasons"><legend class="sr-only">Reason</legend>' +
      ['Asked me to pay to apply', 'Wants payment outside PadiHire', 'Fake or misleading job', 'Something else'].map(function (r, i) { return '<label class="reason"><input type="radio" name="reason" value="' + esc(r) + '"' + (i === 0 ? ' checked' : '') + '>' + r + '</label>'; }).join('') +
      '</fieldset><div class="modal-actions"><button type="submit" class="btn btn-primary full">Send report</button></div></form>');
  }
  function modalHire(p) {
    var d = S.data, pct = d.client_fee_pct, fee = Math.round(p.price * pct / 100), total = p.price + fee, avail = d.avail, need = total - avail, fn = esc(first(p.name));
    openModal(modalHead('Hire ' + esc(p.name), esc(d.job.title) + ' · ' + daysText(p.days)) +
      '<dl class="kv box">' + kv(fn + '’s price', naira(p.price)) + kv('PadiHire service fee (' + pct + '%)', naira(fee)) + kv('Total to deposit', naira(total), true) + '</dl>' +
      '<dl class="kv" style="margin-top:6px">' + kv('In your wallet', naira(avail)) + (need > 0 ? kv('Still needed', '<span class="act-t">' + naira(need) + '</span>') : '') + '</dl>' +
      (need > 0 ? '<p class="small" style="margin-top:10px">Add ' + naira(need) + ' by bank transfer. Once we confirm it, come back here to finish hiring ' + fn + '. ' + fn + ' doesn’t start until the money is in escrow.</p><div class="modal-actions"><button type="button" class="btn btn-primary full" data-act="topup" data-need="' + need + '">Add ' + naira(need) + ' by bank transfer</button></div>'
        : '<p class="small" style="margin-top:10px">PadiHire holds ' + naira(p.price) + ' in escrow until you approve the work. If ' + fn + ' doesn’t deliver, you can open a dispute.</p><div class="modal-actions"><button type="button" class="btn btn-primary full" data-act="hire-ok" data-id="' + p.id + '">Deposit ' + naira(total) + ' and hire</button></div>'));
  }
  function noteModal(form, title, sub, label, placeholder, btn) {
    openModal(modalHead(title, sub) + '<form id="' + form + '" novalidate>' + field('nt-note', label, '<textarea id="nt-note" rows="5" maxlength="2000" placeholder="' + placeholder + '"></textarea>') + '<div class="modal-actions"><button type="submit" class="btn btn-primary full">' + btn + '</button></div></form>');
  }
  function modalRate() {
    var t = S.data.thread;
    openModal(modalHead('Leave a review for ' + esc(first(t.fre.name)), 'Reviews help other clients hire with confidence.') +
      '<form id="f-rate" novalidate><div class="rate" role="radiogroup" aria-label="Rating">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="' + (n === 5) + '" aria-label="' + n + (n > 1 ? ' stars' : ' star') + '" data-act="star" data-v="' + n + '" class="on">' + ic('star', 'is') + '</button>'; }).join('') + '</div>' +
      field('rt-note', 'Review (optional)', '<textarea id="rt-note" rows="3" maxlength="1000" placeholder="What was it like working with ' + esc(first(t.fre.name)) + '?"></textarea>') +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Post review</button></div></form>');
  }
  function modalHelp() {
    var f = S.me.fee || {}, r = role();
    var steps = r === 'fre' ? kv('1. A client hires you', 'They deposit your price into escrow') + kv('2. You deliver', 'Files or links in the chat') + kv('3. The client approves', 'You are paid, minus the ' + f.fre_fee_pct + '% PadiHire fee')
      : r === 'cli' ? kv('1. You hire a freelancer', 'Deposit their price plus a ' + f.client_fee_pct + '% service fee') + kv('2. They deliver', 'Files or links in the chat') + kv('3. You approve', 'Their price is released to them')
      : kv('1. The client hires', 'The price goes into escrow') + kv('2. The freelancer delivers', 'Files or links in the chat') + kv('3. The client approves', 'The freelancer is paid');
    openModal(modalHead('How payment works') + '<dl class="kv">' + steps + '</dl>' +
      '<p class="small" style="margin-top:12px">If the client doesn’t respond within 5 days of delivery, payment is released automatically. Either side can open a dispute, and the money stays in escrow until PadiHire reviews the chat and decides.' + (r ? '' : ' Fees are shown before you commit to anything.') + '</p><div class="modal-actions"><button type="button" class="btn btn-primary full" data-act="close">Got it</button></div>');
  }
  function modalInvite(proId) {
    api('GET', 'myjobs').then(function (d) {
      var open = d.jobs.filter(function (j) { return j.status === 'open'; });
      if (!open.length) { toast('Post a job first, then invite freelancers to it.'); return go('post'); }
      openModal(modalHead('Invite to a job', 'They’ll get a message with a link to your job.') + '<form id="f-invite" data-id="' + proId + '" novalidate>' + field('iv-job', 'Job', '<select id="iv-job">' + open.map(function (j) { return '<option value="' + j.id + '">' + esc(j.title) + '</option>'; }).join('') + '</select>') + '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Send invite</button></div></form>');
    }, function (e) { toast(e.message); });
  }

  /* ---------- events ---------- */
  function contractId(el) { return el.getAttribute('data-id'); }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) { var a = e.target.closest('a[data-saved]'); if (a) S.wtab = 'saved'; return; }
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id'), v = el.getAttribute('data-v');
    switch (act) {
      case 'close': closeModal(); break;
      case 'back': back(); break;
      case 'reload': router(true); break;
      case 'help': modalHelp(); break;
      case 'tab':
        S[el.getAttribute('data-tab')] = v; S.picked = S.picked || {}; S.picked[el.getAttribute('data-tab')] = 1;
        if (el.getAttribute('data-tab') === 'wtab' || el.getAttribute('data-tab') === 'xmode') router(true); else rerender();
        if (['howtab', 'pricetab'].indexOf(el.getAttribute('data-tab')) >= 0) { var tb = $('.utabs [aria-selected="true"]'); if (tb) tb.focus(); }
        break;
      case 'join': closeModal(); S.join = { step: v ? 2 : 1, role: v || null }; go('join'); break;
      case 'pick-role': S.join.role = v; rerender(); break;
      case 'join-next': if (S.join.role) { S.join.step = 2; rerender(); window.scrollTo(0, 0); } break;
      case 'join-back': S.join.step = 1; rerender(); break;
      case 'save':
        if (!U()) { gate('fre', 'Sign up to save jobs', 'Create a free freelancer account to save jobs and send proposals.'); break; }
        api('POST', 'saved/' + id).then(function (r) {
          $$('[data-act="save"][data-id="' + id + '"]').forEach(function (b) { b.classList.toggle('on', r.saved); b.setAttribute('aria-pressed', String(r.saved)); if (b.classList.contains('save-inline')) b.innerHTML = ic('heart') + (r.saved ? 'Saved' : 'Save job'); });
          if (S.view === 'job') S.data.job.saved = r.saved;
          toast(r.saved ? 'Job saved' : 'Removed from saved');
        }, function (er) { toast(er.message); });
        break;
      case 'apply':
        if (!U()) { gate('fre', 'Sign up to apply', 'Create a free freelancer account to send proposals and get paid through escrow.'); break; }
        if (!U().cat) { toast('Set up your freelancer profile first.'); go('edit-profile'); break; }
        modalApply(S.data.job); break;
      case 'report': if (!U()) { gate('fre', 'Log in to report', 'You need an account to report a job.'); break; } modalReport(S.data.job); break;
      case 'tog': var k = el.getAttribute('data-k'); S.q[k] = S.q[k] ? '' : '1'; el.setAttribute('aria-pressed', String(!!S.q[k])); reloadResults(); break;
      case 'clear': S.q = blankQ(); go('jobs'); break;
      case 'pcat': S.pcat = v; location.hash = '#/freelancers?cat=' + v + (S.pq ? '&q=' + encodeURIComponent(S.pq) : ''); break;
      case 'menu': openDrawer(); break;
      case 'share':
        var shu = el.getAttribute('data-url'), sht = el.getAttribute('data-title') || 'PadiHire';
        if (navigator.share) navigator.share({ title: sht, url: shu }).then(null, function (er) { if (!er || er.name !== 'AbortError') copyText(shu, 'Link copied. Paste it anywhere to share.'); });
        else copyText(shu, 'Link copied. Paste it anywhere to share.');
        break;
      case 'print': window.print(); break;
      case 'photo-del':
        api('POST', 'me/photo', { file_id: 0 }).then(function () { return loadMe(); }).then(function () { photoDone('Photo removed'); }, function (er) { toast(er.message); });
        break;
      case 'menu-close': closeDrawer(); break;
      case 'verify-resend':
        api('POST', 'me/verify').then(function (r) { if (r.already) { loadMe().then(function () { router(true); }); toast('Your email is already confirmed'); } else toast('Sent. Check your inbox and spam folder.'); }, function (er) { toast(er.message); });
        break;
      case 'alerts':
        api('POST', 'me/alerts', { on: !U().email_alerts }).then(function (r) { return loadMe().then(function () { rerender(); toast(r.on ? 'Email alerts are on' : 'Email alerts are off. You’ll still get payment emails.'); }); }, function (er) { toast(er.message); });
        break;
      case 'port-add':
        if (!S.me.uploads) { toast('Uploads aren’t switched on yet.'); break; }
        S.portFile = null;
        openModal(modalHead('Add work to your portfolio', 'A picture of something you made: a flyer, logo, screenshot of a website, or a still from a video.') + '<form id="f-port" novalidate>' +
          '<div class="field"><span class="flabel">Picture</span><label class="port-pick" id="pt-pick"><input type="file" id="up-port" accept="image/png,image/jpeg,image/webp,image/gif">' + ic('plus') + '<span>Choose a picture (up to 5 MB)</span></label><p class="err" id="pt-file-err" hidden></p></div>' +
          field('pt-title', 'Title', '<input id="pt-title" type="text" maxlength="60" placeholder="e.g. Menu flyer for a restaurant">') +
          field('pt-link', 'Link (optional)', '<input id="pt-link" type="text" inputmode="url" autocapitalize="off" placeholder="https://www.behance.net/...">', 'Behance, Dribbble, Google Drive or your website') +
          '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Add to portfolio</button></div></form>');
        break;
      case 'port-del':
        api('POST', 'me/portfolio/' + id + '/delete').then(function (r) { S.port = r.items; var g = $('#pf-port'); if (g) g.innerHTML = portGrid(S.port, true); toast('Removed from your portfolio'); }, function (er) { toast(er.message); });
        break;
      case 'switch':
        api('POST', 'me/role', { role: v }).then(loadMe).then(function () {
          toast(v === 'cli' ? 'Switched to hiring' : 'Switched to freelancing');
          if (needsSetup()) go('setup'); else if (S.view === 'job') router(true); else go(home());
        }, function (er) { toast(er.message); });
        break;
      case 'signout': api('POST', 'auth/logout').then(function () { S.me = { user: S.me.user && null, support_whatsapp: S.me.support_whatsapp }; S.wtab = 'best'; S.ctab = 'open'; go('explore'); toast('Logged out'); }); break;
      case 'invite': modalInvite(id); break;
      case 'msg-pro':
        api('POST', 'threads', { job_id: S.data.job.id, fre_id: +id }).then(function (r) { go('chat/' + r.id); }, function (er) { toast(er.message); }); break;
      case 'hire': modalHire(S.data.proposals.filter(function (p) { return String(p.id) === id; })[0]); break;
      case 'hire-ok':
        busy(el, true);
        api('POST', 'hire', { proposal_id: +id }).then(function (r) {
          loadMe();
          openModal(doneBox('Hired', 'The money is held in escrow, and they can start now. It’s released only when you approve the work.', '<a class="btn btn-primary" href="#/chat/' + r.thread_id + '">Go to contract</a>'));
        }, function (er) {
          busy(el, false);
          if (er.status === 402 && er.data.need) modalTopup(er.data.need, er.message); else toast(er.message);
        });
        break;
      case 'close-job':
        if (!confirmStep(el, 'Tap again to close this job')) break;
        api('POST', 'myjobs/' + id + '/close').then(function () { toast('Job closed'); router(true); }, function (er) { toast(er.message); }); break;
      case 'topup': modalTopup(+(el.getAttribute('data-need') || 0)); break;
      case 'show-bank': api('GET', 'wallet').then(function (d) { modalTransfer({ amount: +el.getAttribute('data-amt'), ref: el.getAttribute('data-ref'), bank: d.company_bank }); }); break;
      case 'sent': closeModal(); if (S.view === 'wallet') router(true); else go('wallet'); toast('Thanks. We’ll add it to your wallet once we see it.'); break;
      case 'withdraw': modalWithdraw(); break;
      case 'bank': modalBank(); break;
      case 'copy':
        var text = el.getAttribute('data-copy');
        try { navigator.clipboard.writeText(text).then(function () { el.innerHTML = ic('tick') + 'Copied'; }, function () { toast(text); }); } catch (er) { toast(text); }
        break;
      case 'deliver': noteModal('f-deliver', 'Mark as delivered', 'Add a short note and a link to your files (Google Drive, Dropbox, WeTransfer).', 'Delivery note', 'e.g. All 7 designs are here: https://drive.google.com/...', 'Mark as delivered'); break;
      case 'changes': noteModal('f-changes', 'Request changes', 'Say clearly what needs to change. The contract goes back to in progress.', 'What needs to change', 'e.g. Please make the logo bigger and use our red.', 'Send request'); break;
      case 'dispute': noteModal('f-dispute', 'Open a dispute', 'Only do this if you can’t sort it out in the chat. The money stays in escrow until PadiHire decides.', 'What went wrong', 'Explain the problem in a few sentences.', 'Open dispute'); break;
      case 'approve':
        var k = S.data.thread.contract;
        openModal(modalHead('Release ' + naira(k.amount) + ' to ' + esc(first(S.data.thread.fre.name)) + '?', 'Only approve when you’re happy with the work. This can’t be undone.') + '<div class="done-btns"><button type="button" class="btn btn-primary" data-act="approve-ok" data-id="' + k.id + '">Approve and release payment</button><button type="button" class="btn btn-ghost" data-act="close">Not yet</button></div>');
        break;
      case 'approve-ok':
        busy(el, true);
        api('POST', 'contracts/' + id + '/approve').then(function () { closeModal(); router(true); setTimeout(function () { if (S.data && S.data.thread) modalRate(); }, 400); }, function (er) { busy(el, false); toast(er.message); });
        break;
      case 'rate': modalRate(); break;
      case 'sp-add':
        var pk = S.picks[el.getAttribute('data-pick')];
        if (pk && pk.list.length < pk.max && pk.list.map(function (x) { return x.toLowerCase(); }).indexOf(v.toLowerCase()) < 0) pk.list.push(v);
        var inpA = $('#sp-' + el.getAttribute('data-pick') + '-in'); if (inpA) inpA.value = '';
        spRefresh(el.getAttribute('data-pick')); break;
      case 'sp-del':
        var pk2 = S.picks[el.getAttribute('data-pick')]; pk2.list = pk2.list.filter(function (x) { return x !== v; });
        spRefresh(el.getAttribute('data-pick')); break;
      case 'att-del':
        S.att[el.getAttribute('data-k')].splice(+el.getAttribute('data-i'), 1); attRefresh(el.getAttribute('data-k')); break;
      case 'cv-del': S.cv = null; $('#cv-box').outerHTML = cvBlock(); break;
      case 'star':
        var n = +v;
        $$('#modal-body .rate button').forEach(function (b) { var kk = +b.getAttribute('data-v'); b.classList.toggle('on', kk <= n); b.setAttribute('aria-checked', String(kk === n)); });
        break;
    }
  });
  function confirmStep(el, msg) {
    if (el.dataset.armed) return true;
    el.dataset.armed = '1'; var old = el.innerHTML; el.innerHTML = msg;
    setTimeout(function () { delete el.dataset.armed; el.innerHTML = old; }, 3000);
    return false;
  }

  document.addEventListener('submit', function (e) {
    var f = e.target; e.preventDefault();
    var id = f.id, btn = $('button[type=submit]', f);
    function run(p, ok, prefix, fallback) { clearErrs(f); busy(btn, true); return p.then(function (r) { busy(btn, false); ok(r); }, function (er) { busy(btn, false); showErrs(prefix || '', er, f, fallback); }); }
    if (id === 'x-search') {
      var txt = $('#x-search-in').value.trim();
      if (S.view === 'explore' && S.xmode === 'pros') location.hash = '#/freelancers?q=' + encodeURIComponent(txt);
      else location.hash = '#/jobs?q=' + encodeURIComponent(txt);
    } else if (id === 's-form') {
      S.q.q = $('#s-form-in').value.trim(); $('#s-form-in').blur(); reloadResults();
    } else if (id === 'pro-search') {
      location.hash = '#/freelancers?q=' + encodeURIComponent($('#pro-search-in').value.trim()) + (S.pcat ? '&cat=' + S.pcat : '');
    } else if (id === 'f-login') {
      var login = $('#lg-login').value.trim(), pw = $('#lg-pass').value;
      if (!login) { fieldErr('lg-login', 'Enter your email or phone number.'); return; }
      run(api('POST', 'auth/login', { login: login, password: pw }), function () { loadMe().then(function () { var n = S.next; S.next = ''; if (n && n !== '#/login') location.hash = n; else go(home()); toast('Welcome back, ' + first(U().name)); }); }, '', 'lg-pass');
    } else if (id === 'f-join') {
      var stop = false;
      if (!$('#jn-terms').checked) { fieldErr('jn-terms', 'Tick the box to confirm you’re 18 or older and agree to the terms.'); stop = true; } else fieldErr('jn-terms', '');
      if ($('#jn-human') && !S.tsToken) { fieldErr('jn-human', 'Complete the check to show you’re human.'); stop = true; }
      if (stop) return;
      run(api('POST', 'auth/signup', { role: S.join.role, first_name: $('#jn-first_name').value, last_name: $('#jn-last_name').value, email: $('#jn-email').value, password: $('#jn-password').value, state: $('#jn-state').value, adult: true, cf_token: S.tsToken || '' }),
        function () { loadMe().then(function () { S.join = { step: 1, role: null }; var n = S.next; S.next = (n && n !== '#/login' && n !== '#/join') ? n : ''; if (needsSetup()) go('setup'); else if (S.next) { location.hash = S.next; S.next = ''; } else go(home()); toast('Welcome to PadiHire, ' + first(U().name)); }); }, 'jn-')
        .then(function () { if (!U() && window.turnstile && S.tsWidget != null && $('#jn-human')) { try { window.turnstile.reset(S.tsWidget); } catch (e) { /* ignore */ } S.tsToken = ''; } });
    } else if (id === 'f-forgot') {
      var fl = $('#fg-login').value.trim();
      if (!fl) { fieldErr('fg-login', 'Enter your email or phone number.'); return; }
      run(api('POST', 'auth/forgot', { login: fl }), function () { S.forgotSent = fl; rerender(); }, 'fg-', 'fg-login');
    } else if (id === 'f-reset') {
      run(api('POST', 'auth/reset', { token: f.getAttribute('data-token'), password: $('#rs-password').value }), function () { loadMe().then(function () { go(home()); toast('Password changed. You’re logged in.'); }); }, 'rs-', 'rs-password');
    } else if (id === 'f-port') {
      if (S.portFile && S.portFile.busy) { toast('Wait for the picture to finish uploading.'); return; }
      if (!S.portFile) { fieldErr('pt-file', 'Add a picture of your work.'); return; }
      run(api('POST', 'me/portfolio', { file_id: S.portFile.id, title: $('#pt-title').value, link: $('#pt-link').value.trim() }), function (r) { S.port = r.items; S.portFile = null; closeModal(); var g = $('#pf-port'); if (g) g.innerHTML = portGrid(S.port, true); toast('Added to your portfolio'); }, 'pt-');
    } else if (id === 'f-apply') {
      if (S.att.apply.some(function (x) { return x.busy; })) { toast('Wait for your files to finish uploading.'); return; }
      run(api('POST', 'jobs/' + f.getAttribute('data-id') + '/apply', { price: parseNum($('#ap-price').value), days: parseNum($('#ap-days').value), note: $('#ap-note').value, files: S.att.apply.map(function (x) { return x.id; }) }), function (r) {
        S.data.job.applied = true; S.att.apply = []; rerender();
        openModal(doneBox('Proposal submitted', (r.masked ? MASK_NOTE + ' ' : '') + 'The client can now see your bid. You\u2019ll get a message when they reply. ' + r.left + ' proposals left this month.', '<a class="btn btn-primary" href="#/proposals">View proposals</a><button type="button" class="btn btn-ghost" data-act="close">Keep browsing</button>'));
      }, 'ap-', 'ap-note');
    } else if (id === 'f-topup') {
      var amt = parseNum($('#tp-amount').value);
      if (amt < 500) { fieldErr('tp-amount', 'Enter at least ₦500.'); return; }
      run(api('POST', 'topups', { amount: amt }), function (r) { modalTransfer(r); }, 'tp-', 'tp-amount');
    } else if (id === 'f-withdraw') {
      run(api('POST', 'withdrawals', { amount: parseNum($('#wd-amount').value) }), function () { closeModal(); loadMe().then(function () { router(true); }); toast('Withdrawal requested'); }, 'wd-', 'wd-amount');
    } else if (id === 'f-bank') {
      run(api('POST', 'me/bank', { bank_name: $('#bk-bank_name').value, bank_acct: $('#bk-bank_acct').value, bank_holder: $('#bk-bank_holder').value }), function () { closeModal(); toast('Bank account saved'); refresh(); }, 'bk-');
    } else if (id === 'f-report') {
      var reason = ($('input[name=reason]:checked', f) || {}).value;
      run(api('POST', 'jobs/' + f.getAttribute('data-id') + '/report', { reason: reason }), function () { openModal(doneBox('Report sent', 'Thank you. Our team reviews every report.')); });
    } else if (id === 'f-msg') {
      var m = $('#m-text'), text = m.value.trim();
      if (S.att.msg.some(function (x) { return x.busy; })) { toast('Wait for your files to finish uploading.'); return; }
      var fids = S.att.msg.map(function (x) { return x.id; });
      if (!text && !fids.length) return;
      busy(btn, true);
      api('POST', 'threads/' + S.arg + '/messages', { body: text, files: fids }).then(function (r) {
        busy(btn, false); m.value = ''; m.style.height = ''; S.att.msg = []; attRefresh('msg');
        if (r.masked) toast(MASK_NOTE);
        api('GET', 'threads/' + S.arg + '?after=' + S.lastMsg).then(function (d) {
          var b = $('#bubbles'), none = $('#no-msgs'); if (none) none.remove();
          d.messages.forEach(function (mm) { if (!$('[data-mid="' + mm.id + '"]')) b.insertAdjacentHTML('beforeend', bubble(mm).replace('<p class="bub', '<p data-mid="' + mm.id + '" class="bub')); });
          if (d.messages.length) { S.lastMsg = d.messages[d.messages.length - 1].id; b.lastElementChild.scrollIntoView({ block: 'nearest' }); }
        });
        m.focus();
      }, function (er) { busy(btn, false); toast(er.message); });
    } else if (id === 'f-post') {
      var edId = f.getAttribute('data-edit'), pjBody = { title: $('#pj-title').value, cat: $('#pj-cat').value, level: $('#pj-level').value, budget: parseNum($('#pj-budget').value), days: parseNum($('#pj-days').value) || 3, city: $('#pj-city').value, skills: S.picks.pj.list, descr: $('#pj-descr').value };
      if (edId) { run(api('POST', 'myjobs/' + edId + '/edit', pjBody), function (r) { S.mtab = 'post'; go('myjob/' + edId); toast(r.masked ? MASK_NOTE : 'Job updated'); }, 'pj-'); return; }
      run(api('POST', 'jobs', pjBody),
        function (r) { S.mtab = 'props'; S.ctab = 'open'; loadMe(); go('myjob/' + r.id); toast(r.masked ? MASK_NOTE : 'Job posted. Freelancers can now send proposals.'); }, 'pj-');
    } else if (id === 'f-profile') {
      var fr = role() === 'fre';
      if (S.cv && S.cv.busy) { toast('Wait for your CV to finish uploading.'); return; }
      var body = { name: $('#pf-name').value, city: $('#pf-city').value, title: fr ? $('#pf-title').value : U().title, cat: fr ? $('#pf-cat').value : U().cat, skills: fr ? S.picks.pf.list : U().skills, about: fr ? $('#pf-about').value : U().about, rate_from: fr ? parseNum($('#pf-rate').value) : U().rate_from, business: fr ? U().business : $('#pf-business').value, phone: $('#pf-phone').value.trim() };
      if ($('#pf-username')) body.username = $('#pf-username').value.trim().toLowerCase();
      if (fr && S.cv !== undefined) body.cv_file = S.cv ? S.cv.id : 0;
      run(api('POST', 'me/profile', body),
        function (r) { S.cv = undefined; loadMe().then(function () { var wasSetup = S.view === 'setup', n = S.next; S.next = ''; toast(r.masked ? MASK_NOTE : wasSetup ? 'You\u2019re all set' : 'Profile saved'); if (wasSetup && n && n !== '#/setup') location.hash = n; else go(wasSetup ? home() : fr ? 'work' : 'account'); }); }, 'pf-');
    } else if (id === 'f-pass') {
      run(api('POST', 'me/password', { current: $('#pw-current').value, password: $('#pw-password').value }), function () { f.reset(); toast('Password changed'); }, 'pw-');
    } else if (id === 'f-deliver' || id === 'f-changes' || id === 'f-dispute') {
      var k = S.data.thread.contract, path = { 'f-deliver': 'deliver', 'f-changes': 'changes', 'f-dispute': 'dispute' }[id];
      var note = $('#nt-note').value.trim();
      if (note.length < (id === 'f-dispute' ? 10 : 5)) { fieldErr('nt-note', id === 'f-dispute' ? 'Explain the problem in a sentence or two.' : 'Add a short note.'); return; }
      run(api('POST', 'contracts/' + k.id + '/' + path, id === 'f-dispute' ? { reason: note } : { note: note }), function (r) {
        closeModal(); toast(r.masked ? MASK_NOTE : id === 'f-deliver' ? 'Marked as delivered' : id === 'f-changes' ? 'Changes requested' : 'Dispute opened. PadiHire will review it.'); router(true);
      }, '', 'nt-note');
    } else if (id === 'f-rate') {
      var on = $$('#modal-body .rate button.on').length;
      run(api('POST', 'contracts/' + S.data.thread.contract.id + '/review', { stars: on, note: $('#rt-note').value }), function () { openModal(doneBox('Review posted', 'Thanks. Your review now shows on their profile.')); router(true); });
    } else if (id === 'f-invite') {
      run(api('POST', 'threads', { job_id: +$('#iv-job').value, fre_id: +f.getAttribute('data-id'), invite: true }), function (r) { closeModal(); toast('Invite sent'); go('chat/' + r.id); });
    }
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'ap-price') { var f = el.form, pct = +(f.getAttribute('data-pct') || 0), n = parseNum(el.value), h = $('#ap-price-hint'); if (h) h.textContent = 'After the ' + pct + '% fee, you receive ' + naira(n - Math.round(n * pct / 100)); }
    if (el.id === 'm-text') { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
    if (el.classList && el.classList.contains('sp-input')) { var key = el.getAttribute('data-pick'); $('#sp-' + key + '-sugs').innerHTML = spSugs(key, el.value); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[type=file][data-up]')) { handleFiles(el); return; }
    if (el.id === 'up-cvfill' && el.files && el.files[0]) { readCv(el.files[0]); return; }
    if (el.id === 'up-photo' && el.files && el.files[0]) { setPhoto(el.files[0]); return; }
    if (el.id === 'up-port' && el.files && el.files[0]) {
      var file = el.files[0], pick = $('#pt-pick');
      if (file.size > 5 * 1048576) { fieldErr('pt-file', 'That picture is too big. The limit is 5 MB.'); return; }
      fieldErr('pt-file', ''); S.portFile = { busy: true };
      if (pick) pick.innerHTML = '<span>Uploading ' + esc(file.name) + '…</span>';
      upload(file, 'portfolio').then(function (r) {
        S.portFile = r; var pk = $('#pt-pick');
        if (pk) pk.outerHTML = '<div class="port-chosen"><img src="/api/files/' + r.id + '" alt=""><span>' + esc(r.name) + '</span><button type="button" class="link-btn" data-act="port-add">Change</button></div>';
      }, function (er) { S.portFile = null; var pk = $('#pt-pick'); if (pk) pk.innerHTML = '<input type="file" id="up-port" accept="image/png,image/jpeg,image/webp,image/gif">' + ic('plus') + '<span>Choose a picture (up to 5 MB)</span>'; fieldErr('pt-file', er.message); });
      return;
    }
    if (el.id === 'pf-cat' && S.picks.pf) { S.picks.pf.cat = el.value; spRefresh('pf'); }
    if (el.id === 'pj-cat' && S.picks.pj) { S.picks.pj.cat = el.value; spRefresh('pj'); }
    if (el.hasAttribute && el.hasAttribute('data-q')) { S.q[el.getAttribute('data-q')] = el.value; reloadResults(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('sp-input')) {
      e.preventDefault(); var key = e.target.getAttribute('data-pick'), first1 = $('#sp-' + key + '-sugs button'); if (first1) first1.click(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'm-text' && window.matchMedia('(min-width: 901px)').matches) { e.preventDefault(); var f = $('#f-msg'); if (f) f.requestSubmit(); }
  });
  var LIVE_VIEWS = ['dash', 'myjob', 'messages', 'wallet', 'work', 'proposals', 'contracts'];
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !U()) return;
    loadMe();
    if (LIVE_VIEWS.indexOf(S.view) >= 0 && $('#modal').hidden && !document.querySelector('form textarea:focus, form input:focus')) router(true);
  });

  /* ---------- boot ---------- */
  if (window.__ROUTE && !location.hash) history.replaceState(null, '', '/#/' + window.__ROUTE);
  setupModal();
  footer();
  api('GET', 'me').then(function (m) { S.me = m; }, function () { S.me = { user: null }; }).then(function () {
    router();
    S.mePoll = setInterval(function () { if (!document.hidden && U()) loadMe(); }, 30000);
  });
})();
