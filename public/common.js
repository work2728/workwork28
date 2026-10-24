/* PadiHire shared helpers for the app and the admin panel. */
'use strict';
var CATS = [
  { id: 'design', label: 'Graphics & design', short: 'Design' },
  { id: 'writing', label: 'Writing & translation', short: 'Writing' },
  { id: 'web', label: 'Web & app development', short: 'Web dev' },
  { id: 'video', label: 'Video & animation', short: 'Video' },
  { id: 'social', label: 'Social media & marketing', short: 'Social media' },
  { id: 'admin', label: 'Admin & data entry', short: 'Admin' }
];
var CAT = {}; CATS.forEach(function (c) { CAT[c.id] = c; });
var CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Enugu', 'Kano', 'Benin City', 'Kaduna', 'Uyo', 'Owerri', 'Abeokuta', 'Jos', 'Ilorin', 'Warri'];
var BUDGETS = [
  { id: 'u20', label: 'Under ₦20k' }, { id: '20-50', label: '₦20k – ₦50k' },
  { id: '50-150', label: '₦50k – ₦150k' }, { id: '150p', label: 'Above ₦150k' }
];
var LEVELS = ['Entry', 'Intermediate', 'Expert'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function num(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function naira(n) { return (n < 0 ? '−' : '') + '₦' + num(Math.abs(n || 0)); }
function nk(n) { return n >= 1000 ? '₦' + (n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, '') + 'k' : naira(n); }
function parseNum(v) { var n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; }
function first(name) { return String(name || '').split(' ')[0]; }
function initials(name) { var p = String(name || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function nowSec() { return Math.floor(Date.now() / 1000); }
function ago(ts) {
  var s = nowSec() - ts;
  if (s < 60) return 'just now';
  if (s < 3600) { var m = Math.floor(s / 60); return m + (m === 1 ? ' minute ago' : ' minutes ago'); }
  if (s < 86400) { var h = Math.floor(s / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
  var d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : dateText(ts);
}
function dateText(ts) { var d = new Date(ts * 1000); return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); }
function timeText(ts) {
  var d = new Date(ts * 1000), h = d.getHours(), m = d.getMinutes();
  var t = (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM');
  return new Date().toDateString() === d.toDateString() ? t : t + ' | ' + dateText(ts);
}
function daysText(n) { return n === 1 ? '1 day' : n + ' days'; }
function band(n) { return n < 5 ? 'Less than 5' : n < 10 ? '5 to 10' : n < 15 ? '10 to 15' : n < 20 ? '15 to 20' : n < 50 ? '20 to 50' : '50+'; }

var ICONS = {
  pin: '<path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  heart: '<path d="M12 20s-7.4-4.5-9-9.2C1.9 7.4 4 4.2 7.3 4.2c2 0 3.5 1.1 4.7 2.7 1.2-1.6 2.7-2.7 4.7-2.7 3.3 0 5.4 3.2 4.3 6.6C19.4 15.5 12 20 12 20z"/>',
  shield: '<path d="M12 3l7 2.8v5.6c0 4.3-2.9 7.9-7 9.6-4.1-1.7-7-5.3-7-9.6V5.8z"/><path d="M8.7 12.1l2.3 2.3 4.4-4.6"/>',
  chat: '<path d="M4 20l1.3-3.9A8.2 8.2 0 1 1 8.2 19z"/>',
  flag: '<path d="M5 21V4M5 4.5h11.5l-2.2 4 2.2 4H5"/>',
  back: '<path d="M14.5 5l-7 7 7 7"/>',
  next: '<path d="M9.5 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3"/>',
  star: '<path d="M12 3.6l2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.2 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  home: '<path d="M3.5 11L12 4l8.5 7M5.5 9.5V20h13V9.5"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1-3.8 3.9-5.8 7.5-5.8s6.5 2 7.5 5.8"/>',
  users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.8-3.3 3.1-5 6-5s5.2 1.7 6 5"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6.1M17.5 14.8c1.8.6 3 2.2 3.5 4.7"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.8A1.3 1.3 0 0 1 10.3 4.5h3.4A1.3 1.3 0 0 1 15 5.8v1.7M3.5 12.5h17"/>',
  level: '<path d="M5 19v-4M10 19v-8M15 19v-11M20 19V5"/>',
  pen: '<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M13.5 7l3.5 3.5"/>',
  doc: '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5"/>',
  code: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14"/>',
  video: '<rect x="3.5" y="6" width="12.5" height="12" rx="2"/><path d="M16 10.5l4.5-2.8v8.6L16 13.5"/>',
  megaphone: '<path d="M4 10v4h3l8 4.5v-13L7 10z"/><path d="M7 14l1.2 5h2.3L9.6 14.5M18.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  down: '<path d="M12 4v14M6 12.5l6 6 6-6"/>',
  send: '<path d="M21 3L10 14M21 3l-6.5 18-4.5-7-7-4.5z"/>',
  bank: '<path d="M3.5 9.5L12 4.5l8.5 5M5.5 10v7.5M9.8 10v7.5M14.2 10v7.5M18.5 10v7.5M3.5 20h17"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.7v.4M12 16.6v.2"/>',
  logout: '<path d="M14 4.5h4A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16.5L5.5 12 10 7.5M5.5 12H15"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M2.5 19h19l-1.6-4H4.1z"/>',
  wallet: '<path d="M19 7.5V6a1.5 1.5 0 0 0-1.5-1.5h-12A1.5 1.5 0 0 0 4 6v12a1.5 1.5 0 0 0 1.5 1.5h12A1.5 1.5 0 0 0 19 18v-1.5"/><path d="M20.5 9H15a3 3 0 0 0 0 6h5.5z"/>'
};
ICONS.eye = '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>';
ICONS.whatsapp = '<path d="M4 20l1.3-3.9A8.2 8.2 0 1 1 8.2 19z"/><path d="M9 8.8c0 3 2.6 6 5.8 6.2l.9-1.4-1.6-.9-.8.8c-1-.4-2.4-1.8-2.8-2.8l.8-.8-.9-1.6-1.4.9"/>';
ICONS.gear = '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/>';
function ic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[n] || '') + '</svg>'; }
var AVC = [['#d7ebf2', '#0e586f'], ['#f6e1d0', '#8a3c0b'], ['#e5ddf4', '#4a2e85'], ['#dcefd8', '#245a1b'], ['#f6dce3', '#8b2140'], ['#eee6cc', '#6a5106'], ['#dbe3f2', '#21417a'], ['#d9efe9', '#11594b']];
function face(name, cls) {
  var h = 0, s = String(name || '?');
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  var c = AVC[h % AVC.length];
  return '<span class="av ' + (cls || '') + '" style="background:' + c[0] + ';color:' + c[1] + '" aria-hidden="true">' + esc(initials(s)) + '</span>';
}

/* API */
function api(method, path, body) {
  var opts = { method: method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined || method === 'POST') { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body || {}); }
  return fetch('/api/' + path, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) { var e = new Error(d.error || 'Something went wrong. Please try again.'); e.status = r.status; e.data = d; throw e; }
      return d;
    });
  }, function () { var e = new Error('No internet connection. Check your network and try again.'); e.status = 0; e.data = {}; throw e; });
}

/* Toast */
var toastT;
function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200); }

/* Modal */
var lastFocus = null;
function openModal(html) {
  var m = $('#modal');
  if (m.hidden) lastFocus = document.activeElement;
  $('#modal-body').innerHTML = html; m.hidden = false; document.body.style.overflow = 'hidden';
  var f = $('#modal-body input:not([type=radio]):not([type=checkbox]):not([readonly]), #modal-body textarea') || $('#modal-body .btn') || $('#modal .modal-x');
  if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
}
function closeModal() {
  var m = $('#modal'); if (!m || m.hidden) return false;
  m.hidden = true; document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  return true;
}
function modalHead(title, sub) { return '<h2 id="modal-title" class="modal-title">' + title + '</h2>' + (sub ? '<p class="modal-sub">' + sub + '</p>' : ''); }
function doneBox(title, body, btns) { return '<div class="done">' + ic('tick', 'done-ic') + modalHead(title) + '<p class="modal-sub">' + body + '</p><div class="done-btns">' + (btns || '<button type="button" class="btn btn-primary" data-act="close">Done</button>') + '</div></div>'; }
function setupModal() {
  $('#modal').innerHTML = '<div class="modal-backdrop" data-act="close"></div><div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button type="button" class="modal-x" data-act="close" aria-label="Close">' + ic('close') + '</button><div id="modal-body"></div></div>';
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
}

/* Forms */
function field(id, label, input, hint) { return '<div class="field"><label for="' + id + '">' + label + '</label>' + input + (hint ? '<p class="hint" id="' + id + '-hint">' + hint + '</p>' : '') + '<p class="err" id="' + id + '-err" hidden></p></div>'; }
function fieldErr(id, msg) { var e = document.getElementById(id + '-err'), i = document.getElementById(id); if (e) { e.textContent = msg || ''; e.hidden = !msg; } if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg; }
function clearErrs(form) { $$('.err', form).forEach(function (e) { e.hidden = true; e.textContent = ''; }); $$('[aria-invalid]', form).forEach(function (i) { i.setAttribute('aria-invalid', 'false'); }); }
function showErrs(prefix, err, form, fallbackId) {
  var fields = (err.data && err.data.fields) || {}, any = false;
  Object.keys(fields).forEach(function (k) { if (document.getElementById(prefix + k)) { fieldErr(prefix + k, fields[k]); any = true; } });
  if (!any) { if (fallbackId && document.getElementById(fallbackId + '-err')) fieldErr(fallbackId, err.message); else toast(err.message); }
  var bad = form && $('[aria-invalid="true"]', form); if (bad) bad.focus();
}
function busy(btn, on, text) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = text || 'Please wait…'; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
function kv(k, v, tot) { return '<div' + (tot ? ' class="tot"' : '') + '><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
function li(s) { return '<li>' + esc(s) + '</li>'; }
