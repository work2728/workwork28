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
  function home() { return !U() ? 'explore' : role() === 'cli' ? 'dash' : 'work'; }
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
    stopPoll(); if (!keep) closeModal();
    var h = parseHash(), name = h.path[0] || '', arg = h.path[1] || '';
    if (!name || !V[name]) name = home();
    var v = V[name];
    if (v.need && !U()) { S.next = location.hash; return go('login'); }
    if (v.need === 'fre' && role() !== 'fre') return go(home());
    if (v.need === 'cli' && role() !== 'cli') return go(home());
    if (v.guest && U()) return go(home());
    if (needsSetup() && name !== 'setup' && name !== 'terms') { if (S.view === 'setup' && $('#f-profile')) { toast('Finish your profile first.'); history.replaceState(null, '', '#/setup'); return; } return go('setup'); }
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
    return '<article class="frow">' + face(p.name, 'av-md') +
      '<div class="fr-main"><h3 class="fr-name"><a class="jr-link" href="#/freelancer/' + p.id + '">' + esc(p.name) + '</a></h3>' +
      '<p class="fr-title">' + esc(p.title || CAT[p.cat].label) + '</p>' +
      '<p class="fr-meta">' + (p.city ? '<span>' + ic('pin') + esc(p.city) + '</span>' : '') + stars(p.rating, p.reviews) + (p.jobs_done ? '<span>' + p.jobs_done + (p.jobs_done === 1 ? ' job' : ' jobs') + '</span>' : '') + '</p></div>' +
      (p.rate_from ? '<p class="fr-rate"><b>' + nk(p.rate_from) + '+</b><span>per job</span></p>' : '<p class="fr-rate"></p>') +
      (p.about ? '<p class="fr-about">' + esc(p.about) + '</p>' : '') + (p.skills.length ? '<ul class="chips">' + p.skills.map(li).join('') + '</ul>' : '') + '</article>';
  }
  function catOptions(any) { return '<option value="">' + (any || 'All categories') + '</option>' + CATS.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join(''); }
  function cityOptions(any, remote) { return (any ? '<option value="">' + any + '</option>' : '') + (remote ? '<option value="Remote">' + remote + '</option>' : '') + CITIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '<option>Other</option>'; }
  function promo(title, body, btn, r) { return '<div class="promo"><div><h2>' + title + '</h2><p>' + body + '</p></div><button type="button" class="btn btn-dark" data-act="join" data-v="' + r + '">' + btn + '</button></div>'; }
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
  function handleCv(file) {
    if (!file) return;
    if (file.size > 5 * 1048576) { toast('Your CV must be 5 MB or less.'); return; }
    S.cv = { name: file.name, busy: true }; $('#cv-box').outerHTML = cvBlock();
    upload(file, 'cv').then(function (r) { S.cv = r; $('#cv-box').outerHTML = cvBlock(); toast('CV uploaded. Save your profile to keep it.'); }, function (er) { S.cv = undefined; $('#cv-box').outerHTML = cvBlock(); toast(er.message); });
  }

  /* ---------- views ---------- */
  var V = {};

  V.explore = {
    load: function () { return S.xmode === 'pros' ? api('GET', 'freelancers?limit=5') : api('GET', 'jobs?limit=6'); },
    html: function (d) {
      var x = S.xmode, s = '<div class="wrap scr with-side"><div class="mcol"><h1 class="pg-title">Freelance work and talent in Nigeria</h1>' +
        utabs('xmode', [['jobs', 'Find work'], ['pros', 'Hire a freelancer']], x) +
        sbar('x-search', x === 'jobs' ? 'Search jobs' : 'Search freelancers') +
        '<div class="chip-row">' + CATS.map(function (c) { return '<a href="#/' + (x === 'jobs' ? 'jobs?cat=' : 'freelancers?cat=') + c.id + '">' + esc(c.label) + '</a>'; }).join('') + '</div>';
      if (x === 'jobs') s += secHead('Recently posted', d.jobs.length ? '<a class="see" href="#/jobs">See all jobs</a>' : '') + (d.jobs.length ? rows(d.jobs) : emptyBox('No jobs yet', 'Be the first to post a job. Posting is free, and you only pay when you hire.', '<button type="button" class="btn btn-primary" data-act="join" data-v="cli">Post a job</button>')) +
        promo('Hiring? Post a job for free', 'Posting is free. You deposit money only when you hire someone.', 'Post a job', 'cli');
      else s += secHead('Freelancers on PadiHire', d.freelancers.length ? '<a class="see" href="#/freelancers">See all</a>' : '') + (d.freelancers.length ? '<div class="rows">' + d.freelancers.map(frow).join('') + '</div>' : emptyBox('No freelancers yet', 'Create the first profile and start getting work.', '<button type="button" class="btn btn-primary" data-act="join" data-v="fre">Create a profile</button>')) +
        promo('Looking for work?', 'Create a free profile and send proposals to clients across Nigeria.', 'Create a profile', 'fre');
      return s + '</div>' + visitorSide() + '</div>';
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
      return '<div class="wrap d-wrap"><div class="d-top">' + backBtn() + '</div><div class="d-layout"><div class="d-content">' +
        '<p class="jr-time">Posted ' + ago(j.created_at) + ' · ' + esc(CAT[j.cat] ? CAT[j.cat].label : '') + '</p>' +
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
        '<section class="d-block"><h2 class="sub">About the client</h2><div class="cb-head">' + face(cl.name, 'av-md') + '<div><p class="cb-name">' + esc(cl.name) + '</p>' + (cl.person !== cl.name ? '<p class="small">' + esc(cl.person) + '</p>' : '') + '</div></div>' +
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
      return '<div class="wrap scr col">' + backBtn() + '<div class="p-head">' + face(p.name, 'av-lg') + '<div style="min-width:0"><h1 class="pg-title">' + esc(p.name) + '</h1><p class="fr-title">' + esc(p.title || CAT[p.cat].label) + '</p>' +
        '<p class="fr-meta">' + (p.city ? '<span>' + ic('pin') + esc(p.city) + '</span>' : '') + stars(p.rating, p.reviews) + '<span>' + p.jobs_done + (p.jobs_done === 1 ? ' job done' : ' jobs done') + '</span></p></div></div>' +
        (act ? '<div class="pf-act">' + act + '</div>' : '') +
        '<section class="d-block"><h2 class="sub">About</h2><p class="d-desc">' + esc(p.about || 'No bio yet.') + '</p>' + (p.skills.length ? '<ul class="chips" style="margin-top:12px">' + p.skills.map(li).join('') + '</ul>' : '') + '</section>' +
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
      var wa = S.me.support_whatsapp;
      return '<div class="wrap scr narrow"><h1 class="pg-title">Log in to PadiHire</h1><form id="f-login" class="form" novalidate>' +
        field('lg-login', 'Email or phone number', '<input id="lg-login" type="text" autocomplete="username" inputmode="email">') +
        field('lg-pass', 'Password', '<input id="lg-pass" type="password" autocomplete="current-password">') +
        '<button type="submit" class="btn btn-primary full">Log in</button></form>' +
        '<p class="center-line">Don’t have an account? <button type="button" class="link-btn" data-act="join">Sign up</button></p>' +
        '<p class="center-line small">Forgot your password? ' + (wa ? '<a class="link-btn" href="https://wa.me/' + esc(waNum(wa)) + '?text=' + encodeURIComponent('Hello PadiHire, I forgot my password. My email is: ') + '" target="_blank" rel="noopener">Message us on WhatsApp</a>' : 'Contact PadiHire support.') + '</p></div>';
    }
  };
  function waNum(n) { var s = String(n).replace(/\D/g, ''); return s.charAt(0) === '0' ? '234' + s.slice(1) : s; }
  function jopt(v, icon, title, body) { return '<button type="button" class="jopt" role="radio" aria-checked="' + (S.join.role === v) + '" data-act="pick-role" data-v="' + v + '">' + ic(icon) + '<span class="radio" aria-hidden="true"></span><strong>' + title + '</strong><span class="small">' + body + '</span></button>'; }
  V.join = {
    guest: true, title: function () { return 'Sign up'; },
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
      return '<div class="wrap scr narrow"><button type="button" class="back" data-act="join-back">' + ic('back') + 'Change account type</button><h1 class="pg-title">' + (fre ? 'Sign up to find work' : 'Sign up to hire') + '</h1><p class="pg-sub">' + (fre ? 'Freelancer account' : 'Client account') + '</p>' +
        '<form id="f-join" class="form" novalidate>' +
        field('jn-name', 'Full name', '<input id="jn-name" type="text" autocomplete="name" placeholder="e.g. Chioma Okeke">') +
        (fre ? '<div class="field-row">' + field('jn-cat', 'Type of work', '<select id="jn-cat">' + catOptions('Choose one') + '</select>') + field('jn-title', 'Your main skill', '<input id="jn-title" type="text" placeholder="e.g. Flyer and logo designer">') + '</div>'
          : field('jn-business', 'Business or brand name', '<input id="jn-business" type="text" placeholder="e.g. Chioma’s Bakery">', 'Optional. Freelancers see it on your jobs.')) +
        field('jn-phone', 'Phone number', '<input id="jn-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567">') +
        field('jn-email', 'Email', '<input id="jn-email" type="email" autocomplete="email" placeholder="you@example.com">') +
        field('jn-password', 'Password', '<input id="jn-password" type="password" autocomplete="new-password" placeholder="At least 8 characters">') +
        '<label class="check"><input type="checkbox" id="jn-terms"><span>I agree to the <a class="link-btn" href="#/terms" target="_blank">PadiHire terms</a> and will keep all payments on PadiHire.</span></label><p class="err" id="jn-terms-err" hidden></p>' +
        '<button type="submit" class="btn btn-primary full">Create my account</button></form></div>';
    }
  };

  /* freelancer */
  function profileScore(u) {
    var parts = [u.title, u.about && u.about.length >= 40, u.skills.length >= 1, u.rate_from > 0, u.cv, u.bank && u.bank.acct];
    return Math.round(parts.filter(Boolean).length / parts.length * 100);
  }
  V.work = {
    need: 'fre', title: function () { return 'Find work'; },
    load: function () {
      var u = U(), src = S.wtab === 'saved' ? api('GET', 'saved') : api('GET', 'jobs?limit=40' + (S.wtab === 'best' && u.cat ? '&cat=' + u.cat : ''));
      return Promise.all([src, api('GET', 'proposals')]).then(function (r) { return { jobs: r[0].jobs, props: r[1] }; });
    },
    html: function (d) {
      var u = U(), score = profileScore(u), note = S.wtab === 'best' ? (u.cat ? 'Jobs in ' + CAT[u.cat].label.toLowerCase() + ', newest first' : '') : S.wtab === 'recent' ? 'Newest jobs in every category' : '';
      var s = '<div class="wrap scr with-side"><div class="mcol">' + sbar('x-search', 'Search for jobs') +
        (score < 100 ? '<div class="pbanner"><div class="pb-top"><strong>Your profile is ' + score + '% complete</strong><span>' + score + '%</span></div><div class="bar"><span style="width:' + score + '%"></span></div><p class="small">Add your headline, a short bio, your skills, your starting price, your CV and your bank account. Complete profiles get hired more.</p><a class="btn btn-ghost btn-sm" href="#/edit-profile">Finish profile</a></div>' : '') +
        utabs('wtab', [['best', 'Best matches'], ['recent', 'Most recent'], ['saved', 'Saved']], S.wtab) + (note ? '<p class="tab-note">' + note + '</p>' : '');
      s += d.jobs.length ? rows(d.jobs) : S.wtab === 'saved' ? emptyBox('No saved jobs', 'Tap the heart on a job to save it for later.') : emptyBox('No jobs here yet', 'New jobs are posted every day. Check back soon, or look in other categories.', '<button type="button" class="btn btn-ghost" data-act="tab" data-tab="wtab" data-v="recent">See all jobs</button>');
      return s + '</div>' + freSide(d.props) + '</div>';
    }
  };
  function freSide(p) {
    var u = U(), w = S.me.wallet || {};
    var act = p.proposals.filter(function (x) { return x.status === 'sent'; }).length;
    return '<aside class="side" aria-label="Your account">' +
      sideBox('', '<div class="sb-me">' + face(u.name, 'av-md') + '<div style="min-width:0"><p class="cb-name">' + esc(u.name) + '</p><p class="small">' + esc(u.title || (CAT[u.cat] ? CAT[u.cat].label : 'Freelancer')) + '</p></div></div>', '<a class="link-btn" href="#/freelancer/' + u.id + '">View public profile</a>') +
      sideBox('Wallet', '<dl class="kv">' + kv('Available', naira(w.avail)) + kv('In escrow', naira(w.escrow_in)) + '</dl>', '<a class="link-btn" href="#/wallet">Go to wallet</a>') +
      sideBox('Your work', '<dl class="kv">' + kv('Active proposals', act) + kv('Proposals left this month', p.left + ' of ' + p.monthly) + kv('Active contracts', S.me.active || 0) + '</dl>', '<a class="link-btn" href="#/proposals">See proposals</a>') +
      '</aside>';
  }
  V.proposals = {
    need: 'fre', title: function () { return 'Proposals'; },
    load: function () { return api('GET', 'proposals'); },
    html: function (d) {
      var act = d.proposals.filter(function (p) { return p.status !== 'lost'; }), arch = d.proposals.filter(function (p) { return p.status === 'lost'; });
      var list = S.ptab === 'active' ? act : arch;
      return '<div class="wrap scr col"><div class="pg-head"><h1 class="pg-title">Proposals</h1><p class="small">' + d.left + ' of ' + d.monthly + ' left this month</p></div>' +
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
      return '<div class="wrap scr col"><h1 class="pg-title">Contracts</h1>' + utabs('ktab', [['active', 'Active (' + act.length + ')'], ['done', 'Completed (' + done.length + ')']], S.ktab) +
        (list.length ? '<div class="rows">' + list.map(function (k) {
          var line = k.stage === 'active' ? '<span class="fund">' + ic('shield') + naira(k.amount) + ' in escrow</span><span>Due ' + dateText(k.due_at) + '</span>'
            : k.stage === 'delivered' ? '<span>Delivered, waiting for approval</span>' : k.stage === 'disputed' ? '<span class="act-t">In dispute. PadiHire is reviewing</span>'
            : k.stage === 'paid' ? '<span class="ok-t">' + ic('tick') + naira(k.net) + ' paid to you</span>' : '<span>Refunded to the client</span>';
          return '<article class="jrow"><h3 class="jr-title"><a class="jr-link" href="#/chat/' + k.thread_id + '">' + esc(k.title) + '</a></h3><p class="who-line">' + face(k.client, 'av-sm') + esc(k.client) + '</p><p class="jr-client">' + line + '</p></article>';
        }).join('') + '</div>' : emptyBox(S.ktab === 'active' ? 'No active contracts' : 'No completed contracts', 'When a client hires you, the job and its escrow payment show here.')) + '</div>';
    }
  };

  /* client */
  V.dash = {
    need: 'cli', title: function () { return 'My jobs'; },
    load: function () { return Promise.all([api('GET', 'myjobs'), api('GET', 'wallet'), api('GET', 'freelancers?limit=3')]).then(function (r) { return { jobs: r[0].jobs, wallet: r[1], pros: r[2].freelancers }; }); },
    html: function (d) {
      var u = U(), g = { open: [], progress: [], done: [] };
      d.jobs.forEach(function (j) {
        if (j.status === 'open') g.open.push(j);
        else if (j.contract_id && (j.stage === 'active' || j.stage === 'delivered' || j.stage === 'disputed')) g.progress.push(j);
        else g.done.push(j);
      });
      var s = '<div class="wrap scr with-side"><div class="mcol"><div class="pg-head"><div><h1 class="pg-title">My jobs</h1><p class="small">' + esc(u.business || u.name) + ' · <a class="link-btn" href="#/wallet">Wallet ' + naira(d.wallet.avail) + '</a></p></div><a class="btn btn-primary btn-sm" href="#/post">' + ic('plus') + 'Post a job</a></div>';
      d.jobs.filter(function (j) { return j.stage === 'delivered'; }).forEach(function (j) { s += '<div class="flag"><p><strong>' + esc(j.fre_name) + '</strong> delivered “' + esc(j.title) + '”. Review it to release ' + naira(j.amount) + '.</p><a class="btn btn-dark btn-sm" href="#/chat/' + j.thread_id + '">Review</a></div>'; });
      d.wallet.topups.filter(function (t) { return t.status === 'pending'; }).forEach(function (t) { s += '<div class="flag"><p>We’re checking your transfer of <strong>' + naira(t.amount) + '</strong> (reference ' + esc(t.ref) + '). Your wallet updates once it’s confirmed.</p></div>'; });
      s += utabs('ctab', [['open', 'Open (' + g.open.length + ')'], ['progress', 'In progress (' + g.progress.length + ')'], ['done', 'Completed (' + g.done.length + ')']], S.ctab);
      var list = g[S.ctab];
      s += list.length ? '<div class="rows">' + list.map(cjrow).join('') + '</div>'
        : S.ctab === 'open' ? emptyBox(d.jobs.length ? 'No open jobs' : 'Post your first job', 'Posting is free. Freelancers send you proposals, and you deposit money only when you hire someone.', '<a class="btn btn-primary" href="#/post">Post a job</a>')
        : emptyBox(S.ctab === 'progress' ? 'Nothing in progress' : 'No completed jobs yet', S.ctab === 'progress' ? 'When you hire someone, the job shows here until you approve the work.' : 'Jobs you have paid for or closed show here.');
      if (d.pros.length) s += secHead('Freelancers you may like', '<a class="see" href="#/freelancers">See all</a>') + '<div class="rows">' + d.pros.map(frow).join('') + '</div>';
      return s + '</div>' + cliSide(d.wallet) + '</div>';
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
    return '<article class="jrow"><h3 class="jr-title"><a class="jr-link" href="#/chat/' + j.thread_id + '">' + esc(j.title) + '</a></h3><p class="who-line">' + face(j.fre_name, 'av-sm') + esc(j.fre_name) + '</p><p class="jr-client">' + line + '</p></article>';
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
        (open ? '<p class="small" style="margin-top:4px">You pay nothing until you hire. Then you deposit the freelancer’s price plus a ' + pct + '% service fee, and the price is held in escrow until you approve the work.</p>' : '') +
        (j.thread_id ? '<p style="margin-top:10px"><a class="btn btn-primary btn-sm" href="#/chat/' + j.thread_id + '">Go to contract</a></p>' : '');
      s += utabs('mtab', [['props', 'Proposals (' + d.proposals.length + ')'], ['post', 'Job post']], S.mtab);
      if (S.mtab === 'post') {
        s += '<section class="d-block" style="margin-top:0;border-top:0"><p class="d-desc">' + esc(j.descr) + '</p>' + (j.skills.length ? '<ul class="chips" style="margin-top:12px">' + j.skills.map(li).join('') + '</ul>' : '') + '</section>' +
          '<p class="pf-act"><a class="btn btn-ghost btn-sm" href="#/job/' + j.id + '">See it as freelancers do</a>' + (open ? '<button type="button" class="btn btn-ghost btn-sm" data-act="close-job" data-id="' + j.id + '">Close job</button>' : '') + '</p>';
      } else {
        s += d.proposals.length ? '<div class="rows">' + d.proposals.map(function (p) {
          var hired = p.status === 'hired';
          return '<article class="prop' + (hired ? ' hired' : '') + '"><div class="prop-head">' + face(p.name, 'av-md') +
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
  V.post = {
    need: 'cli', title: function () { return 'Post a job'; },
    html: function () {
      var pct = feePct().client_fee_pct || 0;
      return '<div class="wrap scr narrow"><h1 class="pg-title">Post a job</h1><p class="pg-sub">Posting is free. Freelancers send proposals with their price. When you hire, you deposit that price plus a ' + pct + '% service fee, and PadiHire holds the price in escrow until you approve the work.</p>' +
        '<form id="f-post" class="form" novalidate>' +
        field('pj-title', 'Job title', '<input id="pj-title" type="text" placeholder="e.g. Design a logo for my bakery" autocomplete="off" maxlength="120">') +
        '<div class="field-row">' + field('pj-cat', 'Category', '<select id="pj-cat">' + catOptions('Choose a category') + '</select>') + field('pj-level', 'Experience needed', '<select id="pj-level">' + LEVELS.map(function (l) { return '<option' + (l === 'Intermediate' ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>') + '</div>' +
        '<div class="field-row">' + field('pj-budget', 'Budget (₦)', '<input id="pj-budget" type="text" inputmode="numeric" placeholder="25,000">', 'Fixed price for the whole job') + field('pj-days', 'Delivery (days)', '<input id="pj-days" type="text" inputmode="numeric" placeholder="3">') + '</div>' +
        field('pj-city', 'Location', '<select id="pj-city"><option value="Remote">Remote (anywhere in Nigeria)</option>' + cityOptions() + '</select>') +
        '<div class="field"><span class="flabel">Skills needed (up to 5)</span>' + skillPicker('pj', 5, [], '') + '</div>' +
        field('pj-descr', 'Describe the job', '<textarea id="pj-descr" rows="6" maxlength="4000" placeholder="What do you need, what will you send the freelancer, and what should they deliver?"></textarea>') +
        '<button type="submit" class="btn btn-primary full">Post job</button></form></div>';
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
          return '<a class="mrow' + (t.unread ? ' unread' : '') + '" href="#/chat/' + t.id + '">' + face(t.other) + '<span class="m-main"><span class="m-name">' + esc(t.other) + '</span><span class="m-job">' + esc(t.job) + '</span><span class="m-last">' + (t.mine ? 'You: ' : '') + esc(t.last_text || 'No messages yet') + '</span></span>' +
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
        '<div class="th-head">' + face(name) + '<div style="min-width:0"><p class="th-name">' + (cliR ? '<a class="name-link" href="#/freelancer/' + who.id + '">' + esc(name) + '</a>' : esc(name)) + '</p><p class="small"><a class="link-btn" href="#/' + (cliR ? 'myjob/' : 'job/') + t.job_id + '">' + esc(t.job) + '</a></p></div></div>' +
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
        return '<li><span class="tx-d">' + dateText(a.created_at) + '</span><span class="tx-l">' + esc(a.label) + '</span>' + amt + '</li>';
      }).join('') + '</ul>' : emptyBox('No transactions yet', cliR ? 'Top-ups, escrow deposits and refunds show here.' : 'Payments from clients and withdrawals show here.'));
      return s + '</div>';
    }
  };
  function mitem(icon, title, sub, attrs) { return '<li><' + (attrs.indexOf('href=') === 0 ? 'a ' : 'button type="button" ') + attrs + '>' + ic(icon) + '<span><strong>' + title + '</strong>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + ic('next') + '</' + (attrs.indexOf('href=') === 0 ? 'a' : 'button') + '></li>'; }
  V.account = {
    need: 'any', title: function () { return 'Account'; },
    html: function () {
      var u = U(), cliR = role() === 'cli', w = S.me.wallet || {};
      var line = cliR ? (u.business || 'Client') + (u.city ? ' · ' + u.city : '') : (u.title || 'Freelancer') + (u.city ? ' · ' + u.city : '');
      return '<div class="wrap scr col"><div class="p-head">' + face(u.name, 'av-lg') + '<div style="min-width:0"><h1 class="pg-title">' + esc(u.name) + '</h1><p class="small">' + esc(line) + '</p>' + (!cliR && u.reviews ? '<p class="stars">' + ic('star', 'is') + '<b>' + u.rating.toFixed(1) + '</b> · ' + u.jobs_done + ' jobs done</p>' : '') + '</div></div>' +
        '<ul class="mlist">' + mitem('wallet', 'Wallet', naira(w.avail) + ' available', 'href="#/wallet"') +
        mitem('pen', 'Edit profile', cliR ? 'Name, business, city, password' : 'Headline, bio, skills, price, password', 'href="#/edit-profile"') +
        (cliR ? mitem('plus', 'Post a job', '', 'href="#/post"') : mitem('eye', 'View public profile', '', 'href="#/freelancer/' + u.id + '"') + mitem('heart', 'Saved jobs', '', 'href="#/work" data-saved="1"')) +
        mitem('bank', 'Bank account', u.bank.acct ? esc(u.bank.name) + ' •••• ' + esc(u.bank.acct.slice(-4)) : 'Not added yet', 'data-act="bank"') +
        mitem(cliR ? 'laptop' : 'briefcase', cliR ? 'Switch to freelancing' : 'Switch to hiring', cliR ? 'Find work with the same account' : 'Post jobs with the same account', 'data-act="switch" data-v="' + (cliR ? 'fre' : 'cli') + '"') +
        mitem('help', 'How payment works', '', 'data-act="help"') + mitem('doc', 'Terms and rules', '', 'href="#/terms"') +
        (S.me.support_whatsapp ? mitem('whatsapp', 'Contact support', 'WhatsApp', 'href="https://wa.me/' + esc(waNum(S.me.support_whatsapp)) + '" target="_blank" rel="noopener"') : '') +
        (S.me.is_admin ? mitem('gear', 'Admin panel', 'Top-ups, withdrawals, disputes', 'href="/admin"') : '') +
        mitem('logout', 'Log out', '', 'data-act="signout"') + '</ul></div>';
    }
  };
  function profileHtml(setup) {
      var u = U(), fre = role() === 'fre';
      S.cv = undefined;
      return '<div class="wrap scr narrow">' + (setup ? '<p class="step-note">Last step</p>' : backBtn()) + '<h1 class="pg-title">' + (setup ? (fre ? 'Set up your profile' : 'Finish your profile') : 'Edit profile') + '</h1>' +
        (setup ? '<p class="pg-sub">' + (fre ? 'Clients see this when you apply. Fill it in to start using PadiHire. Pick up to 3 skills and add your CV so you stand out.' : 'Tell freelancers where you are. This takes a few seconds.') + '</p>' : '') +
        '<form id="f-profile" class="form" novalidate data-setup="' + (setup ? 1 : 0) + '">' +
        field('pf-name', 'Full name', '<input id="pf-name" type="text" value="' + esc(u.name) + '" autocomplete="name">') +
        field('pf-city', 'City', '<select id="pf-city">' + cityOptions('Choose your city') + '</select>') +
        (fre ? field('pf-title', 'Headline', '<input id="pf-title" type="text" maxlength="80" value="' + esc(u.title) + '" placeholder="e.g. Brand and social media designer">', 'Shown under your name') +
          field('pf-cat', 'Category', '<select id="pf-cat">' + catOptions('Choose one') + '</select>') +
          '<div class="field" id="pf-skills"><span class="flabel">Your skills (up to 3)</span>' + skillPicker('pf', 3, u.skills, u.cat) + '<p class="err" id="pf-skills-err" hidden></p></div>' +
          field('pf-about', 'About you', '<textarea id="pf-about" rows="5" maxlength="1200" placeholder="What you do, who you have worked for, and how fast you deliver.">' + esc(u.about) + '</textarea>', 'At least a sentence or two') +
          '<div class="field"><span class="flabel">CV <span class="opt">(optional)</span></span>' + cvBlock() + '</div>' +
          field('pf-rate', 'Jobs from (₦) <span class="opt">(optional)</span>', '<input id="pf-rate" type="text" inputmode="numeric" value="' + (u.rate_from ? num(u.rate_from) : '') + '" placeholder="15,000">', 'Your usual starting price')
          : field('pf-business', 'Business or brand name', '<input id="pf-business" type="text" value="' + esc(u.business) + '">', 'Optional')) +
        '<button type="submit" class="btn btn-primary full">' + (setup ? (fre ? 'Save and find work' : 'Save and continue') : 'Save profile') + '</button></form>' +
        (setup ? '<p class="center-line small">Not you? <button type="button" class="link-btn" data-act="signout">Log out</button></p>' :
        '<h2 class="sub" style="margin-top:34px">Change password</h2><form id="f-pass" class="form" novalidate>' +
        field('pw-current', 'Current password', '<input id="pw-current" type="password" autocomplete="current-password">') +
        field('pw-password', 'New password', '<input id="pw-password" type="password" autocomplete="new-password" placeholder="At least 8 characters">') +
        '<button type="submit" class="btn btn-ghost full">Change password</button></form>') + '</div>';
  }
  function profileAfter() { var u = U(); var c = $('#pf-city'); if (c) c.value = u.city || ''; var k = $('#pf-cat'); if (k) k.value = u.cat || ''; }
  V['edit-profile'] = { need: 'any', title: function () { return 'Edit profile'; }, html: function () { return profileHtml(false); }, after: profileAfter };
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

  /* ---------- chrome ---------- */
  var NAV = {
    visitor: [['explore', 'Home', 'home'], ['jobs', 'Jobs', 'search'], ['freelancers', 'Freelancers', 'users'], ['login', 'Log in', 'user']],
    fre: [['work', 'Find work', 'search'], ['proposals', 'Proposals', 'doc'], ['contracts', 'Contracts', 'briefcase'], ['messages', 'Messages', 'chat'], ['wallet', 'Wallet', 'wallet']],
    cli: [['dash', 'My jobs', 'briefcase'], ['freelancers', 'Talent', 'users'], ['post', 'Post a job', 'plus'], ['messages', 'Messages', 'chat'], ['wallet', 'Wallet', 'wallet']]
  };
  function navKey(v) {
    if (v === 'job') return role() === 'fre' ? 'work' : role() === 'cli' ? 'dash' : 'jobs';
    if (v === 'chat') return 'messages';
    if (v === 'freelancer') return 'freelancers';
    if (v === 'myjob') return 'dash';
    if (v === 'join') return 'login';
    if (v === 'edit-profile' || v === 'terms' || v === 'setup') return 'account';
    return v;
  }
  function chrome() {
    var key = navKey(S.view), items = NAV[role() || 'visitor'], u = U();
    function badge(id) { var n = id === 'messages' ? S.me.unread : id === 'dash' ? S.me.waiting : 0; return n ? '<span class="count">' + n + '</span>' : ''; }
    var right = !u ? '<a class="login" href="#/login">Log in</a><button type="button" class="btn btn-primary btn-sm" data-act="join">Sign up</button>'
      : '<a class="me-btn" href="#/account" aria-label="Your account"' + (S.view === 'account' ? ' aria-current="page"' : '') + '>' + face(u.name) + '</a>';
    $('#top').innerHTML = '<div class="wrap top-in">' + brandHtml('#/', 'PadiHire home') +
      '<nav class="nav" aria-label="Main">' + items.filter(function (it) { return it[0] !== 'login'; }).map(function (it) { return '<a href="#/' + it[0] + '"' + (it[0] === key ? ' aria-current="page"' : '') + '>' + it[1] + badge(it[0]) + '</a>'; }).join('') + '</nav>' +
      '<div class="top-right">' + right + '</div></div>';
    var tabs = $('#tabs'); tabs.style.setProperty('--n', items.length);
    tabs.innerHTML = items.map(function (it) { return '<a href="#/' + it[0] + '"' + (it[0] === key ? ' aria-current="page"' : '') + '>' + ic(it[2]) + it[1] + badge(it[0]) + '</a>'; }).join('');
  }
  function footer() {
    $('#foot').innerHTML = '<div class="wrap foot"><p>© ' + new Date().getFullYear() + ' PadiHire · Freelance work and talent in Nigeria</p><p class="foot-links"><a class="link-btn" href="#/terms">Terms</a><button type="button" class="link-btn" data-act="help">How payment works</button></p></div>';
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
        S[el.getAttribute('data-tab')] = v;
        if (el.getAttribute('data-tab') === 'wtab' || el.getAttribute('data-tab') === 'xmode') router(true); else rerender();
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
      if (!$('#jn-terms').checked) { fieldErr('jn-terms', 'Tick the box to agree to the terms.'); return; }
      fieldErr('jn-terms', '');
      var fre = S.join.role === 'fre';
      run(api('POST', 'auth/signup', { role: S.join.role, name: $('#jn-name').value, email: $('#jn-email').value, phone: $('#jn-phone').value, password: $('#jn-password').value, cat: fre ? $('#jn-cat').value : '', title: fre ? $('#jn-title').value : '', business: fre ? '' : $('#jn-business').value }),
        function () { loadMe().then(function () { S.join = { step: 1, role: null }; var n = S.next; S.next = (n && n !== '#/login' && n !== '#/join') ? n : ''; go('setup'); toast('Welcome to PadiHire, ' + first(U().name)); }); }, 'jn-');
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
      run(api('POST', 'jobs', { title: $('#pj-title').value, cat: $('#pj-cat').value, level: $('#pj-level').value, budget: parseNum($('#pj-budget').value), days: parseNum($('#pj-days').value) || 3, city: $('#pj-city').value, skills: S.picks.pj.list, descr: $('#pj-descr').value }),
        function (r) { S.mtab = 'props'; S.ctab = 'open'; loadMe(); go('myjob/' + r.id); toast(r.masked ? MASK_NOTE : 'Job posted. Freelancers can now send proposals.'); }, 'pj-');
    } else if (id === 'f-profile') {
      var fr = role() === 'fre';
      if (S.cv && S.cv.busy) { toast('Wait for your CV to finish uploading.'); return; }
      var body = { name: $('#pf-name').value, city: $('#pf-city').value, title: fr ? $('#pf-title').value : U().title, cat: fr ? $('#pf-cat').value : U().cat, skills: fr ? S.picks.pf.list : U().skills, about: fr ? $('#pf-about').value : U().about, rate_from: fr ? parseNum($('#pf-rate').value) : U().rate_from, business: fr ? U().business : $('#pf-business').value };
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
  setupModal();
  footer();
  api('GET', 'me').then(function (m) { S.me = m; }, function () { S.me = { user: null }; }).then(function () {
    router();
    S.mePoll = setInterval(function () { if (!document.hidden && U()) loadMe(); }, 30000);
  });
})();
