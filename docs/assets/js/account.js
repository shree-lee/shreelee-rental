/* Sign in, register, and the small profile screen. */
(function () {
  'use strict';
  var S = window.Shree, Shop = window.Shop;

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hide', !on); }
  function flash(el, text, kind) {
    el.textContent = text;
    el.className = 'msg show ' + kind;
  }

  var params = new URLSearchParams(location.search);
  var next = params.get('next') || 'collection.html';
  var why = params.get('why');

  document.addEventListener('shop:ready', function () {
    show($('loadingView'), false);

    if (!S.configured()) {
      show($('authView'), true);
      flash($('inMsg'), 'The shop is not connected yet — the Apps Script url is missing from assets/js/config.js.', 'err');
      return;
    }

    if (Shop.me) { paintProfile(); return; }

    show($('authView'), true);
    if (why) {
      $('whyNote').textContent = why;
      show($('whyNote'), true);
    }
    $('inEmail').focus();
  });

  /* ===================================================== account dashboard */

  var HISTORY = [], FILTER = '';

  function paintProfile() {
    show($('authView'), false);
    show($('profileView'), true);

    var me = Shop.me;
    $('pName').textContent = me.name;
    $('pEmail').textContent = me.email;
    $('dName').textContent = me.name;
    $('dEmail').textContent = me.email;
    // Stored as 91XXXXXXXXXX; shown the way people read it.
    var p = String(me.phone || '').replace(/^91/, '');
    $('dPhone').textContent = p ? '+91 ' + p : '—';

    $('pInitials').textContent = me.name.split(/\s+/)
      .slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();

    loadBag();
    loadHistory();
  }

  $('signOutBtn').addEventListener('click', function () {
    Shop.signOut();
    location.href = 'index.html';
  });

  /* ---------------------------------------------------------------- tabs */

  Array.prototype.forEach.call($('acctTabs').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call($('acctTabs').querySelectorAll('button'), function (x) {
        x.classList.toggle('on', x === b);
      });
      ['bag', 'history', 'details'].forEach(function (p) {
        show($('pane-' + p), p === b.dataset.p);
      });
    });
  });

  /* --------------------------------------------------------------- my bag */

  function loadBag() {
    Shop.call({ action: 'cartList' }).then(function (r) {
      if (!r || !r.ok) return;
      Shop.setCart(r.totals.count);
      $('pBag').textContent = r.totals.count;

      show($('acctBagEmpty'), r.cart.length === 0);
      show($('acctBagCta'), r.cart.length > 0);

      $('acctBag').innerHTML = r.cart.map(function (l) {
        var img = l.image ? '<img src="' + S.esc(l.image) + '" alt="">' : '<div class="ph">श्री</div>';
        return '<div class="hist' + (l.stillFree ? '' : ' NO_SHOW') + '">' + img +
          '<div><h3>' + S.esc(l.name) + '</h3>' +
            '<div class="when">' + S.esc(S.dateOut(l.from)) + ' → ' + S.esc(S.dateOut(l.to)) +
              ' · ' + l.days + ' day' + (l.days === 1 ? '' : 's') + '</div>' +
            (l.stillFree ? '' :
              '<div class="hist-note" style="color:var(--busy)">Just taken for these dates — change them in your bag.</div>') +
          '</div>' +
          '<div class="hist-right"><span class="chip CONFIRMED">In bag</span>' +
            '<span class="amt">' + S.money(l.rent) + '</span></div>' +
          '</div>';
      }).join('');
    }).catch(function () { /* the dashboard still works without it */ });
  }

  /* ---------------------------------------------------------- my history */

  Array.prototype.forEach.call($('histFilter').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      FILTER = b.dataset.s;
      Array.prototype.forEach.call($('histFilter').querySelectorAll('button'), function (x) {
        x.classList.toggle('on', x === b);
      });
      renderHistory();
    });
  });

  function loadHistory() {
    Shop.call({ action: 'myBookings' }).then(function (r) {
      if (!r || !r.ok) return;
      HISTORY = r.bookings;

      var n = function (s) {
        return HISTORY.filter(function (b) { return b.status === s; }).length;
      };
      $('pPending').textContent = n('REQUESTED');
      $('pConfirmed').textContent = n('CONFIRMED');
      $('pDone').textContent = n('RETURNED') + n('PICKED_UP');

      renderHistory();
    }).catch(function () { /* non-critical */ });
  }

  /* Plain-English line telling her what happens next, per status. */
  var WHATS_NEXT = {
    REQUESTED: 'Waiting for the store to approve. You will get a WhatsApp message.',
    CONFIRMED: 'Approved — collect it from the store on your pickup date.',
    PICKED_UP: 'With you now. Please return it on the return date.',
    RETURNED:  'Returned, and your deposit was refunded. Thank you.',
    CANCELLED: 'This booking was cancelled.',
    NO_SHOW:   'The hold expired before it was confirmed.'
  };

  function renderHistory() {
    var rows = FILTER
      ? HISTORY.filter(function (b) { return b.status === FILTER; })
      : HISTORY;

    show($('acctHistEmpty'), rows.length === 0);

    $('acctHistory').innerHTML = rows.map(function (b) {
      var img = b.image ? '<img src="' + S.esc(b.image) + '" alt="">' : '<div class="ph">श्री</div>';
      return '<div class="hist ' + S.esc(b.status) + '">' + img +
        '<div>' +
          '<div class="ref">' + S.esc(b.ref) + '</div>' +
          '<h3>' + S.esc(b.item) + '</h3>' +
          '<div class="when">' + S.esc(S.dateOut(b.from)) + ' → ' + S.esc(S.dateOut(b.to)) +
            ' · ' + b.days + ' day' + (b.days === 1 ? '' : 's') + '</div>' +
        '</div>' +
        '<div class="hist-right">' +
          '<span class="chip ' + S.esc(b.status) + '">' +
            S.esc(b.status.replace('_', ' ')) + '</span>' +
          '<span class="amt">' + S.money(b.rent) + '</span>' +
        '</div>' +
        '<div class="hist-note">' + S.esc(WHATS_NEXT[b.status] || '') +
          (b.itemId && (b.status === 'PICKED_UP' || b.status === 'RETURNED')
            ? ' <a class="rate-link" href="item.html?id=' + encodeURIComponent(b.itemId) +
              '#reviewsBlock">★ Rate this piece</a>'
            : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* --------------------------------------------------------------- tabs */

  $('tabIn').addEventListener('click', function () { swap(true); });
  $('tabUp').addEventListener('click', function () { swap(false); });

  function swap(signIn) {
    $('tabIn').classList.toggle('on', signIn);
    $('tabUp').classList.toggle('on', !signIn);
    show($('formIn'), signIn);
    show($('formUp'), !signIn);
    (signIn ? $('inEmail') : $('upName')).focus();
  }

  /* ------------------------------------------------------------- sign in */

  $('formIn').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('inBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';

    Shop.signIn($('inEmail').value.trim(), $('inPass').value)
      .then(function (r) {
        btn.disabled = false; btn.textContent = 'Sign in';
        if (!r.ok) { flash($('inMsg'), r.error, 'err'); return; }
        location.href = next;
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Sign in';
        flash($('inMsg'), 'Could not reach the shop. Check your connection.', 'err');
      });
  });

  /* ------------------------------------------------------------ register */

  /* The +91 is printed beside the box, so only the 10 national digits are
     typed. Strip anything pasted in — people paste "+91 98765 43210". */
  $('upPhone').addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '');
    if (v.length === 12 && v.indexOf('91') === 0) v = v.slice(2);
    else if (v.length === 11 && v.charAt(0) === '0') v = v.slice(1);
    this.value = v.slice(0, 10);
  });

  $('formUp').addEventListener('submit', function (e) {
    e.preventDefault();

    var phone = $('upPhone').value.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      flash($('upMsg'), 'Enter a 10 digit Indian mobile number starting with 6, 7, 8 or 9.', 'err');
      $('upPhone').focus();
      return;
    }

    var pass = $('upPass').value;
    if (pass.length < 6) {
      flash($('upMsg'), 'Password must be at least 6 characters.', 'err');
      $('upPass').focus();
      return;
    }

    var btn = $('upBtn');
    btn.disabled = true; btn.textContent = 'Creating…';

    Shop.register({
      name: $('upName').value.trim(),
      email: $('upEmail').value.trim(),
      phone: '91' + phone,
      password: pass,
      address: $('upAddress').value.trim()
    }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Create account';
      if (!r.ok) { flash($('upMsg'), r.error, 'err'); return; }
      location.href = next;
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Create account';
      flash($('upMsg'), 'Could not reach the shop. Check your connection.', 'err');
    });
  });
})();
