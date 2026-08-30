/* ==========================================================================
   Vaultly — front-end prototype
   Everything runs in the browser. No backend, no network calls, no real money.
   State lives in localStorage under the key below.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'vaultly.state.v1';
  /* The private console route. Share the link, not the app:
     #/console/vt-9f2k-console                                          */
  var CONSOLE_KEY = 'vt-9f2k-console';

  /* ---------------------------------------------------------------- catalog */
  var CATALOG = [
    { id:'amazon',    name:'Amazon',           cat:'Shopping',  ink:'#87500b', amounts:[10,25,50,100,250] },
    { id:'steam',     name:'Steam',            cat:'Gaming',    ink:'#1b2838', amounts:[10,20,50,100] },
    { id:'playstore', name:'Google Play',      cat:'Apps',      ink:'#1d6b3c', amounts:[10,25,50,100] },
    { id:'apple',     name:'Apple',            cat:'Apps',      ink:'#2b2c2e', amounts:[15,25,50,100,200] },
    { id:'netflix',   name:'Netflix',          cat:'Streaming', ink:'#8c1116', amounts:[25,50,100] },
    { id:'spotify',   name:'Spotify',          cat:'Streaming', ink:'#125a2d', amounts:[10,30,60] },
    { id:'playstation',name:'PlayStation',     cat:'Gaming',    ink:'#123a78', amounts:[10,20,50,100] },
    { id:'xbox',      name:'Xbox',             cat:'Gaming',    ink:'#155619', amounts:[10,25,50,100] },
    { id:'nintendo',  name:'Nintendo eShop',   cat:'Gaming',    ink:'#8d1014', amounts:[10,20,35,50] },
    { id:'visa',      name:'Prepaid Visa',     cat:'Payments',  ink:'#1a1f71', amounts:[25,50,100,250,500] },
    { id:'mastercard',name:'Prepaid Mastercard',cat:'Payments', ink:'#8d2412', amounts:[25,50,100,250] },
    { id:'paypal',    name:'PayPal Balance',   cat:'Payments',  ink:'#14356b', amounts:[20,50,100,200] },
    { id:'btc',       name:'Bitcoin Voucher',  cat:'Crypto',    ink:'#8a5410', amounts:[25,50,100,250,500] },
    { id:'eth',       name:'Ethereum Voucher', cat:'Crypto',    ink:'#3c4270', amounts:[25,50,100,250] },
    { id:'usdt',      name:'USDT Voucher',     cat:'Crypto',    ink:'#125946', amounts:[20,50,100,500] },
    { id:'airbnb',    name:'Airbnb',           cat:'Travel',    ink:'#8d2440', amounts:[50,100,250] },
    { id:'uber',      name:'Uber & Uber Eats', cat:'Travel',    ink:'#22252a', amounts:[15,25,50,100] },
    { id:'ikea',      name:'IKEA',             cat:'Shopping',  ink:'#0f4c82', amounts:[25,50,100,200] },
    { id:'zalando',   name:'Zalando',          cat:'Shopping',  ink:'#7a3a12', amounts:[25,50,100] },
    { id:'roblox',    name:'Roblox',           cat:'Gaming',    ink:'#8b1912', amounts:[10,25,50,100] }
  ];
  var CATS = ['All','Shopping','Gaming','Streaming','Apps','Payments','Crypto','Travel'];

  var METHODS = [
    { id:'sepa',   name:'Bank transfer',  sub:'SEPA / IBAN · 1–2 days',  field:'IBAN',           ph:'DE00 0000 0000 0000 0000 00' },
    { id:'paypal', name:'PayPal',         sub:'Instant · 2% fee',        field:'PayPal email',   ph:'you@example.com' },
    { id:'crypto', name:'Crypto payout',  sub:'USDT / BTC · ~10 min',    field:'Wallet address', ph:'0x… or bc1…' },
    { id:'card',   name:'Debit card',     sub:'Visa / Mastercard · 24h', field:'Card number',    ph:'0000 0000 0000 0000' }
  ];

  /* ------------------------------------------------------------------ state */
  var DEFAULTS = {
    user: null,
    balance: 0,
    txns: [],
    owned: [],
    codes: [],
    payouts: [],
    theme: null,
    seeded: false
  };
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return clone(DEFAULTS);
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
  var money = function (n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  };
  var uid = function () { return Math.random().toString(36).slice(2, 10); };

  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* no O/0/I/1 */
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
  function makeCode(prefix) {
    return (prefix || 'VLT') + '-' + block(4) + '-' + block(4) + '-' + block(4);
  }
  function normalise(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function brand(id) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
    return { id: id, name: 'Vaultly credit', cat: 'Ledger', ink: '#1f5c3d', amounts: [] };
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
    sessionStorage.setItem('vaultly.next', next || location.hash || '#/wallet');
    go('#/login');
    toast('Sign in to continue', 'It takes one click in this demo', 'info');
    return false;
  }

  function signIn(email, name) {
    var handle = (name || email.split('@')[0] || 'member').trim();
    state.user = {
      id: uid(),
      email: email.trim(),
      name: handle,
      initials: handle.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'VL',
      since: Date.now(),
      verified: false
    };
    if (!state.seeded) {
      state.seeded = true;
      state.balance += 25;
      state.txns.unshift(tx('in', 'Opening credit', 'Demo balance for the marketplace', 25));
      /* two ready-to-use demo codes so the console has history from day one */
      state.codes.push(newCode(50, 'Welcome batch'), newCode(20, 'Welcome batch'));
    }
    save();
    renderChrome();
  }

  function signOut() {
    state.user = null; save(); renderChrome(); go('#/shop');
    toast('Signed out', 'Your wallet data stays on this device', 'info');
  }

  function tx(dir, title, sub, amount) {
    return { id: uid(), dir: dir, title: title, sub: sub, amount: amount, ts: Date.now() };
  }

  function newCode(amount, label) {
    return { code: makeCode('VLT'), amount: amount, label: label || '', created: Date.now(), redeemed: null };
  }

  function findCode(input) {
    var want = normalise(input);
    for (var i = 0; i < state.codes.length; i++) {
      if (normalise(state.codes[i].code) === want) return state.codes[i];
    }
    return null;
  }

  function redeem(input) {
    var entry = findCode(input);
    if (!entry) return { ok: false, msg: 'That code is not valid', sub: 'Check the characters and try again' };
    if (entry.redeemed) return { ok: false, msg: 'Code already redeemed', sub: 'Used ' + timeAgo(entry.redeemed) };
    entry.redeemed = Date.now();
    entry.redeemedBy = state.user ? state.user.email : 'guest';
    state.balance += entry.amount;
    state.txns.unshift(tx('in', 'Code presented', entry.code, entry.amount));
    save();
    return { ok: true, amount: entry.amount };
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
        '<div class="gc-seal">VY</div>' +
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
        '<h1 style="margin-top:18px">Every gift card,<br>one ledger.</h1>' +
        '<p class="lede">A gift card is money locked to one shop. Vaultly accepts any card, voucher or prepaid balance, books it into a single ledger, and lets you draw a new card on any other brand — or cash the balance out.</p>' +
        '<div class="hero-cta">' +
          '<a class="btn btn-primary btn-lg" href="#/redeem" data-link>Redeem a code</a>' +
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
        '<div class="specimen-cap">Specimen · not redeemable</div>' +
      '</div>' +
    '</div></section>' +

    '<section class="section" id="market">' +
      '<div class="section-head"><div><h2>Marketplace</h2>' +
      '<p>Drawn against your ledger balance. The code is issued and shown to you the moment you confirm.</p></div>' +
      '<span class="pill pill-accent">Instant issue</span></div>' +

      '<div class="toolbar">' +
        '<div class="search">' + ICON.search +
          '<input class="input" id="shopSearch" type="search" placeholder="Search brands, currencies, vouchers…" value="' + esc(shopFilter.q) + '" autocomplete="off">' +
        '</div>' +
        '<div class="chips">' + CATS.map(function (c) {
          return '<button class="chip' + (shopFilter.cat === c ? ' active' : '') + '" data-act="cat" data-cat="' + c + '">' + c + '</button>';
        }).join('') + '</div>' +
      '</div>' +

      '<div class="grid-brands" id="brandGrid">' + brandCards() + '</div>' +
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

  function brandCards() {
    var q = shopFilter.q.toLowerCase().trim();
    var list = CATALOG.filter(function (b) {
      var okCat = shopFilter.cat === 'All' || b.cat === shopFilter.cat;
      var okQ = !q || (b.name + ' ' + b.cat).toLowerCase().indexOf(q) > -1;
      return okCat && okQ;
    });
    if (!list.length) {
      return '<div class="empty" style="grid-column:1/-1">No cards match “' + esc(shopFilter.q) + '”.<br>' +
        '<button class="btn btn-ghost btn-sm" data-act="clear-filter" style="margin-top:12px">Clear filters</button></div>';
    }
    return list.map(function (b) {
      var lo = b.amounts[0], hi = b.amounts[b.amounts.length - 1];
      return '<button class="brand-card" data-act="open-brand" data-id="' + b.id + '">' +
        cardFace(b, 0, 'gc-sm') +
        '<div class="brand-meta"><strong>' + esc(b.name) + '</strong>' +
        '<span class="brand-range">' + money(lo) + '–' + money(hi) + '</span></div>' +
      '</button>';
    }).join('');
  }

  function brandModal(id) {
    var b = brand(id);
    var pick = b.amounts[1] || b.amounts[0];
    openModal('Buy ' + b.name, '' +
      '<div style="margin-bottom:18px">' + cardFace(b, pick) + '</div>' +
      '<div class="field" style="margin-bottom:16px"><label>Denomination</label>' +
        '<div class="amount-grid" id="amtGrid">' + b.amounts.map(function (a) {
          return '<button class="amt' + (a === pick ? ' sel' : '') + '" data-act="pick-amt" data-amt="' + a + '">' + money(a) + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="spread" style="padding:9px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)">' +
        '<span class="caps">Ledger balance</span><span class="mono" style="font-size:13px">' + money(state.balance) + '</span></div>' +
      '<div id="buyWarn"></div>' +
      '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" data-act="confirm-buy" data-id="' + b.id + '">' +
        'Draw for ' + money(pick) + '</button>' +
      '<p class="tiny muted center" style="margin-top:12px">Prototype — nothing is charged and no real instrument is issued.</p>'
    );
    syncBuyButton(pick);
  }

  function syncBuyButton(amount) {
    var btn = $('[data-act="confirm-buy"]');
    if (!btn) return;
    btn.dataset.amt = amount;
    var short = amount > state.balance;
    btn.textContent = short ? 'Insufficient balance' : 'Draw for ' + money(amount);
    btn.disabled = short;
    $('#buyWarn').innerHTML = short
      ? '<div class="notice notice-accent" style="margin-top:14px">' + ICON.info +
        '<div><div class="notice-title">Credit the ledger first</div><div class="notice-body">Present a code worth ' +
        money(amount - state.balance) + ' or more, then draw again.</div>' +
        '<a class="btn btn-sm btn-primary" style="margin-top:12px" href="#/redeem" data-link data-act="close-modal">Redeem a code</a></div></div>'
      : '';
  }

  /* -------------------------------------------------------------- redeem */
  function viewRedeem() {
    return '<section class="section redeem-wrap">' +
      '<div style="margin-bottom:26px">' +
        '<span class="eyebrow">Redeem</span>' +
        '<h1 style="margin-top:16px">Present a code<br>for credit.</h1>' +
        '<p class="lede">Any Vaultly code, in any denomination. The value is booked to your ledger immediately and can be drawn against any brand in the marketplace.</p>' +
      '</div>' +
      '<div class="card card-pad">' +
        '<div class="field"><label for="redeemInput">Instrument number</label>' +
          '<input id="redeemInput" class="code-input" placeholder="VLT-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" maxlength="19">' +
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
              new Date(state.user.since).toLocaleDateString() + '</div>' +
            '<div class="wallet-actions">' +
              '<a class="btn btn-white" href="#/redeem" data-link>Add funds</a>' +
              '<a class="btn" href="#/shop" data-link>Draw a card</a>' +
              '<a class="btn" href="#/payout" data-link>Payout</a>' +
            '</div>' +
          '</div>' +
          '<span class="pill pill-stamp">' + ICON.lock + ' Unverified</span>' +
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
  var payoutMethod = 'sepa';

  function viewPayout() {
    var m = METHODS.filter(function (x) { return x.id === payoutMethod; })[0];
    var pending = state.payouts.length;

    return '<section class="section">' +
      '<div class="section-head"><div><span class="eyebrow">Payout</span>' +
        '<h1 style="margin-top:16px">Draw the balance out</h1>' +
        '<p>Settle your ledger balance to a bank account, PayPal, a crypto wallet or a debit card. Funds are released once the support desk has verified the account.</p></div></div>' +

      '<div class="notice notice-stamp stamped" style="margin-bottom:22px">' + ICON.lock +
        '<div style="max-width:60ch"><div class="notice-title">Payout held pending verification</div>' +
        '<div class="notice-body">This account has not been verified, so no balance can leave it. ' +
        '<strong>You need to be verified by our support team to pay out.</strong> ' +
        'File a request below and the support desk will review the account.</div></div>' +
        '<div class="stamp"><div class="stamp-line1">Not verified</div>' +
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
            '<input id="poAmt" class="input" type="number" min="10" step="1" placeholder="0.00" value="' + (state.balance ? Math.floor(state.balance) : '') + '"></div>' +
          '<p class="tiny muted">Minimum settlement ' + money(10) + '. Clearing time depends on the method.</p>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" data-act="do-payout">' + ICON.lock + ' File payout request</button>' +
          (pending ? '<div class="notice notice-accent" style="margin-top:14px">' + ICON.info +
            '<div><div class="notice-title">' + pending + ' request' + (pending > 1 ? 's' : '') + ' held for verification</div>' +
            '<div class="notice-body">Latest: ' + money(state.payouts[0].amount) + ' via ' + esc(state.payouts[0].method) +
            ' · ticket <span class="mono">' + esc(state.payouts[0].ticket) + '</span></div></div></div>' : '') +
        '</div>' +

        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:16px">Verification file</h3>' +
          '<div class="tracker">' +
            tstep('done', ICON.check, 'Account opened', new Date(state.user.since).toLocaleDateString()) +
            tstep('done', ICON.check, 'Email on file', esc(state.user.email)) +
            tstep('now', '!', 'Identity check', 'Open — the support desk has to verify you') +
            tstep('', '4', 'Payout released', 'Follows verification') +
          '</div>' +
          '<div class="divider"></div>' +
          '<p class="small muted">A person reviews every file. In this prototype nothing is uploaded and no request leaves your browser.</p>' +
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
        '<h1 style="margin-top:18px">A gift card is money<br>with someone else\u2019s name on it.</h1>' +
        '<p class="lede">Get one for a shop you never use and it sits in a drawer until it expires. Vaultly is a clearing house: every card, voucher and prepaid balance is accepted, booked into one ledger, and reissued as whatever you actually want.</p>' +
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
          feature(ICON.lock, 'Verified settlement', 'Payouts are reviewed before release. Deliberately slower \u2014 it is what stops a stolen account draining a balance.') +
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
          faq('Is this a real house?', 'No. Vaultly is a front-end prototype: a design and interaction demo. There is no backend, no payment processing, and no real gift card is ever issued. Every balance, code and entry you see is generated in your own browser and stored in localStorage. Clearing your browser data resets it.') +
          faq('How does the ledger work?', 'Presenting a Vaultly code credits your balance. Drawing a card in the marketplace debits it and files a generated code under instruments held. All of it is simulated locally — refresh and the balance is still there, because it is saved on this device only.') +
          faq('Why can’t I pay out?', 'Payouts are gated behind account verification. In the prototype every account starts unverified, so a payout request creates a support ticket and tells you that support has to verify you before money can leave the wallet.') +
          faq('Where do the codes come from?', 'From the private issuing console. Whoever runs the demo holds a secret link that draws single-use instruments of any denomination, which are then presented in the Redeem tab.') +
          faq('Is my data sent anywhere?', 'No. There are no network requests beyond loading the page itself and its web font. Nothing you type is transmitted, logged or shared.') +
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

  /* --------------------------------------------------------------- login */
  function viewLogin() {
    return '<section class="auth-wrap">' +
      '<div class="card card-pad">' +
        '<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--rule)">' +
          '<span class="eyebrow">Account</span>' +
          '<h2 style="margin-top:12px">Sign in</h2>' +
          '<p class="small muted" style="margin-top:8px">Demo access — any email and password work, and the account is opened on the spot.</p>' +
        '</div>' +
        '<div class="field" style="margin-bottom:12px"><label for="liEmail">Email</label>' +
          '<input id="liEmail" class="input" type="email" placeholder="you@example.com" autocomplete="email"></div>' +
        '<div class="field" style="margin-bottom:16px"><label for="liPass">Password</label>' +
          '<input id="liPass" class="input" type="password" placeholder="••••••••" autocomplete="current-password"></div>' +
        '<button class="btn btn-primary btn-block btn-lg" data-act="do-login">Continue</button>' +
        '<div class="divider"></div>' +
        '<button class="btn btn-ghost btn-block" data-act="demo-login">Use the demo account</button>' +
        '<p class="tiny muted center" style="margin-top:16px">No password is stored or checked. The session lives in this browser only.</p>' +
      '</div>' +
    '</section>';
  }

  /* ------------------------------------------------------------- console */
  function viewConsole(key) {
    if (key !== CONSOLE_KEY) {
      return '<section class="section"><div class="empty">' +
        '<h2 style="margin-bottom:10px">No such console</h2>' +
        '<p class="muted">This issuing link is not valid.</p></div></section>';
    }
    var issued = state.codes.length;
    var used = state.codes.filter(function (c) { return c.redeemed; }).length;
    var outstanding = state.codes.reduce(function (a, c) { return a + (c.redeemed ? 0 : c.amount); }, 0);

    return '<section class="section">' +
      '<div class="console-bar" style="margin-bottom:24px">' +
        ICON.key + '<div><div class="wordmark">Issuing console</div>' +
        '<div class="tiny" style="opacity:.62;font-family:var(--mono);letter-spacing:.08em">PRIVATE LINK · DRAWS INSTRUMENTS FOR THIS DEMO</div></div>' +
        '<span class="pill" style="margin-left:auto">' + issued + ' issued</span>' +
        '<span class="pill">' + used + ' redeemed</span>' +
        '<span class="pill">' + money(outstanding) + ' outstanding</span>' +
      '</div>' +

      '<div class="cols-2">' +
        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:16px">Draw new instruments</h3>' +
          '<div class="row wrap" style="gap:12px;align-items:flex-end">' +
            '<div class="field grow" style="min-width:120px"><label for="genAmt">Denomination (USD)</label>' +
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
          '<h3 style="margin-bottom:8px">Demo controls</h3>' +
          '<p class="small muted">Reset clears the ledger, held instruments, journal and every issued code on this device.</p>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="copy" data-text="' + esc(location.origin + location.pathname + '#/console/' + CONSOLE_KEY) + '">' + ICON.copy + ' Copy console link</button>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--stamp)" data-act="reset">' + ICON.trash + ' Reset demo data</button>' +
        '</div>' +
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
      case 'login':   html = state.user ? (go('#/wallet'), '') : viewLogin(); break;
      case 'console': html = viewConsole(r.arg); break;
      case 'wallet':  if (!requireAuth('#/wallet')) return; html = viewWallet(); break;
      case 'payout':  if (!requireAuth('#/payout')) return; html = viewPayout(); break;
      default:        html = viewShop();
    }
    if (html === '') return;

    view.innerHTML = html;
    $$('#nav a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === (r.name || 'shop'));
    });
    $('#nav').classList.remove('open');
    closeModal();
    window.scrollTo(0, 0);
    renderChrome();
  }

  function renderChrome() {
    var pill = $('#balancePill');
    pill.hidden = !state.user;
    $('#balanceValue').textContent = money(state.balance);
    $('#accountSlot').innerHTML = state.user
      ? '<button class="avatar" data-act="account" title="Account">' + esc(state.user.initials) + '</button>'
      : '<a class="btn btn-primary btn-sm" href="#/login" data-link>Sign in</a>';
  }

  /* ================================================================ actions */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-link]');
    var el = e.target.closest('[data-act]');
    if (link && !el) { $('#nav').classList.remove('open'); return; }
    if (!el) return;
    var act = el.dataset.act;

    switch (act) {
      case 'dismiss-ribbon':
        $('#ribbon').remove(); break;

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
        $$('.amt').forEach(function (a) { a.classList.remove('sel'); });
        el.classList.add('sel');
        syncBuyButton(Number(el.dataset.amt));
        break;

      case 'confirm-buy': {
        if (!state.user) { closeModal(); requireAuth(location.hash); break; }
        var amt = Number(el.dataset.amt);
        var res = buy(el.dataset.id, amt);
        if (!res.ok) { toast('Not enough balance', 'Redeem a code to top up', 'err'); break; }
        var b = brand(el.dataset.id);
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
        var email = $('#liEmail').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { $('#liEmail').focus(); toast('Enter a valid email', null, 'err'); break; }
        signIn(email);
        toast('Account opened', state.seeded ? 'Opening credit booked to your ledger' : null);
        var next = sessionStorage.getItem('vaultly.next') || '#/wallet';
        sessionStorage.removeItem('vaultly.next');
        go(next);
        break;
      }

      case 'demo-login':
        signIn('demo@vaultly.app', 'Demo User');
        toast('Signed in as the demo account');
        go('#/wallet');
        break;

      case 'account':
        openModal('Account', '' +
          '<div class="row" style="gap:12px;margin-bottom:14px">' +
            '<div class="avatar" style="width:44px;height:44px;font-size:15px">' + esc(state.user.initials) + '</div>' +
            '<div><div style="font-weight:650">' + esc(state.user.name) + '</div>' +
            '<div class="small muted">' + esc(state.user.email) + '</div></div></div>' +
          '<div class="stat-grid" style="margin-bottom:14px">' +
            '<div class="stat"><div class="k">Balance</div><div class="v">' + money(state.balance) + '</div></div>' +
            '<div class="stat"><div class="k">Status</div><div class="v" style="font-size:14px;color:var(--stamp)">Unverified</div></div>' +
          '</div>' +
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
        if (!pAmt || pAmt < 10) { toast('Minimum payout is ' + money(10), null, 'err'); break; }
        if (pAmt > state.balance) { toast('Amount exceeds your balance', 'Available ' + money(state.balance), 'err'); break; }
        if (!dest) { $('#poDest').focus(); toast('Add your payout details', null, 'err'); break; }
        var method = METHODS.filter(function (x) { return x.id === payoutMethod; })[0];
        var ticket = 'VF-' + block(6);
        state.payouts.unshift({ id: uid(), amount: pAmt, method: method.name, dest: dest, ticket: ticket, ts: Date.now() });
        state.txns.unshift(tx('hold', 'Payout held', method.name + ' · awaiting verification', 0));
        save();
        render();
        openModal('Verification required', '' +
          '<div class="notice">' + ICON.lock +
            '<div><div class="notice-title">You need to be verified by our support team to pay out</div>' +
            '<div class="notice-body">Your request for ' + money(pAmt) + ' via ' + esc(method.name) +
            ' is on hold. Support has to verify your account before any balance can leave Vaultly. ' +
            'Your balance stays untouched until then.</div></div></div>' +
          '<div class="code-row" style="margin-top:14px"><span class="small muted">Ticket</span>' +
            '<span class="mono grow" style="text-align:right">' + ticket + '</span>' +
            '<button class="icon-btn" style="width:28px;height:28px" data-act="copy" data-text="' + ticket + '">' + ICON.copy + '</button></div>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-act="support">' + ICON.chat + ' Contact support</button>' +
          '<p class="tiny muted center" style="margin-top:10px">Prototype — no request is actually sent and no money moves.</p>');
        break;
      }

      case 'support':
        openModal('Support', '' +
          '<div class="notice notice-accent">' + ICON.chat +
            '<div><div class="notice-title">A person reviews every file</div>' +
            '<div class="notice-body">Reach the team at <strong>support@vaultly.app</strong> and quote your ticket. ' +
            'Typical response time is under 24 hours.</div></div></div>' +
          '<p class="small muted" style="margin-top:14px">Prototype: the address is fictional and no message is delivered.</p>' +
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
        if (!confirm('Reset all demo data on this device? Wallet, cards and codes will be cleared.')) break;
        var theme = state.theme;
        state = clone(DEFAULTS); state.theme = theme; save();
        render(); toast('Demo data reset', null, 'info');
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
    if (e.target.id === 'redeemInput') {
      var raw = normalise(e.target.value).slice(0, 16);
      var parts = raw.match(/.{1,4}/g) || [];
      e.target.value = parts.join('-');
    }
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

  window.addEventListener('hashchange', render);

  /* ================================================================== boot */
  if (state.theme) document.documentElement.setAttribute('data-theme', state.theme);
  $('#year').textContent = new Date().getFullYear();
  render();
})();
