/* The bag, checkout, and the customer's own booking history. */
(function () {
  'use strict';
  var S = window.Shree, Shop = window.Shop;

  var LINES = [];

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hide', !on); }
  function flash(el, text, kind) { el.textContent = text; el.className = 'msg show ' + kind; }

  document.addEventListener('shop:ready', function () {
    show($('loadingView'), false);
    if (!Shop.me || !S.configured()) { show($('gateView'), true); return; }
    show($('bagView'), true);
    loadBag();
    loadBookings();
  });

  /* ---------------------------------------------------------------- bag */

  function loadBag() {
    Shop.call({ action: 'cartList' }).then(function (r) {
      if (!r || !r.ok) { flash($('coMsg'), (r && r.error) || 'Could not load your bag.', 'err'); return; }
      LINES = r.cart;
      Shop.setCart(r.totals.count);
      paintBag(r.totals);
    }).catch(function () {
      flash($('coMsg'), 'Could not reach the shop.', 'err');
    });
  }

  function paintBag(totals) {
    show($('bagEmpty'), LINES.length === 0);
    show($('summaryBox'), LINES.length > 0);

    $('bagLines').innerHTML = LINES.map(function (l, i) {
      var img = l.image
        ? '<img src="' + S.esc(l.image) + '" alt="">'
        : '<div class="ph">श्री</div>';

      return '<div class="bag-line' + (l.stillFree ? '' : ' gone') + '">' +
        img +
        '<div>' +
          '<h3>' + S.esc(l.name) + '</h3>' +
          '<div class="when">' + S.esc(S.dateOut(l.from)) + ' → ' + S.esc(S.dateOut(l.to)) +
            ' · ' + l.days + ' day' + (l.days === 1 ? '' : 's') + '</div>' +
          (l.stillFree ? '' : '<div class="warn">Just taken for these dates — change them or remove it</div>') +
          '<button class="rm-btn" data-rm="' + i + '">Remove</button>' +
        '</div>' +
        '<div class="money"><b>' + S.money(l.rent) + '</b>' +
          '<span class="muted">+' + S.money(l.deposit) + ' dep.</span></div>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call($('bagLines').querySelectorAll('[data-rm]'), function (b) {
      b.addEventListener('click', function () { removeLine(LINES[Number(b.dataset.rm)], b); });
    });

    $('sCount').textContent = totals.count;
    $('sRent').textContent = S.money(totals.rent);
    $('sDep').textContent = S.money(totals.deposit);
    $('sTotal').textContent = S.money(totals.rent + totals.deposit);

    // A line that has been taken since it went in the bag blocks checkout.
    var blocked = LINES.some(function (l) { return !l.stillFree; });
    $('checkoutBtn').disabled = blocked || !LINES.length;
    if (blocked) {
      flash($('coMsg'), 'One piece is no longer free on those dates. Remove it or pick new dates.', 'err');
    }
  }

  function removeLine(line, btn) {
    btn.disabled = true; btn.textContent = 'Removing…';
    Shop.call({ action: 'cartRemove', id: line.id }).then(function (r) {
      if (!r || !r.ok) { btn.disabled = false; btn.textContent = 'Remove'; return; }
      LINES = r.cart;
      Shop.setCart(r.totals.count);
      $('coMsg').className = 'msg';
      paintBag(r.totals);
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Remove';
    });
  }

  /* ----------------------------------------------------------- checkout */

  $('checkoutBtn').addEventListener('click', function () {
    var btn = $('checkoutBtn');
    btn.disabled = true; btn.textContent = 'Sending…';

    Shop.call({ action: 'checkout', notes: $('notes').value })
      .then(function (r) {
        btn.disabled = false; btn.textContent = 'Request these dates';
        if (!r || !r.ok) { flash($('coMsg'), (r && r.error) || 'Could not send.', 'err'); loadBag(); return; }

        Shop.setCart(0);
        show($('bagView'), false);
        show($('doneView'), true);

        $('doneMsg').textContent = r.autoConfirmed
          ? 'Your pieces are confirmed. See you at the store.'
          : 'The store will confirm on WhatsApp, usually the same day. Your dates are held for ' +
            r.holdHours + ' hours.';

        $('doneList').innerHTML = r.bookings.map(function (b) {
          return '<div class="bag-line" style="grid-template-columns:1fr auto">' +
            '<div><h3>' + S.esc(b.item) + '</h3>' +
              '<div class="when">' + S.esc(S.dateOut(b.from)) + ' → ' +
              S.esc(S.dateOut(b.to)) + ' · ref <strong>' + S.esc(b.ref) + '</strong></div></div>' +
            '<div class="money"><b>' + S.money(b.rent) + '</b></div></div>';
        }).join('') +
        (r.clashed && r.clashed.length
          ? '<p class="msg err show">Could not book: ' + S.esc(r.clashed.join(', ')) +
            ' — just taken by someone else.</p>'
          : '');

        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Request these dates';
        flash($('coMsg'), 'Could not reach the shop. Try again.', 'err');
      });
  });

  /* -------------------------------------------------------- my bookings */

  function loadBookings() {
    Shop.call({ action: 'myBookings' }).then(function (r) {
      if (!r || !r.ok) return;
      if (!r.bookings.length) {
        $('myBookings').innerHTML =
          '<p class="muted">Nothing yet — your requests will appear here.</p>';
        return;
      }
      $('myBookings').innerHTML = r.bookings.map(function (b) {
        var img = b.image ? '<img src="' + S.esc(b.image) + '" alt="">' : '<div class="ph">श्री</div>';

        /* Once a piece has actually been out, invite the review from here —
           nobody goes hunting back through the collection to leave one. */
        var canRate = b.itemId && (b.status === 'PICKED_UP' || b.status === 'RETURNED');
        var rate = canRate
          ? '<a class="rate-link" href="item.html?id=' + encodeURIComponent(b.itemId) +
            '#reviewsBlock">★ Rate this piece</a>'
          : '';

        return '<div class="bk-card">' + img +
          '<div><div class="ref">' + S.esc(b.ref) + '</div>' +
            '<h3>' + S.esc(b.item) + '</h3>' +
            '<div class="when muted">' + S.esc(S.dateOut(b.from)) + ' → ' +
              S.esc(S.dateOut(b.to)) + '</div>' + rate + '</div>' +
          '<div style="text-align:right">' +
            '<span class="chip ' + S.esc(b.status) + '">' +
              S.esc(b.status.replace('_', ' ')) + '</span>' +
            '<div class="muted" style="margin-top:6px">' + S.money(b.rent) + '</div>' +
          '</div></div>';
      }).join('');
    }).catch(function () { /* history is not critical */ });
  }
})();
