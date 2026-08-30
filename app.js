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
    { id:'amazon',    name:'Amazon',           cat:'Shopping',  c1:'#ff9900', c2:'#232f3e', amounts:[10,25,50,100,250] },
    { id:'steam',     name:'Steam',            cat:'Gaming',    c1:'#1b2838', c2:'#66c0f4', amounts:[10,20,50,100] },
    { id:'playstore', name:'Google Play',      cat:'Apps',      c1:'#34a853', c2:'#4285f4', amounts:[10,25,50,100] },
    { id:'apple',     name:'Apple',            cat:'Apps',      c1:'#8e8e93', c2:'#1c1c1e', amounts:[15,25,50,100,200] },
    { id:'netflix',   name:'Netflix',          cat:'Streaming', c1:'#e50914', c2:'#3d0a0d', amounts:[25,50,100] },
    { id:'spotify',   name:'Spotify',          cat:'Streaming', c1:'#1db954', c2:'#0b3d21', amounts:[10,30,60] },
    { id:'playstation',name:'PlayStation',     cat:'Gaming',    c1:'#0070d1', c2:'#00296b', amounts:[10,20,50,100] },
    { id:'xbox',      name:'Xbox',             cat:'Gaming',    c1:'#107c10', c2:'#0b3b0b', amounts:[10,25,50,100] },
    { id:'nintendo',  name:'Nintendo eShop',   cat:'Gaming',    c1:'#e60012', c2:'#7a0009', amounts:[10,20,35,50] },
    { id:'visa',      name:'Prepaid Visa',     cat:'Payments',  c1:'#1a1f71', c2:'#436bd6', amounts:[25,50,100,250,500] },
    { id:'mastercard',name:'Prepaid Mastercard',cat:'Payments', c1:'#eb001b', c2:'#f79e1b', amounts:[25,50,100,250] },
    { id:'paypal',    name:'PayPal Balance',   cat:'Payments',  c1:'#003087', c2:'#009cde', amounts:[20,50,100,200] },
    { id:'btc',       name:'Bitcoin Voucher',  cat:'Crypto',    c1:'#f7931a', c2:'#5c3305', amounts:[25,50,100,250,500] },
    { id:'eth',       name:'Ethereum Voucher', cat:'Crypto',    c1:'#627eea', c2:'#22243f', amounts:[25,50,100,250] },
    { id:'usdt',      name:'USDT Voucher',     cat:'Crypto',    c1:'#26a17b', c2:'#0d4033', amounts:[20,50,100,500] },
    { id:'airbnb',    name:'Airbnb',           cat:'Travel',    c1:'#ff5a5f', c2:'#8c1c3f', amounts:[50,100,250] },
    { id:'uber',      name:'Uber & Uber Eats', cat:'Travel',    c1:'#111111', c2:'#4a4a4a', amounts:[15,25,50,100] },
    { id:'ikea',      name:'IKEA',             cat:'Shopping',  c1:'#0058a3', c2:'#ffdb00', amounts:[25,50,100,200] },
    { id:'zalando',   name:'Zalando',          cat:'Shopping',  c1:'#ff6900', c2:'#2b1a10', amounts:[25,50,100] },
    { id:'roblox',    name:'Roblox',           cat:'Gaming',    c1:'#e2231a', c2:'#232527', amounts:[10,25,50,100] }
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
    return { id: id, name: 'Vaultly credit', cat: 'Wallet', c1: '#5b5bd6', c2: '#0ea5a5', amounts: [] };
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
      state.txns.unshift(tx('in', 'Welcome credit', 'Demo balance to try the marketplace', 25));
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
    state.txns.unshift(tx('in', 'Gift code redeemed', entry.code, entry.amount));
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
    state.txns.unshift(tx('out', b.name + ' gift card', money(amount) + ' · instant delivery', -amount));
    save();
    return { ok: true, card: card };
  }

  /* ================================================================== views */
  function cardFace(b, amount, extraClass) {
    return '<div class="' + (extraClass || 'gc') + '" style="--c1:' + b.c1 + ';--c2:' + b.c2 + '">' +
      '<div class="gc-top"><div><div class="gc-brand">' + esc(b.name) + '</div>' +
      '<div class="gc-cat">' + esc(b.cat) + '</div></div><div class="gc-chip"></div></div>' +
      '<div class="gc-bottom"><div class="gc-amount">' + (amount ? money(amount) : 'Gift card') + '</div>' +
      '<div class="gc-logo">VAULTLY</div></div></div>';
  }

  /* ---------------------------------------------------------------- shop */
  var shopFilter = { q: '', cat: 'All' };

  function viewShop() {
    var b1 = brand('amazon'), b2 = brand('btc'), b3 = brand('steam');
    return '' +
    '<section class="hero"><div class="hero-grid">' +
      '<div>' +
        '<span class="eyebrow">' + ICON.bolt + ' One wallet · every brand</span>' +
        '<h1 style="margin-top:14px">Every gift card,<br>one balance.</h1>' +
        '<p class="lede">Vaultly turns any gift card, voucher or prepaid balance into spendable credit — then lets you buy a card for anything else. Redeem in seconds, swap between 20+ brands, keep it all in a single wallet.</p>' +
        '<div class="hero-cta">' +
          '<a class="btn btn-primary btn-lg" href="#/redeem" data-link>' + ICON.gift + ' Redeem a code</a>' +
          '<a class="btn btn-ghost btn-lg" href="#/about" data-link>How it works</a>' +
        '</div>' +
        '<div class="hero-trust">' +
          '<div>' + ICON.check + ' Instant delivery</div>' +
          '<div>' + ICON.check + ' No card fees</div>' +
          '<div>' + ICON.check + ' 20+ brands &amp; currencies</div>' +
        '</div>' +
      '</div>' +
      '<div class="showcase">' + cardFace(b1, 50) + cardFace(b2, 100) + cardFace(b3, 25) + '</div>' +
    '</div></section>' +

    '<section class="section" id="market">' +
      '<div class="section-head"><div><h2>Marketplace</h2>' +
      '<p>Pay from your Vaultly balance. Codes are delivered to your wallet the moment you confirm.</p></div>' +
      '<span class="pill pill-accent">' + ICON.bolt + ' Instant delivery</span></div>' +

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
      '<div class="card card-pad" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:22px">' +
        trustBlock(ICON.shield, 'Escrow-style checkout', 'Balance only leaves your wallet once a code is issued and shown to you.') +
        trustBlock(ICON.bolt, 'Delivered in seconds', 'No queues, no shipping — every card lands straight in your wallet.') +
        trustBlock(ICON.globe, '20+ brands, 1 balance', 'Shopping, gaming, streaming, prepaid cards and crypto vouchers side by side.') +
        trustBlock(ICON.chat, 'Human support', 'Verification and payouts are reviewed by our support team, never a bot.') +
      '</div>' +
    '</section>';
  }

  function trustBlock(icon, title, body) {
    return '<div><div class="feature-ico">' + icon + '</div><h3>' + esc(title) + '</h3>' +
      '<p class="muted small" style="margin-top:5px">' + esc(body) + '</p></div>';
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
        cardFace(b, 0) +
        '<div class="brand-meta"><strong>' + esc(b.name) + '</strong>' +
        '<span class="brand-range">' + money(lo) + '–' + money(hi) + '</span></div>' +
      '</button>';
    }).join('');
  }

  function brandModal(id) {
    var b = brand(id);
    var pick = b.amounts[1] || b.amounts[0];
    openModal('Buy ' + b.name, '' +
      '<div style="max-width:250px;margin:0 auto 18px">' + cardFace(b, pick, 'gc') + '</div>' +
      '<div class="field" style="margin-bottom:14px"><label>Choose an amount</label>' +
        '<div class="amount-grid" id="amtGrid">' + b.amounts.map(function (a) {
          return '<button class="amt' + (a === pick ? ' sel' : '') + '" data-act="pick-amt" data-amt="' + a + '">' + money(a) + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="spread small muted" style="padding:10px 12px;background:var(--surface-3);border-radius:11px">' +
        '<span>Wallet balance</span><strong class="mono" style="color:var(--text)">' + money(state.balance) + '</strong></div>' +
      '<div id="buyWarn"></div>' +
      '<button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-act="confirm-buy" data-id="' + b.id + '">' +
        'Pay ' + money(pick) + ' from wallet</button>' +
      '<p class="tiny muted center" style="margin-top:10px">Prototype checkout — no payment is processed and no real code is issued.</p>'
    );
    syncBuyButton(pick);
  }

  function syncBuyButton(amount) {
    var btn = $('[data-act="confirm-buy"]');
    if (!btn) return;
    btn.dataset.amt = amount;
    var short = amount > state.balance;
    btn.textContent = short ? 'Not enough balance' : 'Pay ' + money(amount) + ' from wallet';
    btn.disabled = short;
    $('#buyWarn').innerHTML = short
      ? '<div class="notice notice-accent" style="margin-top:12px">' + ICON.info +
        '<div><div class="notice-title">Top up first</div><div class="notice-body">Redeem a gift code to add ' +
        money(amount - state.balance) + ' to your wallet, then come back.</div>' +
        '<a class="btn btn-sm btn-primary" style="margin-top:10px" href="#/redeem" data-link data-act="close-modal">Redeem a code</a></div></div>'
      : '';
  }

  /* -------------------------------------------------------------- redeem */
  function viewRedeem() {
    return '<section class="section redeem-wrap">' +
      '<div class="center" style="margin-bottom:22px">' +
        '<span class="eyebrow">' + ICON.gift + ' Redeem</span>' +
        '<h1 style="margin-top:12px">Turn a code into balance</h1>' +
        '<p class="muted" style="margin-top:10px">Paste any Vaultly gift code. The value lands in your wallet instantly and can be spent on any brand in the marketplace.</p>' +
      '</div>' +
      '<div class="card card-pad">' +
        '<div class="field"><label for="redeemInput">Gift code</label>' +
          '<input id="redeemInput" class="code-input" placeholder="VLT-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" maxlength="19">' +
        '</div>' +
        '<button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-act="do-redeem">Redeem to wallet</button>' +
        '<p class="tiny muted center" style="margin-top:10px">Codes are single use. Dashes are optional.</p>' +
      '</div>' +
      '<div class="steps" style="margin-top:26px">' +
        step(1, 'Paste your code', 'From an email, receipt or the back of a physical card.') +
        step(2, 'Balance is credited', 'Every brand converts into one Vaultly balance.') +
        step(3, 'Spend it anywhere', 'Buy a card from any other brand, or request a payout.') +
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
      '<div class="wallet-hero">' +
        '<div class="spread" style="align-items:flex-start">' +
          '<div><div class="wallet-label">Available balance</div>' +
            '<div class="wallet-amount">' + money(state.balance) + '</div>' +
            '<div class="small" style="opacity:.85;margin-top:6px">' + esc(state.user.email) + ' · member since ' +
              new Date(state.user.since).toLocaleDateString() + '</div>' +
          '</div>' +
          '<span class="pill" style="background:rgba(255,255,255,.18);color:#fff">' + ICON.lock + ' Unverified</span>' +
        '</div>' +
        '<div class="wallet-actions">' +
          '<a class="btn btn-white" href="#/redeem" data-link>' + ICON.plus + ' Add funds</a>' +
          '<a class="btn" href="#/shop" data-link>' + ICON.gift + ' Buy a card</a>' +
          '<a class="btn" href="#/payout" data-link>' + ICON.arrowUp + ' Payout</a>' +
        '</div>' +
      '</div>' +

      '<div class="stat-grid" style="margin-top:18px">' +
        '<div class="stat"><div class="k">Added</div><div class="v">' + money(added) + '</div></div>' +
        '<div class="stat"><div class="k">Spent</div><div class="v">' + money(spent) + '</div></div>' +
        '<div class="stat"><div class="k">Cards owned</div><div class="v">' + state.owned.length + '</div></div>' +
        '<div class="stat"><div class="k">Payout status</div><div class="v" style="font-size:15px;color:var(--warn)">Locked</div></div>' +
      '</div>' +

      '<div class="cols-2" style="margin-top:18px">' +
        '<div class="card card-pad">' +
          '<div class="spread" style="margin-bottom:6px"><h3>My gift cards</h3>' +
            '<span class="small muted">' + state.owned.length + ' total</span></div>' +
          (state.owned.length
            ? '<div class="owned" style="margin-top:14px">' + state.owned.map(ownedCard).join('') + '</div>'
            : '<div class="empty" style="margin-top:12px">No cards yet.<br><a class="btn btn-primary btn-sm" style="margin-top:12px" href="#/shop" data-link>Browse the marketplace</a></div>') +
        '</div>' +

        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:4px">Activity</h3>' +
          (state.txns.length
            ? '<div class="list" style="margin-top:8px">' + state.txns.slice(0, 12).map(txRow).join('') + '</div>'
            : '<p class="small muted" style="margin-top:10px">Nothing here yet.</p>') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function ownedCard(c) {
    var b = brand(c.brandId);
    return '<div class="owned-card">' + cardFace(b, c.amount) +
      '<div class="code-row"><span class="mono">' + esc(c.code) + '</span>' +
      '<button class="icon-btn" style="width:28px;height:28px" data-act="copy" data-text="' + esc(c.code) + '" title="Copy code">' + ICON.copy + '</button></div>' +
      '<div class="tiny muted">Purchased ' + timeAgo(c.ts) + '</div></div>';
  }

  function txRow(t) {
    var cls = t.amount > 0 ? 'in' : 'out';
    var icon = t.dir === 'hold' ? ICON.lock : t.amount > 0 ? ICON.arrowDn : ICON.arrowUp;
    if (t.dir === 'hold') cls = 'hold';
    return '<div class="list-item"><div class="li-icon ' + cls + '">' + icon + '</div>' +
      '<div class="li-body"><div class="li-title">' + esc(t.title) + '</div>' +
      '<div class="li-sub">' + esc(t.sub) + ' · ' + timeAgo(t.ts) + '</div></div>' +
      '<div class="li-amt' + (t.amount > 0 ? ' pos' : '') + '">' +
      (t.amount ? (t.amount > 0 ? '+' : '−') + money(Math.abs(t.amount)) : '—') + '</div></div>';
  }

  /* -------------------------------------------------------------- payout */
  var payoutMethod = 'sepa';

  function viewPayout() {
    var m = METHODS.filter(function (x) { return x.id === payoutMethod; })[0];
    var pending = state.payouts.length;

    return '<section class="section">' +
      '<div class="section-head"><div><span class="eyebrow">' + ICON.arrowUp + ' Payout</span>' +
        '<h1 style="margin-top:12px">Cash out your balance</h1>' +
        '<p style="margin-top:8px;max-width:62ch">Move your Vaultly balance to a bank account, PayPal, a crypto wallet or a debit card. Payouts are released once support has verified your account.</p></div></div>' +

      '<div class="notice" style="margin-bottom:18px">' + ICON.lock +
        '<div><div class="notice-title">Verification required before payout</div>' +
        '<div class="notice-body">Your account is not verified yet, so withdrawals are on hold. <strong>You need to be verified by our support team to pay out.</strong> Start a verification request below and support will review your account.</div></div></div>' +

      '<div class="cols-2">' +
        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:12px">Withdraw</h3>' +
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
          '<p class="tiny muted">Minimum payout ' + money(10) + '. Processing time depends on the method.</p>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-act="do-payout">' + ICON.lock + ' Request payout</button>' +
          (pending ? '<div class="notice notice-accent" style="margin-top:14px">' + ICON.info +
            '<div><div class="notice-title">' + pending + ' request' + (pending > 1 ? 's' : '') + ' waiting for verification</div>' +
            '<div class="notice-body">Latest: ' + money(state.payouts[0].amount) + ' via ' + esc(state.payouts[0].method) +
            ' · ticket <span class="mono">' + esc(state.payouts[0].ticket) + '</span></div></div></div>' : '') +
        '</div>' +

        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:14px">Verification status</h3>' +
          '<div class="tracker">' +
            tstep('done', ICON.check, 'Account created', new Date(state.user.since).toLocaleDateString()) +
            tstep('done', ICON.check, 'Email on file', esc(state.user.email)) +
            tstep('now', '!', 'Identity verification', 'Pending — support has to verify you') +
            tstep('', '3', 'Payouts unlocked', 'Available after verification') +
          '</div>' +
          '<div class="divider"></div>' +
          '<p class="small muted">Verification is handled by a human reviewer. In this prototype no documents are uploaded and no request leaves your browser.</p>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="support">' + ICON.chat + ' Contact support</button>' +
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
        '<span class="eyebrow">' + ICON.globe + ' The concept</span>' +
        '<h1 style="margin-top:14px">Gift cards are broken. Vaultly is the fix.</h1>' +
        '<p class="lede">A gift card is money that only works in one place. Get one for a shop you never use and it sits in a drawer until it expires. Vaultly is a single exchange where every card, voucher and prepaid balance becomes one number you actually control.</p>' +
      '</div>' +

      '<div class="flow" style="margin-top:30px">' +
        '<div class="flow-item"><h3>Redeem anything</h3><p>Shopping cards, gaming credit, streaming vouchers, prepaid Visa, crypto vouchers — one input field takes them all.</p></div>' +
        '<div class="flow-item"><h3>One balance</h3><p>Everything converts into a single Vaultly balance. No more juggling twelve codes across twelve inboxes.</p></div>' +
        '<div class="flow-item"><h3>Spend or swap</h3><p>Buy a card from any other brand in the marketplace and get the code instantly in your wallet.</p></div>' +
        '<div class="flow-item"><h3>Or cash out</h3><p>Send the balance to your bank, PayPal, card or crypto wallet once support has verified your account.</p></div>' +
      '</div>' +

      '<div class="section">' +
        '<div class="section-head"><div><h2>Why people trust Vaultly</h2>' +
        '<p>Built around the two things that matter with stored value: the money is where you left it, and a human is reachable.</p></div></div>' +
        '<div class="feature-grid">' +
          feature(ICON.shield, 'Value stays in your wallet', 'Balance is only debited at the moment a code is issued and shown to you. Nothing is charged up front.') +
          feature(ICON.lock, 'Verified payouts only', 'Withdrawals are reviewed by support before release. It is slower on purpose — it is what stops an account takeover draining a balance.') +
          feature(ICON.bolt, 'Instant delivery', 'Codes are generated and delivered the second a purchase confirms. No waiting rooms, no shipping.') +
          feature(ICON.swap, 'Brand agnostic', 'Twenty-plus brands across shopping, gaming, streaming, prepaid cards and crypto — all priced in one currency.') +
          feature(ICON.chat, 'Real support', 'Verification, disputes and payouts are handled by people, not an automated queue.') +
          feature(ICON.globe, 'Works everywhere', 'A browser is the only requirement. Nothing to install, nothing to sync.') +
        '</div>' +
      '</div>' +

      '<div class="card card-pad" style="text-align:center">' +
        '<p class="small muted" style="margin-bottom:14px">Brands available in the marketplace</p>' +
        '<div class="logo-strip">' + CATALOG.slice(0, 12).map(function (b) {
          return '<span>' + esc(b.name) + '</span>';
        }).join('') + '</div>' +
      '</div>' +

      '<div class="section">' +
        '<div class="section-head"><div><h2>Questions</h2></div></div>' +
        '<div class="faq">' +
          faq('Is this a real shop?', 'No. Vaultly is a front-end prototype: a design and interaction demo. There is no backend, no payment processing and no real gift card is ever issued. Every balance, code and transaction you see is generated in your own browser and stored in localStorage. Clearing your browser data resets it.') +
          faq('How does the wallet work?', 'Redeeming a Vaultly gift code credits your balance. Buying a card in the marketplace debits it and drops a generated code into “My gift cards”. All of it is simulated locally — refresh the page and your balance is still there, because it is saved on this device only.') +
          faq('Why can’t I pay out?', 'Payouts are gated behind account verification. In the prototype every account starts unverified, so a payout request creates a support ticket and tells you that support has to verify you before money can leave the wallet.') +
          faq('Where do gift codes come from?', 'From the private issuing console. Whoever runs the demo has a secret link that generates single-use codes with any value, which can then be redeemed in the Redeem tab.') +
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
        '<div class="center" style="margin-bottom:18px">' +
          '<h2>Sign in to Vaultly</h2>' +
          '<p class="small muted" style="margin-top:8px">Demo login — any email and password works, and the account is created on the spot.</p>' +
        '</div>' +
        '<div class="field" style="margin-bottom:12px"><label for="liEmail">Email</label>' +
          '<input id="liEmail" class="input" type="email" placeholder="you@example.com" autocomplete="email"></div>' +
        '<div class="field" style="margin-bottom:16px"><label for="liPass">Password</label>' +
          '<input id="liPass" class="input" type="password" placeholder="••••••••" autocomplete="current-password"></div>' +
        '<button class="btn btn-primary btn-block btn-lg" data-act="do-login">Continue</button>' +
        '<div class="divider"></div>' +
        '<button class="btn btn-ghost btn-block" data-act="demo-login">Use the demo account</button>' +
        '<p class="tiny muted center" style="margin-top:14px">No password is stored or checked. The session lives in this browser only.</p>' +
      '</div>' +
    '</section>';
  }

  /* ------------------------------------------------------------- console */
  function viewConsole(key) {
    if (key !== CONSOLE_KEY) {
      return '<section class="section"><div class="empty">' +
        '<h2 style="margin-bottom:8px">Console not found</h2>' +
        '<p class="muted">This issuing link is invalid.</p></div></section>';
    }
    var issued = state.codes.length;
    var used = state.codes.filter(function (c) { return c.redeemed; }).length;
    var outstanding = state.codes.reduce(function (a, c) { return a + (c.redeemed ? 0 : c.amount); }, 0);

    return '<section class="section">' +
      '<div class="console-bar" style="margin-bottom:20px">' +
        ICON.key + '<div><strong>Issuing console</strong>' +
        '<div class="small" style="opacity:.72">Private link · generate gift codes for this Vaultly demo</div></div>' +
        '<span class="pill" style="margin-left:auto">' + issued + ' issued</span>' +
        '<span class="pill">' + used + ' redeemed</span>' +
        '<span class="pill">' + money(outstanding) + ' outstanding</span>' +
      '</div>' +

      '<div class="cols-2">' +
        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:14px">Generate gift codes</h3>' +
          '<div class="row wrap" style="gap:12px;align-items:flex-end">' +
            '<div class="field grow" style="min-width:120px"><label for="genAmt">Value each (USD)</label>' +
              '<input id="genAmt" class="input" type="number" min="1" step="1" value="50"></div>' +
            '<div class="field" style="width:110px"><label for="genQty">Quantity</label>' +
              '<input id="genQty" class="input" type="number" min="1" max="50" step="1" value="1"></div>' +
            '<div class="field grow" style="min-width:150px"><label for="genLabel">Batch label</label>' +
              '<input id="genLabel" class="input" placeholder="e.g. Launch giveaway"></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-act="generate">' + ICON.plus + ' Generate codes</button>' +
          '<div id="genOut"></div>' +
        '</div>' +

        '<div class="card card-pad">' +
          '<h3 style="margin-bottom:6px">Demo controls</h3>' +
          '<p class="small muted">Reset wipes the wallet, purchased cards, activity and every issued code on this device.</p>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="copy" data-text="' + esc(location.origin + location.pathname + '#/console/' + CONSOLE_KEY) + '">' + ICON.copy + ' Copy console link</button>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--danger)" data-act="reset">' + ICON.trash + ' Reset demo data</button>' +
        '</div>' +
      '</div>' +

      '<div class="card card-pad" style="margin-top:18px">' +
        '<div class="spread" style="margin-bottom:10px"><h3>Issued codes</h3>' +
          (issued ? '<button class="btn btn-ghost btn-sm" data-act="copy-all">' + ICON.copy + ' Copy unused</button>' : '') +
        '</div>' +
        (issued ? '<div class="table-wrap"><table class="table"><thead><tr>' +
            '<th>Code</th><th>Value</th><th>Batch</th><th>Status</th><th></th></tr></thead><tbody>' +
            state.codes.slice().reverse().map(codeRow).join('') +
          '</tbody></table></div>'
          : '<div class="empty">No codes issued yet.</div>') +
      '</div>' +
    '</section>';
  }

  function codeRow(c) {
    return '<tr><td><span class="mono">' + esc(c.code) + '</span></td>' +
      '<td class="mono">' + money(c.amount) + '</td>' +
      '<td class="muted">' + (esc(c.label) || '—') + '</td>' +
      '<td>' + (c.redeemed
        ? '<span class="pill pill-success">' + ICON.check + ' Redeemed ' + timeAgo(c.redeemed) + '</span>'
        : '<span class="pill pill-accent">Active</span>') + '</td>' +
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
        openModal('Order complete', '' +
          '<div style="max-width:250px;margin:0 auto 16px">' + cardFace(b, amt) + '</div>' +
          '<div class="notice notice-success" style="margin-bottom:14px">' + ICON.check +
            '<div><div class="notice-title">' + esc(b.name) + ' card delivered</div>' +
            '<div class="notice-body">Saved to your wallet. New balance ' + money(state.balance) + '.</div></div></div>' +
          '<div class="field"><label>Your code</label><div class="code-row">' +
            '<span class="mono" style="font-size:14px">' + esc(res.card.code) + '</span>' +
            '<button class="icon-btn" style="width:28px;height:28px" data-act="copy" data-text="' + esc(res.card.code) + '">' + ICON.copy + '</button>' +
          '</div></div>' +
          '<a class="btn btn-primary btn-block btn-lg" style="margin-top:14px" href="#/wallet" data-link data-act="close-modal">Open wallet</a>');
        renderChrome();
        toast('Purchase complete', b.name + ' · ' + money(amt));
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
        toast('Redeemed ' + money(out.amount), 'New balance ' + money(state.balance));
        openModal('Code redeemed', '' +
          '<div class="notice notice-success">' + ICON.check +
          '<div><div class="notice-title">' + money(out.amount) + ' added to your wallet</div>' +
          '<div class="notice-body">Your balance is now ' + money(state.balance) + '.</div></div></div>' +
          '<div class="row" style="margin-top:14px;gap:8px">' +
            '<a class="btn btn-primary grow" href="#/shop" data-link data-act="close-modal">Spend it</a>' +
            '<a class="btn btn-ghost grow" href="#/wallet" data-link data-act="close-modal">Open wallet</a>' +
          '</div>');
        break;
      }

      case 'do-login': {
        var email = $('#liEmail').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { $('#liEmail').focus(); toast('Enter a valid email', null, 'err'); break; }
        signIn(email);
        toast('Welcome to Vaultly', state.seeded ? 'Demo credit added to your wallet' : null);
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
            '<div class="stat"><div class="k">Status</div><div class="v" style="font-size:15px;color:var(--warn)">Unverified</div></div>' +
          '</div>' +
          '<a class="btn btn-ghost btn-block" href="#/wallet" data-link data-act="close-modal">Open wallet</a>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--danger)" data-act="logout">Sign out</button>');
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
        state.txns.unshift(tx('hold', 'Payout on hold', method.name + ' · awaiting verification', 0));
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
            '<div><div class="notice-title">Verification is handled by a person</div>' +
            '<div class="notice-body">Reach the team at <strong>support@vaultly.app</strong> and quote your ticket. ' +
            'Typical response time is under 24 hours.</div></div></div>' +
          '<p class="small muted" style="margin-top:12px">This is a prototype: the address is fictional and no message is delivered.</p>' +
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
        toast(gQty + ' code' + (gQty > 1 ? 's' : '') + ' generated', money(gAmt * gQty) + ' total value');
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
