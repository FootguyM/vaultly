/* ==========================================================================
   VaultCards — marketplace client
   A static single-page app: hash router, view functions and a small state
   object persisted to localStorage under the key below.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'vaultcards.state.v1';
  var LEGACY_KEY = 'vaultly.state.v1';   /* pre-rebrand; read once, then retired */
  /* The console is reachable two ways: signed in as the administrator, or via
     the private link #/console/vt-9f2k-console.
     Note: this is a static site, so the credentials below ship in the page
     source and are readable by anyone. They gate the interface, not the data. */
  var CONSOLE_KEY = 'vt-9f2k-console';
  var ADMIN_USER = 'admin';
  var ADMIN_PASS = 'Passwort';

  /* ---------------------------------------------------------------- catalog */
  var CATALOG = [
    { id:'amazon',    name:'Amazon',           cat:'Shopping',  ink:'#87500b', max:250 },
    { id:'steam',     name:'Steam',            cat:'Gaming',    ink:'#1b2838', max:100 },
    { id:'playstore', name:'Google Play',      cat:'Apps',      ink:'#1d6b3c', max:100 },
    { id:'apple',     name:'Apple',            cat:'Apps',      ink:'#2b2c2e', max:200 },
    { id:'netflix',   name:'Netflix',          cat:'Streaming', ink:'#8c1116', max:100 },
    { id:'spotify',   name:'Spotify',          cat:'Streaming', ink:'#125a2d', max:60 },
    { id:'playstation',name:'PlayStation',     cat:'Gaming',    ink:'#123a78', max:100 },
    { id:'xbox',      name:'Xbox',             cat:'Gaming',    ink:'#155619', max:100 },
    { id:'nintendo',  name:'Nintendo eShop',   cat:'Gaming',    ink:'#8d1014', max:50 },
    { id:'visa',      name:'Prepaid Visa',     cat:'Payments',  ink:'#1a1f71', max:500 },
    { id:'mastercard',name:'Prepaid Mastercard',cat:'Payments', ink:'#8d2412', max:250 },
    { id:'paypal',    name:'PayPal Balance',   cat:'Payments',  ink:'#14356b', max:200 },
    { id:'btc',       name:'Bitcoin Voucher',  cat:'Crypto',    ink:'#8a5410', max:500 },
    { id:'eth',       name:'Ethereum Voucher', cat:'Crypto',    ink:'#3c4270', max:250 },
    { id:'usdt',      name:'USDT Voucher',     cat:'Crypto',    ink:'#125946', max:500 },
    { id:'airbnb',    name:'Airbnb',           cat:'Travel',    ink:'#8d2440', max:250 },
    { id:'uber',      name:'Uber & Uber Eats', cat:'Travel',    ink:'#22252a', max:100 },
    { id:'ikea',      name:'IKEA',             cat:'Shopping',  ink:'#0f4c82', max:200 },
    { id:'zalando',   name:'Zalando',          cat:'Shopping',  ink:'#7a3a12', max:100 },
    { id:'roblox',    name:'Roblox',           cat:'Gaming',    ink:'#8b1912', max:100 }
  ];
  var CATS = ['All','Shopping','Gaming','Streaming','Apps','Payments','Crypto','Travel'];

  /* Every brand is sold in steps of 5, from 5 up to the brand's ceiling. */
  var STEP = 5;
  var MIN_AMOUNT = 5;
  var MIN_PAYOUT = 5;
  var REVIEW_DAYS_MIN = 4;
  var REVIEW_DAYS_MAX = 5;
  function ceilingFor(b) { return b.max; }
  function quickPicks(b) {
    var top = ceilingFor(b);
    return [5, 10, 25, 50, 100, 250].filter(function (v) { return v <= top; });
  }
  function snap(v, b) {
    var top = b ? ceilingFor(b) : 100000;
    v = Math.round((Number(v) || 0) / STEP) * STEP;
    return Math.min(top, Math.max(MIN_AMOUNT, v));
  }

  var METHODS = [
    { id:'cashapp', name:'Cash App',      sub:'Instant · $Cashtag',      field:'$Cashtag',       ph:'$yourcashtag' },
    { id:'paypal',  name:'PayPal',        sub:'Instant · 2% fee',        field:'PayPal email',   ph:'you@example.com' },
    { id:'crypto',  name:'Crypto payout', sub:'USDT / BTC · ~10 min',    field:'Wallet address', ph:'0x… or bc1…' }
  ];

  /* ------------------------------------------------------------------ state */
  var DEFAULTS = {
    user: null,      /* the signed-in session */
    accounts: [],    /* registered accounts, each carrying its own ledger */
    balance: 0,      /* the active ledger — swapped in and out on sign-in */
    txns: [],
    owned: [],
    codes: [],       /* instruments issued on this device */
    spent: [],       /* codes verified by signature and already credited here */
    payouts: [],
    theme: null,
    seeded: false
  };
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) {
        raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) return clone(DEFAULTS);
        localStorage.setItem(STORE_KEY, raw);
        localStorage.removeItem(LEGACY_KEY);
      }
      var parsed = JSON.parse(raw);
      var out = clone(DEFAULTS);
      for (var k in out) if (parsed[k] !== undefined) out[k] = parsed[k];
      return out;
    } catch (e) { return clone(DEFAULTS); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------------------------------------------------------- helpers */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* Amounts are shown in the visitor's own currency, resolved from the browser
     locale. Figures are not converted — a 5 minimum is 5 in whichever currency
     the visitor sees. */
  var REGION_CURRENCY = {
    AT:'EUR', BE:'EUR', CY:'EUR', DE:'EUR', EE:'EUR', ES:'EUR', FI:'EUR', FR:'EUR',
    GR:'EUR', HR:'EUR', IE:'EUR', IT:'EUR', LT:'EUR', LU:'EUR', LV:'EUR', MT:'EUR',
    NL:'EUR', PT:'EUR', SI:'EUR', SK:'EUR',
    GB:'GBP', CH:'CHF', US:'USD', CA:'CAD', AU:'AUD', NZ:'NZD', JP:'JPY',
    PL:'PLN', CZ:'CZK', SE:'SEK', NO:'NOK', DK:'DKK', HU:'HUF', RO:'RON',
    BG:'BGN', TR:'TRY', IN:'INR', BR:'BRL', MX:'MXN', ZA:'ZAR', SG:'SGD'
  };
  var LANG_REGION = {
    de:'DE', fr:'FR', es:'ES', it:'IT', nl:'NL', pt:'PT', el:'GR', fi:'FI',
    et:'EE', lv:'LV', lt:'LT', sk:'SK', sl:'SI', hr:'HR', ga:'IE', mt:'MT',
    pl:'PL', cs:'CZ', sv:'SE', nb:'NO', no:'NO', da:'DK', hu:'HU', ro:'RO',
    bg:'BG', tr:'TR', ja:'JP', hi:'IN', en:'US'
  };

  var LOCALE = (navigator.languages && navigator.languages[0]) || navigator.language || 'en-US';

  function resolveCurrency(locale) {
    var parts = String(locale).split('-');
    var region = null;
    for (var i = 1; i < parts.length; i++) {
      if (/^[A-Za-z]{2}$/.test(parts[i])) { region = parts[i].toUpperCase(); break; }
    }
    if (!region) region = LANG_REGION[parts[0].toLowerCase()];
    return REGION_CURRENCY[region] || 'USD';
  }
  var CURRENCY = resolveCurrency(LOCALE);

  var money = function (n) {
    try {
      return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY }).format(n || 0);
    } catch (e) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
    }
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  };
  var uid = function () { return Math.random().toString(36).slice(2, 10); };

  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* no O/0/I/1 */
  var CODE_PREFIX = 'VC';
  /* Longest first: 'VLT' predates the rebrand and its codes stay redeemable. */
  var CODE_PREFIXES = ['VLT', CODE_PREFIX];
  function block(n) {
    var out = '';
    var buf = new Uint32Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    for (var i = 0; i < n; i++) {
      var r = buf[i] || Math.floor(Math.random() * 0xffffffff);
      out += ALPHABET[r % ALPHABET.length];
    }
    return out;
  }
  /* Codes carry their own value and a checksum, so a device that has never
     seen a code can still verify it. Without this, an issued code only worked
     in the browser that created it — localStorage does not travel.
     SIGNING_KEY ships in the page and is therefore not a secret: it stops
     typos and casual guesses, not a determined forger. Only a server can do
     that, and the same goes for spending a code twice on two devices. */
  var SIGNING_KEY = 'vc-issue-2f9x';

  function toBase32(n, len) {
    var s = '';
    for (var i = 0; i < len; i++) { s = ALPHABET[n % 32] + s; n = Math.floor(n / 32); }
    return s;
  }
  function fromBase32(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var v = ALPHABET.indexOf(s.charAt(i));
      if (v < 0) return -1;
      n = n * 32 + v;
    }
    return n;
  }
  function checksumFor(core) {
    var h = 2166136261, s = core + SIGNING_KEY;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return toBase32(h % 1048576, 4);          /* 32^4 */
  }
  function groupCode(prefix, body) {
    return prefix + '-' + (body.match(/.{1,4}/g) || []).join('-');
  }

  /* Codes for cards the customer bought: shown and copied, never presented
     back here, so they carry no value signature. */
  function makeCode(prefix) {
    return groupCode(prefix || CODE_PREFIX, block(12));
  }

  /* head(3) = amount in steps · random(5) · checksum(4) */
  function makeValueCode(amount) {
    var core = toBase32(Math.round(amount / STEP), 3) + block(5);
    return groupCode(CODE_PREFIX, core + checksumFor(core));
  }

  /* Returns the face value a code declares, or null if it is not one of ours. */
  function valueOf(input) {
    var raw = normalise(input);
    for (var i = 0; i < CODE_PREFIXES.length; i++) {
      var pre = CODE_PREFIXES[i];
      if (raw.indexOf(pre) !== 0) continue;
      var body = raw.slice(pre.length);
      if (body.length !== 12) continue;
      var core = body.slice(0, 8);
      if (checksumFor(core) !== body.slice(8)) continue;
      var amount = fromBase32(core.slice(0, 3)) * STEP;
      if (amount < MIN_AMOUNT || amount > 100000) continue;
      return amount;
    }
    return null;
  }
  function normalise(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function brand(id) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
    return { id: id, name: 'VaultCards credit', cat: 'Ledger', ink: '#1b3fd8', max: 500 };
  }
  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 604800) return Math.floor(s / 86400) + ' d ago';
    return new Date(ts).toLocaleDateString();
  }

  /* ------------------------------------------------------------------ icons */
  var ICON = {
    check:  '<svg viewBox="0 0 24 24"><path d="m5 13 4.5 4.5L19 7"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    bolt:   '<svg viewBox="0 0 24 24"><path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/></svg>',
    gift:   '<svg viewBox="0 0 24 24"><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"/><rect x="3" y="7" width="18" height="4" rx="1"/><path d="M12 7v14M12 7S9.5 3 7.5 4.2 9 7 12 7Zm0 0s2.5-4 4.5-2.8S15 7 12 7Z"/></svg>',
    arrowUp:'<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    arrowDn:'<svg viewBox="0 0 24 24"><path d="M12 5v14M18 13l-6 6-6-6"/></svg>',
    lock:   '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>',
    alert:  '<svg viewBox="0 0 24 24"><path d="M12 4.5 3 20h18L12 4.5Z"/><path d="M12 10v4.5M12 17.4v.1"/></svg>',
    info:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/></svg>',
    copy:   '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    globe:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3c-4 5.5-4 12.5 0 18 4-5.5 4-12.5 0-18Z"/></svg>',
    swap:   '<svg viewBox="0 0 24 24"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>',
    chat:   '<svg viewBox="0 0 24 24"><path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.5A7 7 0 0 1 8 5h5a7 7 0 0 1 7 7Z"/></svg>',
    trash:  '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    plus:   '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    eye:    '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.3 7.9A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6"/><path d="m10 10a2.8 2.8 0 0 0 4 4"/><path d="m3.5 3.5 17 17"/></svg>',
    key:    '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v3.5M20 12v2.5"/></svg>'
  };

  /* ----------------------------------------------------------------- toasts */
  function toast(text, sub, kind) {
    var host = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.innerHTML = (kind === 'err' ? ICON.alert : kind === 'info' ? ICON.info : ICON.check) +
      '<div><div class="toast-text">' + esc(text) + '</div>' +
      (sub ? '<div class="toast-sub">' + esc(sub) + '</div>' : '') + '</div>';
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 220);
    }, 3600);
  }

  /* ------------------------------------------------------------------ modal */
  /* Queued by an action that also navigates: render() clears the modal root,
     so the modal has to be opened by the render that follows, not before it. */
  var pendingModal = null;
  function queueModal(title, bodyHtml) { pendingModal = { title: title, body: bodyHtml }; }

  function openModal(title, bodyHtml) {
    closeModal();
    var root = $('#modalRoot');
    root.innerHTML =
      '<div class="overlay" data-act="overlay">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
          '<div class="modal-head"><h3>' + esc(title) + '</h3>' +
          '<button class="modal-x" data-act="close-modal" aria-label="Close">&times;</button></div>' +
          '<div class="modal-body">' + bodyHtml + '</div>' +
        '</div>' +
      '</div>';
    var focusable = root.querySelector('input, button.btn, .amt');
    if (focusable) focusable.focus();
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  function copy(text, label) {
    var done = function () { toast(label || 'Copied to clipboard'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed', 'Select the text manually', 'err'); }
      ta.remove();
    }
  }

  /* ================================================================= domain */
  function requireAuth(next) {
    if (state.user) return true;
    sessionStorage.setItem('vaultcards.next', next || location.hash || '#/wallet');
    go('#/login');
    toast('Sign in to continue', null, 'info');
    return false;
  }

  function isAdmin() { return !!(state.user && state.user.role === 'admin'); }
  function isPending() { return !!(state.user && state.user.role !== 'admin' && state.user.review === 'pending'); }
  function canBuy() { return !!state.user && !isPending(); }

  /* Not a security measure — a static site cannot keep a secret. It only keeps
     plain passwords out of localStorage. */
  function hashPass(s) {
    var h = 5381;
    for (var i = 0; i < String(s).length; i++) h = ((h * 33) ^ String(s).charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function refFor(u) { return 'VR-' + String(u.id).toUpperCase().slice(0, 6); }

  /* The signed-in member's ledger lives at the top of state; every other
     account carries its own copy. Read whichever is authoritative. */
  function ledgerOf(acc) {
    if (state.user && state.user.role !== 'admin' && state.user.email === acc.email) {
      return { balance: state.balance, txns: state.txns, owned: state.owned };
    }
    return acc.ledger || { balance: 0, txns: [], owned: [] };
  }
  function accountById(id) {
    for (var i = 0; i < state.accounts.length; i++) if (state.accounts[i].id === id) return state.accounts[i];
    return null;
  }
  function setReview(id, status) {
    var acc = accountById(id);
    if (!acc) return null;
    acc.review = status;
    if (state.user && state.user.email === acc.email) state.user.review = status;
    save();
    return acc;
  }

  function findAccount(email) {
    var want = String(email).trim().toLowerCase();
    for (var i = 0; i < state.accounts.length; i++) {
      if (state.accounts[i].email.toLowerCase() === want) return state.accounts[i];
    }
    return null;
  }

  /* Each account keeps its own balance, journal and instruments. The active one
     lives at the top of state so the rest of the app can read it directly; these
     two move it in and out on sign-in and sign-out. */
  function stashLedger() {
    if (!state.user || state.user.role === 'admin') return;
    var acc = findAccount(state.user.email);
    if (!acc) return;
    acc.ledger = { balance: state.balance, txns: state.txns, owned: state.owned };
  }
  function loadLedger(acc) {
    var l = (acc && acc.ledger) || { balance: 0, txns: [], owned: [] };
    state.balance = l.balance || 0;
    state.txns = l.txns || [];
    state.owned = l.owned || [];
  }

  function sessionFrom(acc, role) {
    var handle = acc.name || acc.email.split('@')[0];
    return {
      id: acc.id,
      email: acc.email,
      name: handle,
      initials: handle.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'VL',
      since: acc.since,
      role: role || acc.role || 'member',
      review: acc.review || 'pending'
    };
  }

  function register(email, password) {
    stashLedger();
    var acc = {
      id: uid(),
      email: email.trim(),
      name: email.split('@')[0].trim(),   /* the local part is the display name */
      pass: hashPass(password),
      since: Date.now(),
      role: 'member',
      review: 'pending',           /* every registration is reviewed by hand */
      ledger: { balance: 0, txns: [], owned: [] }
    };
    state.accounts.push(acc);
    state.user = sessionFrom(acc);
    loadLedger(acc);

    stashLedger();
    save();
    renderChrome();
    return acc;
  }

  function signIn(acc, role) {
    stashLedger();
    state.user = sessionFrom(acc, role);
    if (role === 'admin') { state.balance = 0; state.txns = []; state.owned = []; }
    else loadLedger(acc);
    save();
    renderChrome();
  }

  /* Manual review runs on working days, so the estimate skips weekends. */
  function addWorkingDays(ts, days) {
    var d = new Date(ts);
    var added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      var w = d.getDay();
      if (w !== 0 && w !== 6) added++;
    }
    return d;
  }
  function reviewWindow() {
    var from = state.user ? state.user.since : Date.now();
    var opts = { day: 'numeric', month: 'short' };
    return {
      from: addWorkingDays(from, REVIEW_DAYS_MIN).toLocaleDateString(LOCALE, opts),
      to: addWorkingDays(from, REVIEW_DAYS_MAX).toLocaleDateString(LOCALE, opts)
    };
  }

  function signOut() {
    stashLedger();
    state.user = null;
    state.balance = 0; state.txns = []; state.owned = [];
    save(); renderChrome(); go('#/shop');
    toast('Signed out', 'Your wallet data stays on this device', 'info');
  }

  function tx(dir, title, sub, amount) {
    return { id: uid(), dir: dir, title: title, sub: sub, amount: amount, ts: Date.now() };
  }

  function newCode(amount, label) {
    return { code: makeValueCode(amount), amount: amount, label: label || '', created: Date.now(), redeemed: null };
  }

  function findCode(input) {
    var want = normalise(input);
    for (var i = 0; i < state.codes.length; i++) {
      if (normalise(state.codes[i].code) === want) return state.codes[i];
    }
    return null;
  }

  function credit(code, amount) {
    state.balance += amount;
    state.txns.unshift(tx('in', 'Code presented', code, amount));
    stashLedger();
    save();
  }

  function redeem(input) {
    var typed = normalise(input);

    /* Issued on this device: the register knows it and tracks its state. */
    var entry = findCode(input);
    if (entry) {
      if (entry.redeemed) return { ok: false, msg: 'Code already redeemed', sub: 'Used ' + timeAgo(entry.redeemed) };
      entry.redeemed = Date.now();
      entry.redeemedBy = state.user ? state.user.email : 'guest';
      credit(entry.code, entry.amount);
      return { ok: true, amount: entry.amount };
    }

    /* Issued elsewhere: verify the code itself. */
    if (state.spent.indexOf(typed) > -1) {
      return { ok: false, msg: 'Code already redeemed', sub: 'This code has been used on this device' };
    }
    var amount = valueOf(typed);
    if (amount === null) return { ok: false, msg: 'That code is not valid', sub: 'Check the characters and try again' };

    state.spent.push(typed);
    credit(groupCode(typed.slice(0, CODE_PREFIX.length), typed.slice(CODE_PREFIX.length)), amount);
    return { ok: true, amount: amount };
  }

  function buy(brandId, amount) {
    if (amount > state.balance) return { ok: false };
    var b = brand(brandId);
    state.balance -= amount;
    var card = {
      id: uid(), brandId: brandId, amount: amount,
      code: makeCode(b.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'GFT'),
      ts: Date.now()
    };
    state.owned.unshift(card);
    state.txns.unshift(tx('out', b.name + ' instrument', money(amount) + ' · issued', -amount));
    save();
    return { ok: true, card: card };
  }

  /* ================================================================== views */
  /* A stable pseudo-serial per brand, so the plate does not flicker on re-render. */
  function serialFor(seed) {
    var h = 0;
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    var out = '';
    for (var j = 0; j < 8; j++) { out += ALPHABET[h % ALPHABET.length]; h = Math.floor(h / 7) + 13 * (j + 1); }
    return out.slice(0, 4) + ' ' + out.slice(4);
  }

  function cardFace(b, amount, extraClass) {
    return '<div class="gc ' + (extraClass || '') + '" style="--c-ink:' + b.ink + '">' +
      '<div class="gc-main">' +
        '<div><div class="gc-brand">' + esc(b.name) + '</div>' +
        '<div class="gc-cat">' + esc(b.cat) + '</div></div>' +
        '<div class="gc-serial">SER ' + serialFor(b.id + amount) + '</div>' +
      '</div>' +
      '<div class="gc-stub">' +
        '<div class="gc-seal">VC</div>' +
        '<div><div class="gc-denom">Value</div>' +
        '<div class="gc-amount">' + (amount ? money(amount) : '—') + '</div></div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- shop */
  var shopFilter = { q: '', cat: 'All' };

  function viewShop() {
    return '' +
    '<section class="hero"><div class="hero-grid">' +
      '<div>' +
        '<span class="eyebrow">Clearing house for stored value</span>' +
        '<h1 style="margin-top:10px">Every gift card,<br>one ledger.</h1>' +
        '<p class="lede">A gift card is money locked to one shop. VaultCards accepts any card, voucher or prepaid balance, books it into a single ledger, and lets you draw a new card on any other brand — or cash the balance out.</p>' +
        '<div class="hero-cta">' +
          (state.user
            ? '<a class="btn btn-primary btn-lg" href="#/redeem" data-link>Redeem a code</a>'
            : '<a class="btn btn-primary btn-lg" href="#/register" data-link>Open an account</a>') +
          '<a class="btn btn-ghost btn-lg" href="#/about" data-link>Read the concept</a>' +
        '</div>' +
        '<dl class="hero-trust">' +
          '<div><dt>20+</dt><dd>Brands accepted</dd></div>' +
          '<div><dt>0%</dt><dd>Card fees</dd></div>' +
          '<div><dt>&lt;1s</dt><dd>Delivery</dd></div>' +
        '</dl>' +
      '</div>' +
      '<div class="specimen">' +
        cardFace(brand('btc'), 100) +
        '<div class="specimen-cap">Any brand · from ' + money(MIN_AMOUNT) + '</div>' +
      '</div>' +
    '</div></section>' +

    '<section class="section" id="market">' +
      '<div class="section-head"><div><h2>Marketplace</h2>' +
      '<p>Drawn against your ledger balance. The code is issued and shown to you the moment you confirm.</p></div>' +
      (isPending()
        ? '<span class="pill pill-warn">' + ICON.lock + ' Locked until verified</span>'
        : '<span class="pill pill-accent">Instant issue</span>') + '</div>' +
      (isPending()
        ? '<div class="notice notice-stamp" style="margin-bottom:18px">' + ICON.lock +
          '<div><div class="notice-title">Buying opens once your account is verified</div>' +
          '<div class="notice-body">Presenting gift codes works now; drawing cards and payouts follow ' +
          'once the review of your registration clears, expected ' + reviewWindow().from +
          ' \u2013 ' + reviewWindow().to + '</div></div></div>'
        : '') +

      '<div class="toolbar">' +
        '<div class="search">' + ICON.search +
          '<input class="input" id="shopSearch" type="search" placeholder="Search brands, currencies, vouchers…" value="' + esc(shopFilter.q) + '" autocomplete="off">' +
        '</div>' +
        '<div class="chips">' + CATS.map(function (c) {
          return '<button class="chip' + (shopFilter.cat === c ? ' active' : '') + '" data-act="cat" data-cat="' + c + '">' + c + '</button>';
        }).join('') + '</div>' +
      '</div>' +

      '<div class="market" id="brandGrid">' + brandCards(true) + '</div>' +
    '</section>' +

    '<section class="section">' +
      '<div class="feature-grid">' +
        trustBlock(ICON.shield, 'Debited on issue', 'Your balance only moves once the code exists and is on screen in front of you.') +
        trustBlock(ICON.bolt, 'Issued in under a second', 'No queue, no shipping, no waiting room — the instrument is drawn immediately.') +
        trustBlock(ICON.globe, 'Twenty brands, one figure', 'Shopping, gaming, streaming, prepaid cards and crypto vouchers, all in one currency.') +
        trustBlock(ICON.chat, 'Reviewed by people', 'Verification and payouts are cleared by the support desk, never by an automated rule.') +
      '</div>' +
    '</section>';
  }

  function trustBlock(icon, title, body) {
    return '<div class="feature"><div class="feature-ico">' + icon + '</div><h3>' + esc(title) + '</h3>' +
      '<p>' + esc(body) + '</p></div>';
  }

  function brandCards(stagger) {
    var q = shopFilter.q.toLowerCase().trim();
    var list = CATALOG.filter(function (b) {
      var okCat = shopFilter.cat === 'All' || b.cat === shopFilter.cat;
      var okQ = !q || (b.name + ' ' + b.cat).toLowerCase().indexOf(q) > -1;
      return okCat && okQ;
    });
    if (!list.length) {
      return '<div class="empty" style="grid-column:1/-1;margin-top:16px">Nothing matches “' + esc(shopFilter.q) + '”.<br>' +
        '<button class="btn btn-ghost btn-sm" data-act="clear-filter" style="margin-top:12px">Clear filters</button></div>';
    }
    return list.map(function (b, i) {
      return '<button class="market-row' + (stagger ? ' row-enter' : '') + '"' +
        (stagger ? ' style="--i:' + Math.min(i, 14) + '"' : '') +
        ' data-act="open-brand" data-id="' + b.id + '">' +
        '<span class="swatch" style="--c-ink:' + b.ink + '"></span>' +
        '<span class="mr-name">' + esc(b.name) + '</span>' +
        '<span class="mr-cat">' + esc(b.cat) + '</span>' +
        '<span class="mr-range">' + money(MIN_AMOUNT) + '–' + money(ceilingFor(b)) + '</span>' +
      '</button>';
    }).join('');
  }

  var buyState = { id: null, amount: 0 };

  function brandModal(id) {
    var b = brand(id);
    buyState.id = id;
    var top = ceilingFor(b);
    var pick = snap(Math.min(25, top), b);

    openModal('Buy ' + b.name, '' +
      '<div id="buyFace" style="margin-bottom:18px">' + cardFace(b, pick) + '</div>' +
      '<div class="field" style="margin-bottom:14px"><label>Amount</label>' +
        '<div class="amount-grid" id="amtGrid">' + quickPicks(b).map(function (v) {
          return '<button class="amt" data-act="pick-amt" data-amt="' + v + '">' + money(v) + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="field" style="margin-bottom:16px">' +
        '<label for="amtInput">Or any amount in steps of ' + money(STEP) + '</label>' +
        '<div class="stepper">' +
          '<button class="step-btn" data-act="amt-step" data-dir="-1" aria-label="Less">\u2212</button>' +
          '<input id="amtInput" class="input stepper-input" type="number" inputmode="numeric" ' +
            'min="' + MIN_AMOUNT + '" max="' + top + '" step="' + STEP + '" value="' + pick + '">' +
          '<button class="step-btn" data-act="amt-step" data-dir="1" aria-label="More">+</button>' +
        '</div>' +
        '<p class="tiny muted" style="margin-top:7px">' + money(MIN_AMOUNT) + ' to ' + money(top) + '</p>' +
      '</div>' +
      '<div class="buy-balance">' +
        '<span class="caps">Ledger balance</span>' +
        '<span class="mono buy-balance-figure" id="buyBalance"></span></div>' +
      '<div id="buyWarn"></div>' +
      '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" data-act="confirm-buy">' +
        'Draw for ' + money(pick) + '</button>'
    );
    setBuyAmount(pick);
  }

  /* Single source of truth for the buy modal: snaps to the step, then repaints
     the plate, the quick picks, the field and the confirm button together. */
  function setBuyAmount(v, keepInput) {
    var b = brand(buyState.id);
    var val = snap(v, b);
    buyState.amount = val;

    var face = $('#buyFace');
    if (face) face.innerHTML = cardFace(b, val);

    $$('.amt').forEach(function (el) {
      el.classList.toggle('sel', Number(el.dataset.amt) === val);
    });

    var input = $('#amtInput');
    if (input && !keepInput) input.value = val;

    var bal = $('#buyBalance');
    if (bal) {
      bal.innerHTML = val <= state.balance
        ? money(state.balance) + ' <span class="buy-after">\u2192 ' + money(state.balance - val) + '</span>'
        : money(state.balance);
    }

    var btn = $('[data-act="confirm-buy"]');
    if (!btn) return;

    /* Purchases stay closed until the registration review clears. */
    if (!state.user) {
      btn.textContent = 'Sign in to buy';
      btn.disabled = false;
      $('#buyWarn').innerHTML = '';
      return;
    }
    if (isPending()) {
      var win = reviewWindow();
      btn.textContent = 'Locked until verified';
      btn.disabled = true;
      $('#buyWarn').innerHTML =
        '<div class="notice notice-stamp" style="margin-top:14px">' + ICON.lock +
        '<div><div class="notice-title">Purchases open once your account is verified</div>' +
        '<div class="notice-body">You can keep presenting codes in the meantime. Your registration ' +
        'is still being reviewed by hand, expected ' + win.from + ' \u2013 ' + win.to + '</div>' +
        '<a class="btn btn-sm btn-ghost" style="margin-top:12px" href="#/payout" data-link data-act="close-modal">See the file</a></div></div>';
      return;
    }

    var short = val > state.balance;
    btn.textContent = short ? 'Insufficient balance' : 'Draw for ' + money(val);
    btn.disabled = short;
    $('#buyWarn').innerHTML = short
      ? '<div class="notice notice-accent" style="margin-top:14px">' + ICON.info +
        '<div><div class="notice-title">Credit the ledger first</div><div class="notice-body">Present a code worth ' +
        money(val - state.balance) + ' or more, then draw again.</div>' +
        '<a class="btn btn-sm btn-primary" style="margin-top:12px" href="#/redeem" data-link data-act="close-modal">Redeem a code</a></div></div>'
      : '';
  }

  /* -------------------------------------------------------------- redeem */
  function viewRedeem() {
    return '<section class="section redeem-wrap">' +
      '<div style="margin-bottom:26px">' +
        '<span class="eyebrow">Redeem</span>' +
        '<h1 style="margin-top:10px">Present a code for credit</h1>' +
        '<p class="lede">Any VaultCards code, in any denomination. The value is booked to your ledger immediately and can be drawn against any brand in the marketplace.</p>' +
      '</div>' +
      '<div class="card card-pad">' +
        '<div class="field"><label for="redeemInput">Instrument number</label>' +
          '<input id="redeemInput" class="code-input" placeholder="VC-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" maxlength="18">' +
        '</div>' +
        '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" data-act="do-redeem">Book to ledger</button>' +
        '<p class="tiny muted center" style="margin-top:12px">Single use. Dashes optional.</p>' +
      '</div>' +
      '<div class="steps" style="margin-top:26px">' +
        step('01', 'Present the code', 'From an email, a receipt, or the back of a physical card.') +
        step('02', 'Credit is booked', 'Every brand resolves into one ledger balance.') +
        step('03', 'Draw against it', 'Take a card on any other brand, or file for payout.') +
      '</div>' +
    '</section>';
  }
  function step(n, t, s) {
    return '<div class="step"><div class="step-n">' + n + '</div><div><div style="font-weight:600;font-size:14px">' +
      esc(t) + '</div><div class="small muted">' + esc(s) + '</div></div></div>';
  }

  /* -------------------------------------------------------------- wallet */
  function viewWallet() {
    var spent = state.txns.reduce(function (a, t) { return a + (t.amount < 0 ? -t.amount : 0); }, 0);
    var added = state.txns.reduce(function (a, t) { return a + (t.amount > 0 ? t.amount : 0); }, 0);

    return '<section class="section">' +
      '<div class="statement">' +
        '<div class="statement-head">' +
          '<div>' +
            '<div class="caps">Available balance</div>' +
            '<div class="statement-amount">' + money(state.balance) + '</div>' +
            '<div class="statement-meta">' + esc(state.user.email) + ' · opened ' +
              new Date(state.user.since).toLocaleDateString(LOCALE) + '</div>' +
            (state.balance === 0
              ? '<div class="statement-hint">Present a gift code to credit your ledger.</div>'
              : '') +
            '<div class="wallet-actions">' +
              '<a class="btn btn-white" href="#/redeem" data-link>Add funds</a>' +
              '<a class="btn" href="#/shop" data-link>Draw a card</a>' +
              '<a class="btn" href="#/payout" data-link>Payout</a>' +
            '</div>' +
          '</div>' +
          '<span class="pill pill-stamp">' + ICON.lock + ' ' +
            (isPending() ? 'Under review' : 'Verified') + '</span>' +
        '</div>' +
        '<div class="statement-body">' +
          '<div class="stat-grid">' +
            '<div class="stat"><div class="k">Credited</div><div class="v">' + money(added) + '</div></div>' +
            '<div class="stat"><div class="k">Drawn</div><div class="v">' + money(spent) + '</div></div>' +
            '<div class="stat"><div class="k">Instruments</div><div class="v">' + state.owned.length + '</div></div>' +
            '<div class="stat"><div class="k">Payout</div><div class="v" style="color:var(--stamp)">Held</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      (isPending()
        ? '<div class="notice notice-accent" style="margin-top:18px">' + ICON.shield +
          '<div><div class="notice-title">Account under review · expected ' +
            reviewWindow().from + ' – ' + reviewWindow().to + '</div>' +
          '<div class="notice-body">Every registration is checked by a person before payouts open, ' +
          'which keeps bots and AI agents out of the ledger. Presenting gift codes works now; buying ' +
          'cards and payouts follow once it clears. <a href="#/payout" data-link class="link">See the file</a>.' +
          '</div></div></div>'
        : '') +

      '<div class="cols-2" style="margin-top:22px">' +
        '<div>' +
          '<div class="section-head"><div><h2>Instruments held</h2></div>' +
            '<span class="caps">' + state.owned.length + ' on file</span></div>' +
          (state.owned.length
            ? '<div class="owned">' + state.owned.map(ownedCard).join('') + '</div>'
            : '<div class="empty">No instruments drawn yet.<br>' +
              '<a class="btn btn-ghost btn-sm" style="margin-top:14px" href="#/shop" data-link>Open the marketplace</a></div>') +
        '</div>' +

        '<div>' +
          '<div class="section-head"><div><h2>Journal</h2></div></div>' +
          (state.txns.length
            ? '<div class="list">' + state.txns.slice(0, 12).map(txRow).join('') + '</div>'
            : '<p class="small muted">No entries yet.</p>') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function ownedCard(c) {
    var b = brand(c.brandId);
    return '<div class="owned-card">' + cardFace(b, c.amount, 'gc-sm') +
      '<div class="code-row"><span class="mono">' + esc(c.code) + '</span>' +
      '<button class="icon-btn" style="width:28px;height:28px" data-act="copy" data-text="' + esc(c.code) + '" title="Copy code">' + ICON.copy + '</button></div>' +
      '<div class="tiny muted">Drawn ' + timeAgo(c.ts) + '</div></div>';
  }

  function txRow(t) {
    var mark = t.dir === 'hold' ? '\u25CB' : t.amount > 0 ? '+' : '\u2212';
    var cls = t.dir === 'hold' ? 'hold' : t.amount > 0 ? 'in' : 'out';
    return '<div class="list-item"><div class="li-mark ' + cls + '">' + mark + '</div>' +
      '<div class="li-body"><div class="li-title">' + esc(t.title) + '</div>' +
      '<div class="li-sub">' + esc(t.sub) + ' · ' + timeAgo(t.ts) + '</div></div>' +
      '<div class="li-amt' + (t.amount > 0 ? ' pos' : '') + '">' +
      (t.amount ? (t.amount > 0 ? '+' : '\u2212') + money(Math.abs(t.amount)) : '\u2014') + '</div></div>';
  }

  /* -------------------------------------------------------------- payout */
  var payoutMethod = 'cashapp';

  function viewPayout() {
    var m = METHODS.filter(function (x) { return x.id === payoutMethod; })[0];
    var pending = state.payouts.length;

    return '<section class="section">' +
      '<div class="section-head"><div><span class="eyebrow">Payout</span>' +
        '<h1 style="margin-top:10px">Draw the balance out</h1>' +
        '<p>Settle your ledger balance to Cash App, PayPal or a crypto wallet. Funds are released once the review of your registration is complete.</p></div></div>' +

      '<div class="notice notice-stamp stamped" style="margin-bottom:22px">' + ICON.lock +
        '<div style="max-width:58ch"><div class="notice-title">Payout held — your account is still being verified</div>' +
        '<div class="notice-body"><strong>Every new registration is reviewed by hand before payouts are released, ' +
        'and that takes ' + REVIEW_DAYS_MIN + ' to ' + REVIEW_DAYS_MAX + ' working days.</strong> ' +
        'We do this because scripted bots and AI agents are the main way stored-value accounts get ' +
        'abused, and a captcha does not stop them. Until the review clears, your balance stays in ' +
        'the ledger, and you can keep presenting gift codes in the meantime.</div>' +
        '<div class="notice-body" style="margin-top:9px">Registered ' +
          new Date(state.user.since).toLocaleDateString(LOCALE) + ' · review expected ' +
          reviewWindow().from + ' – ' + reviewWindow().to + '</div></div>' +
        '<div class="stamp"><div class="stamp-line1">Under review</div>' +
        '<div class="stamp-line2">Payout withheld</div></div>' +
      '</div>' +

      '<div class="cols-2">' +
        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:14px">Settlement instruction</h3>' +
          '<div class="field" style="margin-bottom:14px"><label>Payout method</label>' +
            '<div class="method-grid">' + METHODS.map(function (x) {
              return '<button class="method' + (x.id === payoutMethod ? ' sel' : '') + '" data-act="method" data-id="' + x.id + '">' +
                '<span class="m-name">' + esc(x.name) + '</span><span class="m-sub">' + esc(x.sub) + '</span></button>';
            }).join('') + '</div>' +
          '</div>' +
          '<div class="field" style="margin-bottom:14px"><label for="poDest">' + esc(m.field) + '</label>' +
            '<input id="poDest" class="input" placeholder="' + esc(m.ph) + '" autocomplete="off"></div>' +
          '<div class="field" style="margin-bottom:6px"><label for="poAmt">Amount (max ' + money(state.balance) + ')</label>' +
            '<input id="poAmt" class="input" type="number" min="' + MIN_PAYOUT + '" step="' + STEP + '" placeholder="0.00" value="' + (state.balance ? Math.floor(state.balance) : '') + '"></div>' +
          '<p class="tiny muted">Minimum settlement ' + money(MIN_PAYOUT) + '. Clearing time depends on the method.</p>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" data-act="do-payout">' + ICON.lock + ' File payout request</button>' +
          (pending ? '<div class="notice notice-accent" style="margin-top:14px">' + ICON.info +
            '<div><div class="notice-title">' + pending + ' request' + (pending > 1 ? 's' : '') + ' held for verification</div>' +
            '<div class="notice-body">Latest: ' + money(state.payouts[0].amount) + ' via ' + esc(state.payouts[0].method) +
            ' · ticket <span class="mono">' + esc(state.payouts[0].ticket) + '</span></div></div></div>' : '') +
        '</div>' +

        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:6px">Verification file</h3>' +
          '<p class="tiny muted mono" style="margin-bottom:16px">REF ' + esc(refFor(state.user)) + '</p>' +
          '<div class="tracker">' +
            tstep('done', ICON.check, 'Registration received', new Date(state.user.since).toLocaleDateString(LOCALE)) +
            tstep('done', ICON.check, 'Email on file', esc(state.user.email)) +
            tstep('now', '!', 'Manual review', 'In progress · expected ' + reviewWindow().from + ' – ' + reviewWindow().to) +
            tstep('', '4', 'Payout released', 'Once the review clears') +
          '</div>' +
          '<div class="divider"></div>' +
          '<p class="small muted">A person reviews every file — no automated screening, which is the point. ' +
          'You will be asked for identification only once, and never by email.</p>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:14px" data-act="support">' + ICON.chat + ' Contact the desk</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function tstep(cls, mark, title, sub) {
    return '<div class="tstep"><div class="tdot ' + cls + '">' + mark + '</div>' +
      '<div><div class="tstep-title">' + title + '</div><div class="tstep-sub">' + sub + '</div></div></div>';
  }

  /* --------------------------------------------------------------- about */
  function viewAbout() {
    return '<section class="section">' +
      '<div style="max-width:70ch">' +
        '<span class="eyebrow">The concept</span>' +
        '<h1 style="margin-top:10px">A gift card is money with someone else\u2019s name on it</h1>' +
        '<p class="lede">Get one for a shop you never use and it sits in a drawer until it expires. VaultCards is a clearing house: every card, voucher and prepaid balance is accepted, booked into one ledger, and reissued as whatever you actually want.</p>' +
      '</div>' +

      '<div class="flow" style="margin-top:30px">' +
        '<div class="flow-item"><h3>Present anything</h3><p>Shopping cards, gaming credit, streaming vouchers, prepaid Visa, crypto vouchers. One field accepts them all.</p></div>' +
        '<div class="flow-item"><h3>Book to one ledger</h3><p>Every brand resolves into a single figure. No more twelve codes across twelve inboxes.</p></div>' +
        '<div class="flow-item"><h3>Draw a new card</h3><p>Take an instrument on any other brand in the marketplace; the code is issued to you on the spot.</p></div>' +
        '<div class="flow-item"><h3>Or settle out</h3><p>Send the balance to a bank, PayPal, card or crypto wallet once the support desk has verified the account.</p></div>' +
      '</div>' +

      '<div class="section">' +
        '<div class="section-head"><div><h2>Why the house is trusted</h2>' +
        '<p>Stored value comes down to two promises: the money is where you left it, and a person is reachable when it is not.</p></div></div>' +
        '<div class="feature-grid">' +
          feature(ICON.shield, 'Debited on issue', 'The ledger only moves when an instrument exists and is on screen. Nothing is taken up front.') +
          feature(ICON.lock, 'Reviewed by hand', 'Every registration is checked by a person before payouts open. Slower on purpose \u2014 it is what keeps bots and AI agents out of the ledger.') +
          feature(ICON.bolt, 'Issued on confirmation', 'Codes are drawn the second an order clears. No queue, no shipping, no waiting room.') +
          feature(ICON.swap, 'Brand agnostic', 'Twenty-plus brands across shopping, gaming, streaming, prepaid cards and crypto, all in one currency.') +
          feature(ICON.chat, 'Staffed desk', 'Verification, disputes and payouts are handled by people rather than an automated rule.') +
          feature(ICON.globe, 'Nothing to install', 'A browser is the whole requirement. Nothing to sync, nothing to keep updated.') +
        '</div>' +
      '</div>' +

      '<div>' +
        '<p class="caps" style="margin-bottom:14px">Accepted brands</p>' +
        '<div class="logo-strip">' + CATALOG.map(function (b) {
          return '<span>' + esc(b.name) + '</span>';
        }).join('') + '</div>' +
      '</div>' +

      '<div class="section">' +
        '<div class="section-head"><div><h2>Questions</h2></div></div>' +
        '<div class="faq">' +
          faq('Which cards can I present?', 'Any VaultCards code, in any denomination from ' + money(MIN_AMOUNT) + ' upwards. Shopping cards, gaming credit, streaming vouchers, prepaid Visa and Mastercard, PayPal balance and crypto vouchers all resolve into the same ledger balance.') +
          faq('How does the ledger work?', 'Presenting a code credits your balance. Drawing a card in the marketplace debits it and files the new code under instruments held, where you can copy it at any time. Every movement is written to the journal with a running figure, so the balance is always accounted for.') +
          faq('Why can’t I pay out yet?', 'Because your registration is still being reviewed. Every new account is checked by a person before payouts are released, which takes ' + REVIEW_DAYS_MIN + ' to ' + REVIEW_DAYS_MAX + ' working days. Your balance is untouched while the review is open, and presenting gift codes works normally throughout. Buying cards unlocks together with payouts.') +
          faq('Why is the review done by hand?', 'Because the alternative does not work. Scripted bots and AI agents are the main way stored-value accounts get abused at scale, and they clear captchas and automated checks routinely. A person looking at each registration is slower, and it is the part of the process that actually holds. It is a one-time check — once your account is cleared it stays cleared.') +
          faq('In which currency are amounts shown?', 'In your own. VaultCards reads the region your browser reports and formats every figure in that currency — euros in the eurozone, pounds in the UK, dollars in the US, and so on.') +
          faq('Do codes expire?', 'No. A code keeps its value until it is presented. Each one is single use: once it has been booked to a ledger it cannot be presented again, which is why the register marks it as redeemed.') +
          faq('What happens to my data?', 'Your ledger, instruments and journal are kept on the device you are using. Nothing you type on this site is transmitted to a third party or sold on.') +
        '</div>' +
      '</div>' +
    '</section>';
  }
  function feature(icon, title, body) {
    return '<div class="feature"><div class="feature-ico">' + icon + '</div><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></div>';
  }
  function faq(q, a) {
    return '<details><summary>' + esc(q) + '</summary><p>' + esc(a) + '</p></details>';
  }

  /* --------------------------------------------------- register & sign in */
  function pwField(id, label, autocomplete, placeholder) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<div class="pw">' +
        '<input id="' + id + '" class="input" type="password" autocomplete="' + autocomplete + '"' +
          (placeholder ? ' placeholder="' + placeholder + '"' : '') + '>' +
        '<button type="button" class="pw-toggle" data-act="toggle-pw" data-for="' + id + '" ' +
          'aria-label="Show password" title="Show password">' + ICON.eye + '</button>' +
      '</div></div>';
  }

  function viewRegister() {
    return '<section class="auth-wrap">' +
      '<div class="card card-pad">' +
        '<div class="auth-head">' +
          '<h2>Open an account</h2>' +
          '<p class="small muted">One ledger for every gift card you hold.</p>' +
        '</div>' +
        '<div class="field" style="margin-bottom:14px"><label for="rgEmail">Email</label>' +
          '<input id="rgEmail" class="input" type="email" placeholder="you@example.com" autocomplete="email"></div>' +
        pwField('rgPass', 'Password', 'new-password', 'At least 8 characters') +
        '<button class="btn btn-primary btn-block btn-lg" style="margin-top:18px" data-act="do-register">Open account</button>' +
        '<p class="tiny muted center" style="margin-top:14px">Already registered? ' +
          '<a href="#/login" data-link class="link">Sign in</a></p>' +
      '</div>' +
    '</section>';
  }

  function viewLogin() {
    return '<section class="auth-wrap">' +
      '<div class="card card-pad">' +
        '<div class="auth-head">' +
          '<h2>Sign in</h2>' +
          '<p class="small muted">Welcome back to your ledger.</p>' +
        '</div>' +
        '<div class="field" style="margin-bottom:14px"><label for="liEmail">Email</label>' +
          '<input id="liEmail" class="input" type="text" placeholder="you@example.com" autocomplete="username"></div>' +
        pwField('liPass', 'Password', 'current-password') +
        '<button class="btn btn-primary btn-block btn-lg" style="margin-top:18px" data-act="do-login">Continue</button>' +
        '<div class="divider"></div>' +
        '<a class="btn btn-ghost btn-block" href="#/register" data-link>Open a new account</a>' +
        '<p class="tiny muted center" style="margin-top:16px">Your session is kept on this device only.</p>' +
      '</div>' +
    '</section>';
  }

  /* ------------------------------------------------------------- console */
  function viewConsole(key) {
    if (key !== CONSOLE_KEY && !isAdmin()) {
      return '<section class="section"><div class="empty">' +
        '<h2 style="margin-bottom:10px">Administrators only</h2>' +
        '<p class="muted">Sign in with an administrator account to open the issuing console.</p>' +
        '<a class="btn btn-primary btn-sm" style="margin-top:16px" href="#/login" data-link>Sign in</a></div></section>';
    }
    var issued = state.codes.length;
    var used = state.codes.filter(function (c) { return c.redeemed; }).length;
    var outstanding = state.codes.reduce(function (a, c) { return a + (c.redeemed ? 0 : c.amount); }, 0);

    return '<section class="section">' +
      '<div class="console-bar" style="margin-bottom:24px">' +
        ICON.key + '<div><div class="wordmark">Issuing console</div>' +
        '<div class="tiny" style="opacity:.62;font-family:var(--mono);letter-spacing:.08em">RESTRICTED · ADMINISTRATORS ONLY</div></div>' +
        '<span class="pill" style="margin-left:auto">' + state.accounts.length + ' accounts</span>' +
        '<span class="pill">' + issued + ' issued</span>' +
        '<span class="pill">' + used + ' redeemed</span>' +
        '<span class="pill">' + money(outstanding) + ' outstanding</span>' +
      '</div>' +

      '<div class="cols-2">' +
        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:16px">Draw new instruments</h3>' +
          '<div class="row wrap" style="gap:12px;align-items:flex-end">' +
            '<div class="field grow" style="min-width:120px"><label for="genAmt">Denomination (' + CURRENCY + ')</label>' +
              '<input id="genAmt" class="input" type="number" min="1" step="1" value="50"></div>' +
            '<div class="field" style="width:110px"><label for="genQty">Quantity</label>' +
              '<input id="genQty" class="input" type="number" min="1" max="50" step="1" value="1"></div>' +
            '<div class="field grow" style="min-width:150px"><label for="genLabel">Batch label</label>' +
              '<input id="genLabel" class="input" placeholder="e.g. Launch giveaway"></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" data-act="generate">' + ICON.plus + ' Draw codes</button>' +
          '<div id="genOut"></div>' +
        '</div>' +

        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:8px">Console controls</h3>' +
          '<p class="small muted">Clearing removes the ledger, held instruments, journal and every issued code on this device. It cannot be undone.</p>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="copy" data-text="' + esc(location.origin + location.pathname + '#/console/' + CONSOLE_KEY) + '">' + ICON.copy + ' Copy console link</button>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--stamp)" data-act="reset">' + ICON.trash + ' Clear all data</button>' +
        '</div>' +
      '</div>' +

      '<div class="card card-pad" style="margin-top:18px">' +
        '<div class="spread" style="margin-bottom:12px"><h3>Accounts</h3>' +
          '<span class="caps">' + state.accounts.length + ' registered · ' +
            state.accounts.filter(function (x) { return x.review === 'pending'; }).length + ' awaiting review</span>' +
        '</div>' +
        (state.accounts.length
          ? '<div class="table-wrap"><table class="table"><thead><tr>' +
              '<th>Account</th><th>Opened</th><th>Status</th><th>Balance</th><th>Cards</th><th></th>' +
            '</tr></thead><tbody>' +
            state.accounts.slice().reverse().map(accountRow).join('') +
          '</tbody></table></div>'
          : '<div class="empty">No accounts registered yet.</div>') +
      '</div>' +

      '<div class="card card-pad" style="margin-top:18px">' +
        '<div class="spread" style="margin-bottom:12px"><h3>Issue register</h3>' +
          (issued ? '<button class="btn btn-ghost btn-sm" data-act="copy-all">' + ICON.copy + ' Copy unused</button>' : '') +
        '</div>' +
        (issued ? '<div class="table-wrap"><table class="table"><thead><tr>' +
            '<th>Instrument</th><th>Value</th><th>Batch</th><th>Status</th><th></th></tr></thead><tbody>' +
            state.codes.slice().reverse().map(codeRow).join('') +
          '</tbody></table></div>'
          : '<div class="empty">Nothing issued yet.</div>') +
      '</div>' +
    '</section>';
  }

  function accountRow(acc) {
    var l = ledgerOf(acc);
    var pending = acc.review === 'pending';
    return '<tr>' +
      '<td><div style="font-weight:600">' + esc(acc.name) + '</div>' +
        '<div class="mono tiny muted">' + esc(acc.email) + '</div></td>' +
      '<td class="mono">' + new Date(acc.since).toLocaleDateString(LOCALE) + '</td>' +
      '<td>' + (pending
        ? '<span class="pill pill-warn">' + ICON.lock + ' Under review</span>'
        : '<span class="pill pill-success">' + ICON.check + ' Verified</span>') + '</td>' +
      '<td class="mono">' + money(l.balance) + '</td>' +
      '<td class="mono">' + (l.owned ? l.owned.length : 0) + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        (pending
          ? '<button class="btn btn-primary btn-sm" data-act="verify-acc" data-id="' + acc.id + '">Verify</button> '
          : '<button class="btn btn-ghost btn-sm" data-act="unverify-acc" data-id="' + acc.id + '">Revoke</button> ') +
        '<button class="icon-btn" style="width:28px;height:28px;display:inline-grid;vertical-align:middle" ' +
          'data-act="del-acc" data-id="' + acc.id + '" title="Delete account">' + ICON.trash + '</button>' +
      '</td></tr>';
  }

  function codeRow(c) {
    return '<tr><td><span class="mono">' + esc(c.code) + '</span></td>' +
      '<td class="mono">' + money(c.amount) + '</td>' +
      '<td class="muted">' + (esc(c.label) || '—') + '</td>' +
      '<td>' + (c.redeemed
        ? '<span class="pill pill-success">' + ICON.check + ' Redeemed ' + timeAgo(c.redeemed) + '</span>'
        : '<span class="pill">Outstanding</span>') + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        '<button class="icon-btn" style="width:28px;height:28px;display:inline-grid" data-act="copy" data-text="' + esc(c.code) + '" title="Copy">' + ICON.copy + '</button> ' +
        (c.redeemed ? '' : '<button class="icon-btn" style="width:28px;height:28px;display:inline-grid" data-act="revoke" data-code="' + esc(c.code) + '" title="Revoke">' + ICON.trash + '</button>') +
      '</td></tr>';
  }

  /* ================================================================ router */
  function parse() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h === '/') return { name: 'shop' };
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0], arg: parts[1] };
  }

  function go(hash) {
    if (location.hash === hash) render(); else location.hash = hash;
  }

  function render() {
    var r = parse();
    var view = $('#view');
    var html;

    switch (r.name) {
      case 'redeem':  html = viewRedeem(); break;
      case 'about':   html = viewAbout(); break;
      case 'login':    html = state.user ? (go('#/wallet'), '') : viewLogin(); break;
      case 'register': html = state.user ? (go('#/wallet'), '') : viewRegister(); break;
      case 'console': html = viewConsole(r.arg); break;
      case 'wallet':  if (!requireAuth('#/wallet')) return; html = viewWallet(); break;
      case 'payout':  if (!requireAuth('#/payout')) return; html = viewPayout(); break;
      default:        html = viewShop();
    }
    if (html === '') return;

    view.innerHTML = html;
    view.classList.remove('view-enter');
    void view.offsetWidth;          /* restart the animation on every route */
    view.classList.add('view-enter');
    $$('#nav a, #tabbar a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === (r.name || 'shop'));
    });
    $('#nav').classList.remove('open');
    closeModal();
    window.scrollTo(0, 0);
    renderChrome();
    if (pendingModal) {
      var m = pendingModal; pendingModal = null;
      openModal(m.title, m.body);
    }
  }

  var lastBalanceShown = null;
  function renderChrome() {
    var pill = $('#balancePill');
    pill.hidden = !state.user;

    var figure = money(state.balance);
    var el = $('#balanceValue');
    if (lastBalanceShown !== null && lastBalanceShown !== figure && !pill.hidden) {
      pill.classList.remove('pulse');
      void pill.offsetWidth;
      pill.classList.add('pulse');
    }
    lastBalanceShown = figure;
    el.textContent = figure;
    $('#navConsole').hidden = !isAdmin();
    var note = $('#currencyNote');
    if (note) note.textContent = 'Amounts shown in ' + CURRENCY;
    $('#accountSlot').innerHTML = state.user
      ? '<button class="avatar" data-act="account" title="Account">' + esc(state.user.initials) + '</button>'
      : '<a class="btn btn-ghost btn-sm hide-sm" href="#/login" data-link>Sign in</a>' +
        '<a class="btn btn-primary btn-sm" href="#/register" data-link>Open account</a>';
  }

  /* ================================================================ actions */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-link]');
    var el = e.target.closest('[data-act]');
    if (link && !el) { $('#nav').classList.remove('open'); return; }
    if (!el) return;
    var act = el.dataset.act;

    switch (act) {
      case 'toggle-theme': {
        var cur = document.documentElement.getAttribute('data-theme');
        if (!cur) cur = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        state.theme = next; save();
        break;
      }

      case 'toggle-nav':
        $('#nav').classList.toggle('open'); break;

      case 'cat':
        shopFilter.cat = el.dataset.cat;
        $$('.chip').forEach(function (c) { c.classList.toggle('active', c.dataset.cat === shopFilter.cat); });
        $('#brandGrid').innerHTML = brandCards();
        break;

      case 'clear-filter':
        shopFilter = { q: '', cat: 'All' };
        render(); break;

      case 'open-brand':
        brandModal(el.dataset.id); break;

      case 'pick-amt':
        setBuyAmount(Number(el.dataset.amt));
        break;

      case 'amt-step':
        setBuyAmount(buyState.amount + Number(el.dataset.dir) * STEP);
        break;

      case 'confirm-buy': {
        if (!state.user) { closeModal(); requireAuth(location.hash); break; }
        if (isPending()) { toast('Purchases are locked', 'Your account is still being verified', 'err'); break; }
        var amt = buyState.amount;
        var res = buy(buyState.id, amt);
        if (!res.ok) { toast('Insufficient balance', 'Present a code to credit the ledger', 'err'); break; }
        var b = brand(buyState.id);
        openModal('Instrument issued', '' +
          '<div style="margin-bottom:16px">' + cardFace(b, amt) + '</div>' +
          '<div class="notice notice-success" style="margin-bottom:16px">' + ICON.check +
            '<div><div class="notice-title">' + esc(b.name) + ' instrument issued</div>' +
            '<div class="notice-body">Filed under instruments held. Balance now ' + money(state.balance) + '.</div></div></div>' +
          '<div class="field"><label>Instrument number</label><div class="code-row">' +
            '<span class="mono" style="font-size:14px">' + esc(res.card.code) + '</span>' +
            '<button class="icon-btn" style="width:28px;height:28px" data-act="copy" data-text="' + esc(res.card.code) + '">' + ICON.copy + '</button>' +
          '</div></div>' +
          '<a class="btn btn-primary btn-block btn-lg" style="margin-top:16px" href="#/wallet" data-link data-act="close-modal">Open the ledger</a>');
        renderChrome();
        toast('Instrument issued', b.name + ' · ' + money(amt));
        break;
      }

      case 'do-redeem': {
        var input = $('#redeemInput');
        var val = input.value.trim();
        if (!val) { input.focus(); toast('Enter a code first', null, 'err'); break; }
        var out = redeem(val);
        if (!out.ok) { toast(out.msg, out.sub, 'err'); break; }
        input.value = '';
        renderChrome();
        toast('Booked ' + money(out.amount), 'Balance ' + money(state.balance));
        openModal('Credit booked', '' +
          '<div class="notice notice-success">' + ICON.check +
          '<div><div class="notice-title">' + money(out.amount) + ' booked to your ledger</div>' +
          '<div class="notice-body">Balance now ' + money(state.balance) + '.</div></div></div>' +
          '<div class="row" style="margin-top:16px;gap:8px">' +
            '<a class="btn btn-primary grow" href="#/shop" data-link data-act="close-modal">Draw a card</a>' +
            '<a class="btn btn-ghost grow" href="#/wallet" data-link data-act="close-modal">Open the ledger</a>' +
          '</div>');
        break;
      }

      case 'do-login': {
        var ident = $('#liEmail').value.trim();
        var pass = $('#liPass').value;

        if (ident.toLowerCase() === ADMIN_USER) {
          if (pass !== ADMIN_PASS) { $('#liPass').focus(); toast('Wrong password', null, 'err'); break; }
          signIn({ id: 'admin', email: 'admin@vaultcards.app', name: 'Administrator',
                   since: Date.now(), role: 'admin', review: 'verified' }, 'admin');
          toast('Signed in as administrator');
          go('#/console');
          break;
        }

        if (!/^\S+@\S+\.\S+$/.test(ident)) { $('#liEmail').focus(); toast('Enter a valid email address', null, 'err'); break; }

        var acc = findAccount(ident);
        if (!acc) {
          toast('No account with that email', 'Open an account to get started', 'err');
          go('#/register');
          break;
        }
        if (acc.pass !== hashPass(pass)) { $('#liPass').focus(); toast('Wrong password', null, 'err'); break; }

        signIn(acc);
        toast('Signed in', acc.name);
        var next = sessionStorage.getItem('vaultcards.next') || '#/wallet';
        sessionStorage.removeItem('vaultcards.next');
        go(next);
        break;
      }

      case 'do-register': {
        var rEmail = $('#rgEmail').value.trim();
        var rPass = $('#rgPass').value;

        if (!/^\S+@\S+\.\S+$/.test(rEmail)) { $('#rgEmail').focus(); toast('Enter a valid email address', null, 'err'); break; }
        if (rEmail.toLowerCase() === ADMIN_USER || findAccount(rEmail)) {
          $('#rgEmail').focus(); toast('That email already has an account', 'Sign in instead', 'err'); break;
        }
        if (rPass.length < 8) { $('#rgPass').focus(); toast('Use at least 8 characters', null, 'err'); break; }

        register(rEmail, rPass);
        var win = reviewWindow();
        queueModal('Account open', '' +
          '<div class="notice notice-ok">' + ICON.check +
            '<div><div class="notice-title">Welcome, ' + esc(state.user.name) + '</div>' +
            '<div class="notice-body">Your ledger is open and empty. Present a gift code to credit it. ' +
            'Buying cards unlocks once your registration has been reviewed.</div></div></div>' +
          '<a class="btn btn-ghost btn-block" style="margin-top:12px" href="#/redeem" data-link data-act="close-modal">Present a code</a>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:18px" data-act="close-modal">Open the ledger</button>');
        go('#/wallet');
        break;
      }

      case 'account':
        openModal('Account', '' +
          '<div class="row" style="gap:12px;margin-bottom:14px">' +
            '<div class="avatar" style="width:44px;height:44px;font-size:15px">' + esc(state.user.initials) + '</div>' +
            '<div><div style="font-weight:650">' + esc(state.user.name) + '</div>' +
            '<div class="small muted">' + esc(state.user.email) + '</div></div></div>' +
          '<div class="stat-grid" style="margin-bottom:14px">' +
            '<div class="stat"><div class="k">Balance</div><div class="v">' + money(state.balance) + '</div></div>' +
            '<div class="stat"><div class="k">Role</div><div class="v" style="font-size:14px">' +
              (isAdmin() ? 'Administrator' : 'Member') + '</div></div>' +
            '<div class="stat"><div class="k">Status</div><div class="v" style="font-size:14px;color:' +
              (isPending() ? 'var(--stamp)">Under review' : 'var(--green)">Verified') + '</div></div>' +
          '</div>' +
          (isAdmin()
            ? '<a class="btn btn-primary btn-block" style="margin-bottom:8px" href="#/console" data-link data-act="close-modal">Issuing console</a>'
            : '') +
          '<a class="btn btn-ghost btn-block" href="#/wallet" data-link data-act="close-modal">Open the ledger</a>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--stamp)" data-act="logout">Sign out</button>');
        break;

      case 'logout':
        closeModal(); signOut(); break;

      case 'method':
        payoutMethod = el.dataset.id; render(); break;

      case 'do-payout': {
        var pAmt = Number($('#poAmt').value);
        var dest = $('#poDest').value.trim();
        if (!pAmt || pAmt < MIN_PAYOUT) { toast('Minimum payout is ' + money(MIN_PAYOUT), null, 'err'); break; }
        if (pAmt > state.balance) { toast('Amount exceeds your balance', 'Available ' + money(state.balance), 'err'); break; }
        if (!dest) { $('#poDest').focus(); toast('Add your payout details', null, 'err'); break; }
        var method = METHODS.filter(function (x) { return x.id === payoutMethod; })[0];
        var ticket = 'VF-' + block(6);
        state.payouts.unshift({ id: uid(), amount: pAmt, method: method.name, dest: dest, ticket: ticket, ts: Date.now() });
        state.txns.unshift(tx('hold', 'Payout held', method.name + ' · awaiting verification', 0));
        save();
        render();
        openModal('Verification required', '' +
          '<div class="notice notice-stamp">' + ICON.lock +
            '<div><div class="notice-title">Your account still needs to be verified</div>' +
            '<div class="notice-body">Your request for ' + money(pAmt) + ' via ' + esc(method.name) +
            ' is on hold. Every registration is reviewed by hand to keep bots and AI agents out, ' +
            'which takes ' + REVIEW_DAYS_MIN + ' to ' + REVIEW_DAYS_MAX + ' working days — expected ' +
            reviewWindow().from + ' – ' + reviewWindow().to + '. Your balance is untouched until then.</div></div></div>' +
          '<div class="code-row" style="margin-top:14px"><span class="small muted">Ticket</span>' +
            '<span class="mono grow" style="text-align:right">' + ticket + '</span>' +
            '<button class="icon-btn" style="width:28px;height:28px" data-act="copy" data-text="' + ticket + '">' + ICON.copy + '</button></div>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-act="support">' + ICON.chat + ' Contact support</button>' +
          '<p class="tiny muted center" style="margin-top:10px">Your balance stays in the ledger until the payout is released.</p>');
        break;
      }

      case 'support':
        openModal('Support', '' +
          '<div class="notice notice-accent">' + ICON.chat +
            '<div><div class="notice-title">A person reviews every file</div>' +
            '<div class="notice-body">Reach the team at <strong>vaultcardsix@proton.me</strong> and quote your ticket. ' +
            'Typical response time is under 24 hours.</div></div></div>' +
          '<p class="small muted" style="margin-top:14px">Quote your ticket number so the desk can find your file straight away.</p>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="close-modal">Close</button>');
        break;

      case 'generate': {
        var gAmt = Number($('#genAmt').value);
        var gQty = Math.min(50, Math.max(1, Number($('#genQty').value) || 1));
        var gLabel = $('#genLabel').value.trim();
        if (!gAmt || gAmt < 1) { toast('Enter a value of at least $1', null, 'err'); break; }
        var made = [];
        for (var i = 0; i < gQty; i++) { var c = newCode(gAmt, gLabel); state.codes.push(c); made.push(c.code); }
        save();
        toast(gQty + ' instrument' + (gQty > 1 ? 's' : '') + ' drawn', money(gAmt * gQty) + ' face value');
        render();
        var out = $('#genOut');
        if (out) {
          out.innerHTML = '<div class="notice notice-success" style="margin-top:14px">' + ICON.check +
            '<div style="min-width:0"><div class="notice-title">' + made.length + ' code' + (made.length > 1 ? 's' : '') + ' ready</div>' +
            '<div class="notice-body mono" style="word-break:break-all">' + made.join('<br>') + '</div>' +
            '<button class="btn btn-sm btn-primary" style="margin-top:10px" data-act="copy" data-text="' + esc(made.join('\n')) + '">' + ICON.copy + ' Copy</button>' +
            '</div></div>';
          out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        break;
      }

      case 'open-console': {
        var key = $('#consoleKey').value.trim();
        if (key !== CONSOLE_KEY) { toast('Wrong console key', null, 'err'); break; }
        closeModal(); go('#/console/' + CONSOLE_KEY);
        break;
      }

      case 'toggle-pw': {
        var pw = $('#' + el.dataset.for);
        if (!pw) break;
        var showing = pw.type === 'text';
        pw.type = showing ? 'password' : 'text';
        el.innerHTML = showing ? ICON.eye : ICON.eyeOff;
        el.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        el.setAttribute('title', showing ? 'Show password' : 'Hide password');
        break;
      }

      case 'verify-acc': {
        var vacc = setReview(el.dataset.id, 'verified');
        if (vacc) { render(); toast('Account verified', vacc.email); }
        break;
      }

      case 'unverify-acc': {
        var uacc = setReview(el.dataset.id, 'pending');
        if (uacc) { render(); toast('Verification revoked', uacc.email, 'info'); }
        break;
      }

      case 'del-acc': {
        var dacc = accountById(el.dataset.id);
        if (!dacc) break;
        if (!confirm('Delete ' + dacc.email + '? The account, its ledger and its instruments are removed. This cannot be undone.')) break;
        if (state.user && state.user.email === dacc.email) {
          state.user = null; state.balance = 0; state.txns = []; state.owned = [];
        }
        state.accounts = state.accounts.filter(function (x) { return x.id !== dacc.id; });
        save(); render(); renderChrome();
        toast('Account deleted', dacc.email, 'info');
        break;
      }

      case 'copy':
        copy(el.dataset.text, 'Copied'); break;

      case 'copy-all': {
        var open = state.codes.filter(function (c) { return !c.redeemed; }).map(function (c) { return c.code; });
        if (!open.length) { toast('No unused codes', null, 'err'); break; }
        copy(open.join('\n'), open.length + ' codes copied');
        break;
      }

      case 'revoke':
        state.codes = state.codes.filter(function (c) { return c.code !== el.dataset.code; });
        save(); render(); toast('Code revoked', null, 'info');
        break;

      case 'reset':
        if (!confirm('Clear all data on this device? The ledger, instruments and issued codes will be removed.')) break;
        var theme = state.theme;
        state = clone(DEFAULTS); state.theme = theme; save();
        render(); toast('All data cleared', null, 'info');
        break;

      case 'overlay':
        if (e.target === el) closeModal(); break;

      case 'close-modal':
        closeModal(); break;
    }
  });

  /* live search + code formatting */
  document.addEventListener('input', function (e) {
    if (e.target.id === 'shopSearch') {
      shopFilter.q = e.target.value;
      $('#brandGrid').innerHTML = brandCards();
    }
    if (e.target.id === 'amtInput') {
      setBuyAmount(e.target.value, true);
    }
    if (e.target.id === 'redeemInput') {
      /* Group around the issue prefix so what is typed matches what was issued.
         Codes issued before the rebrand carry the longer prefix and must still
         format — and redeem — unchanged, so never truncate past the longest. */
      var raw = normalise(e.target.value).slice(0, 16);
      var head = '';
      for (var pi = 0; pi < CODE_PREFIXES.length; pi++) {
        if (raw.indexOf(CODE_PREFIXES[pi]) === 0) { head = CODE_PREFIXES[pi]; break; }
      }
      if (head) raw = raw.slice(0, head.length + 12);
      var body = head ? raw.slice(head.length) : raw;
      var parts = body.match(/.{1,4}/g) || [];
      e.target.value = (head ? [head].concat(parts) : parts).join('-');
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'amtInput') setBuyAmount(e.target.value);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); $('#nav').classList.remove('open'); }
    /* Ctrl+Shift+G opens the issuing console when the URL hash cannot be set
       directly (embedded viewers, iframes). Same key as the private link. */
    if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
      e.preventDefault();
      openModal('Issuing console', '' +
        '<p class="small muted" style="margin-bottom:12px">Enter the console key to open the private code-issuing console.</p>' +
        '<div class="field"><label for="consoleKey">Console key</label>' +
        '<input id="consoleKey" class="input mono" placeholder="vt-…" autocomplete="off" spellcheck="false"></div>' +
        '<button class="btn btn-primary btn-block" style="margin-top:12px" data-act="open-console">Open console</button>');
      return;
    }
    if (e.key !== 'Enter') return;
    var id = e.target.id;
    if (id === 'redeemInput') { e.preventDefault(); var b = $('[data-act="do-redeem"]'); if (b) b.click(); }
    if (id === 'liEmail' || id === 'liPass') { e.preventDefault(); $('[data-act="do-login"]').click(); }
    if (id === 'genAmt' || id === 'genQty' || id === 'genLabel') { e.preventDefault(); $('[data-act="generate"]').click(); }
    if (id === 'consoleKey') { e.preventDefault(); $('[data-act="open-console"]').click(); }
  });

  /* The footer sits below the fold and only fades in once reached, so it never
     competes with the page on first paint. */
  (function revealFooter() {
    var footer = $('.site-footer');
    if (!footer) return;
    if (!('IntersectionObserver' in window)) { footer.classList.add('in'); return; }
    new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { footer.classList.add('in'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.08 }).observe(footer);
  })();

  window.addEventListener('hashchange', render);

  /* ================================================================== boot */
  if (!state.seeded) {
    state.seeded = true;
    state.codes.push(newCode(50, 'Welcome batch'), newCode(20, 'Welcome batch'));
    save();
  }
  if (state.theme) document.documentElement.setAttribute('data-theme', state.theme);
  $('#year').textContent = new Date().getFullYear();
  render();
})();
