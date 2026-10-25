/* Fere admin panel. Needs common.js first. Only works for emails listed in ADMIN_EMAILS. */
(function () {
  'use strict';
  var A = { tab: 'overview', sub: 'pending', data: null, q: '' };
  var TABS = [['overview', 'Overview'], ['topups', 'Top-ups'], ['withdrawals', 'Withdrawals'], ['disputes', 'Disputes'], ['flags', 'Flags'], ['reports', 'Reports'], ['users', 'Users'], ['settings', 'Settings']];

  function chrome(counts) {
    $('#top').innerHTML = '<div class="wrap top-in">' + brandHtml('/#/', 'Fere home') + '<span class="adm-tag">Admin</span><div class="top-right"><a class="login" href="/#/">Back to site</a></div></div>';
    $('#atabs').innerHTML = '<div class="wrap"><div class="utabs" role="tablist">' + TABS.map(function (t) {
      var n = counts && counts[t[0]];
      return '<button type="button" role="tab" aria-selected="' + (A.tab === t[0]) + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + (n ? ' <span class="count">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div></div>';
  }
  var counts = {};
  function loadCounts() {
    return api('GET', 'admin/summary').then(function (s) {
      counts = { topups: s.pending_topups.n, withdrawals: s.pending_withdrawals.n, disputes: s.disputes, reports: s.reports, flags: s.flags };
      chrome(counts); return s;
    });
  }
  function subTabs(list) { return '<div class="chip-row" role="group">' + list.map(function (s) { return '<button type="button" data-act="sub" data-v="' + s + '" aria-pressed="' + (A.sub === s) + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>'; }).join('') + '</div>'; }
  function empty(t) { return '<div class="empty"><h2>' + t + '</h2></div>'; }
  function who(r) { return '<p class="who-line">' + face(r.name, 'av-sm') + '<span><strong>' + esc(r.name) + '</strong>' + (r.business ? ' · ' + esc(r.business) : '') + '<br><span class="small">' + esc(r.email || '') + (r.phone ? ' · ' + esc(r.phone) : '') + '</span></span></p>'; }

  var VIEWS = {
    overview: function () {
      return loadCounts().then(function (s) {
        var m = s.money, ok = m.difference === 0;
        return '<h1 class="pg-title">Overview</h1>' +
          '<div class="adm-stats">' + [['Waiting top-ups', s.pending_topups.n, naira(s.pending_topups.s), 'topups'], ['Waiting withdrawals', s.pending_withdrawals.n, naira(s.pending_withdrawals.s), 'withdrawals'], ['Disputes', s.disputes, '', 'disputes'], ['Flagged messages', s.flags, '', 'flags']].map(function (x) {
            return '<button type="button" class="adm-stat" data-act="tab" data-v="' + x[3] + '"><span class="small">' + x[0] + '</span><b>' + x[1] + '</b>' + (x[2] ? '<span class="small">' + x[2] + '</span>' : '') + '</button>';
          }).join('') + '</div>' +
          '<section class="d-block"><h2 class="sub">Money check</h2><dl class="kv">' + kv('Confirmed top-ups', naira(m.confirmed_topups)) + kv('Paid out to banks', '−' + naira(m.paid_withdrawals)) + kv('Should be in your bank account', naira(m.bank_should_hold), true) + '</dl>' +
          '<p class="small" style="margin:14px 0 6px">Where that money belongs</p><dl class="kv">' + kv('Users’ wallet balances', naira(m.wallets)) + kv('Held in escrow (' + s.live_contracts.n + ' live contracts)', naira(m.escrow)) + kv('Withdrawals waiting to be paid', naira(m.pending_withdrawals)) + kv('Fere fees earned', naira(m.fees)) + '</dl>' +
          '<p class="' + (ok ? 'ok-t' : 'act-t') + '" style="margin-top:12px">' + (ok ? ic('tick') + 'Balanced' : 'Off by ' + naira(m.difference) + '. Check recent top-ups and withdrawals.') + '</p>' +
          '<p class="small" style="margin-top:6px">Fees: ' + naira(m.client_fees) + ' from clients, ' + naira(m.fre_fees) + ' from freelancers.</p></section>' +
          '<section class="d-block"><dl class="kv">' + kv('Users', s.users) + kv('Freelancer profiles', s.freelancers) + kv('Open jobs', s.open_jobs) + '</dl></section>';
      });
    },
    topups: function () {
      return api('GET', 'admin/topups?status=' + A.sub).then(function (d) {
        A.data = d.topups;
        return '<h1 class="pg-title">Top-ups</h1><p class="pg-sub">Check your bank app for each transfer and its reference, then confirm it. The client’s wallet is credited straight away.</p>' + subTabs(['pending', 'confirmed', 'rejected']) +
          (d.topups.length ? '<div class="rows">' + d.topups.map(function (t) {
            return '<article class="jrow adm-row"><p class="adm-amt">' + naira(t.amount) + '<span class="adm-ref">' + esc(t.ref) + '</span></p>' + who(t) + '<p class="small">' + timeText(t.created_at) + (t.note ? ' · ' + esc(t.note) : '') + '</p>' +
              (t.status === 'pending' ? '<div class="prop-btns"><button type="button" class="btn btn-primary" data-act="tp-confirm" data-id="' + t.id + '">Confirm</button><button type="button" class="btn btn-ghost" data-act="tp-reject" data-id="' + t.id + '">Not received</button></div>' : '') + '</article>';
          }).join('') + '</div>' : empty('Nothing here'));
      });
    },
    withdrawals: function () {
      return api('GET', 'admin/withdrawals?status=' + A.sub).then(function (d) {
        A.data = d.withdrawals;
        return '<h1 class="pg-title">Withdrawals</h1><p class="pg-sub">Send the money from your bank app first, then mark it as paid. The amount was already taken from the user’s wallet.</p>' + subTabs(['pending', 'paid', 'rejected']) +
          (d.withdrawals.length ? '<div class="rows">' + d.withdrawals.map(function (w) {
            return '<article class="jrow adm-row"><p class="adm-amt">' + naira(w.amount) + '</p>' + who(w) +
              '<dl class="kv box">' + kv('Bank', esc(w.bank_name)) + kv('Account', esc(w.bank_acct) + ' <button type="button" class="copy" data-act="copy" data-copy="' + esc(w.bank_acct) + '">' + ic('copy') + 'Copy</button>') + kv('Name', esc(w.bank_holder)) + '</dl>' +
              '<p class="small" style="margin-top:6px">' + timeText(w.created_at) + (w.note ? ' · ' + esc(w.note) : '') + '</p>' +
              (w.status === 'pending' ? '<div class="prop-btns"><button type="button" class="btn btn-primary" data-act="wd-paid" data-id="' + w.id + '">Mark as paid</button><button type="button" class="btn btn-ghost" data-act="wd-reject" data-id="' + w.id + '">Return to wallet</button></div>' : '') + '</article>';
          }).join('') + '</div>' : empty('Nothing here'));
      });
    },
    disputes: function () {
      return api('GET', 'admin/disputes').then(function (d) {
        A.data = d.disputes;
        return '<h1 class="pg-title">Disputes</h1><p class="pg-sub">Read the chat, then release the money to the freelancer or refund the client.</p>' +
          (d.disputes.length ? '<div class="rows">' + d.disputes.map(function (k) {
            return '<article class="jrow adm-row"><h3 class="jr-title">' + esc(k.title) + '</h3><p class="adm-amt">' + naira(k.amount) + '<span class="small"> in escrow · client fee ' + naira(k.client_fee) + '</span></p>' +
              '<dl class="kv">' + kv('Client', esc(k.business || k.client_name) + ' · ' + esc(k.client_phone)) + kv('Freelancer', esc(k.fre_name) + ' · ' + esc(k.fre_phone)) + kv('Opened by', esc(k.dispute_name || '')) + '</dl>' +
              '<p class="prop-note">“' + esc(k.dispute_reason) + '”</p>' +
              '<div class="prop-btns wrap-btns"><button type="button" class="btn btn-ghost" data-act="chat" data-id="' + k.thread_id + '">Read chat</button><button type="button" class="btn btn-primary" data-act="release" data-id="' + k.id + '">Pay freelancer</button><button type="button" class="btn btn-ghost" data-act="refund" data-id="' + k.id + '">Refund client</button></div></article>';
          }).join('') + '</div>' : empty('No disputes'));
      });
    },
    flags: function () {
      return api('GET', 'admin/flags?status=' + (A.sub === 'reviewed' ? 'reviewed' : 'open')).then(function (d) {
        A.data = d.flags;
        var where = { message: 'Chat message', proposal: 'Proposal', job: 'Job post', profile: 'Profile' };
        return '<h1 class="pg-title">Flags</h1><p class="pg-sub">Attempts to share contact details or deal outside Fere. The other person saw **** instead. The original text is shown here only.</p>' + subTabs(['pending', 'reviewed']) +
          (d.flags.length ? '<div class="rows">' + d.flags.map(function (g) {
            return '<article class="jrow adm-row">' + who(g) + '<p class="small">' + esc(where[g.context] || g.context) + ' \u00B7 ' + timeText(g.created_at) + ' \u00B7 ' + g.total + (g.total === 1 ? ' flag' : ' flags') + ' in total' + (g.user_status !== 'active' ? ' \u00B7 <strong class="act-t">Suspended</strong>' : '') + '</p>' +
              '<p class="prop-note">\u201C' + esc(g.original) + '\u201D</p><p class="small">Found: ' + esc(g.reasons) + '</p>' +
              '<div class="prop-btns wrap-btns">' + (g.context === 'message' ? '<button type="button" class="btn btn-ghost btn-sm" data-act="chat" data-id="' + g.ref_id + '">Read chat</button>' : '') +
              (g.context === 'job' || g.context === 'proposal' ? '<a class="btn btn-ghost btn-sm" href="/#/job/' + g.ref_id + '" target="_blank">Open job</a>' : '') +
              (g.status === 'open' ? '<button type="button" class="btn btn-ghost btn-sm" data-act="flag-ok" data-id="' + g.id + '">Mark reviewed</button>' : '') +
              (g.user_status === 'active' ? '<button type="button" class="btn btn-ghost btn-sm" data-act="suspend" data-id="' + g.user_id + '">Suspend user</button>' : '') + '</div></article>';
          }).join('') + '</div>' : empty('Nothing flagged'));
      });
    },
    reports: function () {
      return api('GET', 'admin/reports').then(function (d) {
        return '<h1 class="pg-title">Reports</h1>' + (d.reports.length ? '<div class="rows">' + d.reports.map(function (r) {
          return '<article class="jrow adm-row"><h3 class="jr-title"><a class="link-btn" href="/#/job/' + r.job_id + '" target="_blank">' + esc(r.title) + '</a></h3><p class="small">Posted by ' + esc(r.business || r.client_name) + ' · job is ' + esc(r.job_status) + '</p>' +
            '<p class="prop-note">“' + esc(r.reason) + '” — ' + esc(r.reporter) + ', ' + timeText(r.created_at) + '</p>' +
            '<div class="prop-btns">' + (r.job_status === 'open' ? '<button type="button" class="btn btn-primary" data-act="rm-job" data-id="' + r.job_id + '">Remove job</button>' : '') + '<button type="button" class="btn btn-ghost" data-act="rp-close" data-id="' + r.id + '">Dismiss</button></div></article>';
        }).join('') + '</div>' : empty('No open reports'));
      });
    },
    users: function () {
      return api('GET', 'admin/users?q=' + encodeURIComponent(A.q)).then(function (d) {
        return '<h1 class="pg-title">Users</h1><form id="u-search" class="sbar" role="search">' + ic('search') + '<input id="u-q" type="search" placeholder="Name, email, phone or business" value="' + esc(A.q) + '"><button type="submit" class="btn btn-primary">Search</button></form>' +
          (d.users.length ? '<div class="rows" style="margin-top:14px">' + d.users.map(function (u) {
            return '<article class="jrow adm-row">' + who(u) + '<p class="small">' + (u.cat ? 'Freelancer (' + esc(CAT[u.cat] ? CAT[u.cat].short : u.cat) + ')' : 'Client') + ' · now ' + (u.role === 'cli' ? 'hiring' : 'freelancing') + ' · ' + esc(u.city || '') + ' · joined ' + dateText(u.created_at) + '</p>' +
              '<p class="small">Wallet ' + naira(u.avail) + (u.verified ? ' · payment verified' : '') + (u.jobs_done ? ' · ' + u.jobs_done + ' jobs done' : '') + (u.status !== 'active' ? ' · <strong class="act-t">Suspended</strong>' : '') + '</p>' +
              '<div class="prop-btns wrap-btns">' + (u.status === 'active' ? '<button type="button" class="btn btn-ghost btn-sm" data-act="suspend" data-id="' + u.id + '">Suspend</button>' : '<button type="button" class="btn btn-ghost btn-sm" data-act="unsuspend" data-id="' + u.id + '">Unsuspend</button>') +
              '<button type="button" class="btn btn-ghost btn-sm" data-act="reset" data-id="' + u.id + '">Reset password</button>' + (u.cat ? '<a class="btn btn-ghost btn-sm" href="/#/freelancer/' + u.id + '" target="_blank">Profile</a>' : '') + '</div></article>';
          }).join('') + '</div>' : empty('No users found'));
      });
    },
    settings: function () {
      return api('GET', 'admin/settings').then(function (d) {
        var s = d.settings;
        function inp(id, label, val, hint, mode) { return field('st-' + id, label, '<input id="st-' + id + '" type="text"' + (mode ? ' inputmode="' + mode + '"' : '') + ' value="' + esc(val) + '">', hint); }
        return '<h1 class="pg-title">Settings</h1><form id="f-settings" class="form narrow" novalidate>' +
          '<h2 class="sub" style="margin-top:18px">Bank account for top-ups</h2><p class="small">Clients see these details when they add money. Top-ups stay closed until the account number is filled in.</p>' +
          inp('bank_name', 'Bank', s.bank_name) + inp('bank_acct', 'Account number', s.bank_acct, '', 'numeric') + inp('bank_holder', 'Account name', s.bank_holder) +
          '<h2 class="sub" style="margin-top:28px">Fees and limits</h2><p class="small">Changes apply to new hires only. Existing contracts keep the fee they started with.</p>' +
          '<div class="field-row">' + inp('client_fee_pct', 'Client service fee (%)', s.client_fee_pct, 'Added when a client hires', 'numeric') + inp('fre_fee_pct', 'Freelancer fee (%)', s.fre_fee_pct, 'Taken from what they earn', 'numeric') + '</div>' +
          '<div class="field-row">' + inp('monthly_proposals', 'Free proposals per month', s.monthly_proposals, '', 'numeric') + inp('auto_release_days', 'Auto-release after delivery (days)', s.auto_release_days, '', 'numeric') + '</div>' +
          '<h2 class="sub" style="margin-top:28px">Contact blocking</h2>' + field('st-mask_after_hire', 'Hide contact details after a hire too', '<select id="st-mask_after_hire"><option value="1"' + (s.mask_after_hire ? ' selected' : '') + '>Yes, always hide them</option><option value="0"' + (s.mask_after_hire ? '' : ' selected') + '>No, allow them once hired</option></select>', 'Before a hire they are always hidden.') +
          '<h2 class="sub" style="margin-top:28px">Support</h2>' + inp('support_whatsapp', 'Support WhatsApp number', s.support_whatsapp, 'Shown for forgotten passwords and help', 'tel') +
          '<button type="submit" class="btn btn-primary full">Save settings</button></form>';
      });
    }
  };

  function render() {
    chrome(counts);
    var seq = ++render.seq;
    $('#app').innerHTML = '<div class="wrap scr"><p class="loading">Loading…</p></div>';
    VIEWS[A.tab]().then(function (html) { if (seq !== render.seq) return; $('#app').innerHTML = '<div class="wrap scr col">' + html + '</div>'; }, function (e) {
      if (seq !== render.seq) return;
      $('#app').innerHTML = '<div class="wrap scr col"><div class="empty"><h2>' + (e.status === 403 || e.status === 401 ? 'Admins only' : 'Couldn’t load') + '</h2><p>' + esc(e.message) + '</p>' + (e.status === 401 || e.status === 403 ? '<a class="btn btn-primary" href="/#/login">Log in</a>' : '') + '</div></div>';
    });
  }
  render.seq = 0;
  function after(p, msg) { return p.then(function (r) { closeModal(); if (msg) toast(msg); loadCounts(); render(); return r; }, function (e) { toast(e.message); }); }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id'), v = el.getAttribute('data-v');
    var row = function (list) { return (A.data || []).filter(function (x) { return String(x.id) === id; })[0]; };
    switch (act) {
      case 'close': closeModal(); break;
      case 'tab': A.tab = v; A.sub = 'pending'; render(); window.scrollTo(0, 0); break;
      case 'sub': A.sub = v; render(); break;
      case 'copy': try { navigator.clipboard.writeText(el.getAttribute('data-copy')).then(function () { el.innerHTML = ic('tick') + 'Copied'; }); } catch (er) { toast(el.getAttribute('data-copy')); } break;
      case 'tp-confirm':
        var t = row();
        openModal(modalHead('Confirm ' + naira(t.amount) + '?', 'Reference ' + esc(t.ref) + ' from ' + esc(t.name) + '. Only confirm once you see the money in your bank app.') +
          '<form id="f-tp" data-id="' + id + '" novalidate>' + field('tp-amt', 'Amount you received (₦)', '<input id="tp-amt" type="text" inputmode="numeric" value="' + num(t.amount) + '">', 'Change it if they sent a different amount') +
          '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Confirm and credit wallet</button></div></form>');
        break;
      case 'tp-reject':
        openModal(modalHead('Transfer not received?', 'The client will see this note in their wallet.') + '<form id="f-tpr" data-id="' + id + '" novalidate>' + field('tr-note', 'Note', '<input id="tr-note" type="text" value="We couldn’t find this transfer">') + '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Mark as not received</button></div></form>');
        break;
      case 'wd-paid':
        var w = row();
        openModal(modalHead('Mark ' + naira(w.amount) + ' as paid?', 'Only do this after you’ve sent the money to ' + esc(w.bank_holder) + ', ' + esc(w.bank_name) + ' ' + esc(w.bank_acct) + '.') + '<form id="f-wdp" data-id="' + id + '" novalidate>' + field('wp-note', 'Transfer reference (optional)', '<input id="wp-note" type="text">') + '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Mark as paid</button></div></form>');
        break;
      case 'wd-reject':
        openModal(modalHead('Return to wallet?', 'The amount goes back to the user’s wallet with your note.') + '<form id="f-wdr" data-id="' + id + '" novalidate>' + field('wr-note', 'Reason', '<input id="wr-note" type="text" value="The bank details didn’t match">') + '<div class="modal-actions"><button type="submit" class="btn btn-primary full">Return money</button></div></form>');
        break;
      case 'chat':
        api('GET', 'admin/threads/' + id).then(function (d) {
          openModal(modalHead('Chat') + '<div class="bubbles adm-chat">' + d.messages.map(function (m) { return '<p class="bub ' + (m.side === 'system' ? 'sys' : m.side === 'client' ? '' : 'me') + '"><strong>' + esc(m.name) + ':</strong> ' + esc(m.body) + '<small>' + timeText(m.created_at) + '</small></p>'; }).join('') + '</div>');
        }, function (er) { toast(er.message); });
        break;
      case 'release':
        var k = row();
        openModal(modalHead('Pay the freelancer?', naira(k.amount) + ' goes to ' + esc(k.fre_name) + ' (minus their fee). This closes the contract.') + '<div class="done-btns"><button type="button" class="btn btn-primary" data-act="release-ok" data-id="' + id + '">Release payment</button><button type="button" class="btn btn-ghost" data-act="close">Cancel</button></div>');
        break;
      case 'release-ok': after(api('POST', 'admin/contracts/' + id + '/release'), 'Payment released'); break;
      case 'refund':
        var k2 = row();
        openModal(modalHead('Refund the client?', naira(k2.amount) + ' goes back to ' + esc(k2.business || k2.client_name) + '’s wallet. This closes the contract.') + '<form id="f-refund" data-id="' + id + '" novalidate><label class="check"><input type="checkbox" id="rf-fee" checked><span>Also refund the ' + naira(k2.client_fee) + ' service fee</span></label><div class="modal-actions"><button type="submit" class="btn btn-primary full">Refund client</button></div></form>');
        break;
      case 'rm-job': after(api('POST', 'admin/jobs/' + id + '/remove'), 'Job removed'); break;
      case 'rp-close': after(api('POST', 'admin/reports/' + id + '/close'), 'Report dismissed'); break;
      case 'flag-ok': after(api('POST', 'admin/flags/' + id + '/dismiss'), 'Marked as reviewed'); break;
      case 'suspend': if (el.dataset.armed) { after(api('POST', 'admin/users/' + id + '/suspend'), 'User suspended'); } else { el.dataset.armed = '1'; el.textContent = 'Tap again to suspend'; } break;
      case 'unsuspend': after(api('POST', 'admin/users/' + id + '/unsuspend'), 'User unsuspended'); break;
      case 'reset':
        if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Tap again to reset'; break; }
        api('POST', 'admin/users/' + id + '/reset-password').then(function (r) {
          openModal(modalHead('New temporary password') + '<p class="adm-pass">' + esc(r.password) + '</p><p class="small">Send it to the user privately (for example on WhatsApp). They should change it under Edit profile after logging in.</p><div class="done-btns"><button type="button" class="btn btn-ghost" data-act="copy" data-copy="' + esc(r.password) + '">' + ic('copy') + 'Copy</button><button type="button" class="btn btn-primary" data-act="close">Done</button></div>');
          render();
        }, function (er) { toast(er.message); });
        break;
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, id = f.getAttribute('data-id'); e.preventDefault();
    if (f.id === 'f-tp') after(api('POST', 'admin/topups/' + id + '/confirm', { amount: parseNum($('#tp-amt').value) }), 'Wallet credited');
    else if (f.id === 'f-tpr') after(api('POST', 'admin/topups/' + id + '/reject', { note: $('#tr-note').value }), 'Marked as not received');
    else if (f.id === 'f-wdp') after(api('POST', 'admin/withdrawals/' + id + '/paid', { note: $('#wp-note').value }), 'Marked as paid');
    else if (f.id === 'f-wdr') after(api('POST', 'admin/withdrawals/' + id + '/reject', { note: $('#wr-note').value }), 'Money returned to wallet');
    else if (f.id === 'f-refund') after(api('POST', 'admin/contracts/' + id + '/refund', { fee: $('#rf-fee').checked }), 'Client refunded');
    else if (f.id === 'u-search') { A.q = $('#u-q').value.trim(); render(); }
    else if (f.id === 'f-settings') {
      var body = {};
      ['bank_name', 'bank_acct', 'bank_holder', 'client_fee_pct', 'fre_fee_pct', 'monthly_proposals', 'auto_release_days', 'mask_after_hire', 'support_whatsapp'].forEach(function (k) { body[k] = $('#st-' + k).value.trim(); });
      api('POST', 'admin/settings', body).then(function () { toast('Settings saved'); render(); }, function (er) { toast(er.message); });
    }
  });

  setupModal();
  chrome();
  api('GET', 'me').then(function (m) {
    if (!m.user) { $('#app').innerHTML = '<div class="wrap scr narrow"><div class="empty"><h2>Admins only</h2><p>Log in with your admin email first.</p><a class="btn btn-primary" href="/#/login">Log in</a></div></div>'; return; }
    if (!m.is_admin) { $('#app').innerHTML = '<div class="wrap scr narrow"><div class="empty"><h2>Admins only</h2><p>This account (' + esc(m.user.email) + ') isn’t an admin. Add its email to ADMIN_EMAILS in Cloudflare, then redeploy.</p></div></div>'; return; }
    loadCounts().then(render, render);
  }, function (e) { $('#app').innerHTML = '<div class="wrap scr"><p>' + esc(e.message) + '</p></div>'; });
})();
