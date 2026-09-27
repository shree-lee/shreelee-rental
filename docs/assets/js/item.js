/* One piece: gallery, price, date check, add to bag. */
(function () {
  'use strict';
  var S = window.Shree, Shop = window.Shop;

  var ITEM = null, CATS = [], BUSY = [], BUFFER = 1;

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hide', !on); }
  function flash(el, text, kind) { el.textContent = text; el.className = 'msg show ' + kind; }

  var params = new URLSearchParams(location.search);
  var ID = params.get('id') || '';

  document.addEventListener('shop:ready', function () {
    show($('loadingView'), false);

    if (!Shop.me || !S.configured()) {
      $('gateBtn').href = 'account.html?next=' +
        encodeURIComponent('item.html' + location.search);
      show($('gateView'), true);
      return;
    }
    if (!ID) { location.href = 'collection.html'; return; }
    load();
  });

  function load() {
    Shop.call({ action: 'item', id: ID, from: params.get('from'), to: params.get('to') })
      .then(function (r) {
        if (r && r.needLogin) { show($('gateView'), true); return; }
        if (!r || !r.ok) {
          document.body.innerHTML =
            '<div class="gate"><h2>Piece not found</h2><p class="lead">' +
            S.esc((r && r.error) || 'It may have been taken off the site.') +
            '</p><a class="btn btn-primary" href="collection.html">Back to the collection</a></div>';
          return;
        }
        ITEM = r.item;
        CATS = (r.config && r.config.categories) || [];
        BUFFER = (r.config && r.config.cleaningBufferDays) || 1;
        BUSY = ITEM.busy || [];
        paint();
        if (window.Reviews) window.Reviews.mount(ITEM);
        show($('itemView'), true);
        document.body.classList.add('has-cta');
      })
      .catch(function () {
        show($('gateView'), true);
        $('gateView').querySelector('h2').textContent = 'Could not reach the shop';
      });
  }

  /* --------------------------------------------------------------- paint */

  function paint() {
    document.title = ITEM.name + ' — श्रीली Rental Store';
    $('iName').textContent = ITEM.name;
    $('crumbCat').textContent = catName(ITEM.category);

    var tags = [];
    if (ITEM.subcategory) tags.push(catName(ITEM.subcategory));
    if (ITEM.size) tags.push('Size ' + ITEM.size);
    if (ITEM.colour) tags.push(ITEM.colour);
    if (ITEM.quantity > 1) tags.push(ITEM.quantity + ' available');
    if (ITEM.code) tags.push(ITEM.code);
    $('iMeta').innerHTML = tags.map(function (t) {
      return '<span class="tag">' + S.esc(t) + '</span>';
    }).join('');

    if (ITEM.rent === null) {
      $('iPrice').innerHTML = '<span class="price-now">Enquire</span>';
      $('iDeposit').textContent = 'Call the store for rates.';
    } else {
      $('iPrice').innerHTML =
        '<span class="price-now">' + S.money(ITEM.rent) + '</span>' +
        '<span class="price-note">per day</span>' +
        (ITEM.rentWas ? '<span class="price-was">' + S.money(ITEM.rentWas) + '</span>' +
          '<span class="price-off">' + ITEM.discount + '% off</span>' : '');
      $('iDeposit').textContent = ITEM.deposit
        ? 'Refundable deposit ' + S.money(ITEM.deposit) + ', returned when the piece comes back.'
        : '';
    }
    if (ITEM.offerNote) {
      $('iDeposit').innerHTML += '<br><strong>' + S.esc(ITEM.offerNote) + '</strong>' +
        (ITEM.offerUntil ? ' <span class="muted">till ' + S.dateOut(ITEM.offerUntil) + '</span>' : '');
    }

    $('iDesc').textContent = ITEM.description || '';
    paintGallery();

    var min = new Date().toISOString().slice(0, 10);
    $('bFrom').min = min; $('bTo').min = min;
    if (params.get('from')) $('bFrom').value = params.get('from');
    if (params.get('to')) $('bTo').value = params.get('to');
    recalc();
  }

  function isVideo(src) { return /\.(mp4|webm|mov)(\?|$)/i.test(String(src)); }

  function mainMedia(src) {
    return isVideo(src)
      ? '<video id="mainShot" src="' + S.esc(src) + '" autoplay muted loop playsinline></video>'
      : '<img id="mainShot" src="' + S.esc(src) + '" alt="' + S.esc(ITEM.name) + '">';
  }

  function paintGallery() {
    if (!ITEM.images.length) return;
    $('galMain').innerHTML = mainMedia(ITEM.images[0]);
    if (ITEM.images.length < 2) return;

    $('galStrip').innerHTML = ITEM.images.map(function (src, i) {
      var cls = i === 0 ? ' class="on"' : '';
      return isVideo(src)
        ? '<video src="' + S.esc(src) + '" muted playsinline preload="metadata" data-i="' + i + '"' + cls + '></video>'
        : '<img src="' + S.esc(src) + '" alt="" data-i="' + i + '"' + cls + ' loading="lazy">';
    }).join('');

    var thumbs = $('galStrip').querySelectorAll('img, video');
    Array.prototype.forEach.call(thumbs, function (t) {
      t.addEventListener('click', function () {
        $('galMain').innerHTML = mainMedia(ITEM.images[Number(t.dataset.i)]);
        Array.prototype.forEach.call(thumbs, function (x) { x.classList.toggle('on', x === t); });
      });
    });
  }

  function catName(slug) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].slug === slug) return CATS[i].name;
    return slug || '';
  }

  /* --------------------------------------------------------------- dates */

  $('bFrom').addEventListener('change', function () {
    $('bTo').min = $('bFrom').value || $('bTo').min;
    if ($('bTo').value && $('bTo').value < $('bFrom').value) $('bTo').value = $('bFrom').value;
    recalc();
  });
  $('bTo').addEventListener('change', recalc);

  function days(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
  }

  function addDays(iso, n) {
    var d = new Date(iso);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /** Mirrors the server's overlap rule so the answer is instant. */
  function clash(from, to) {
    for (var i = 0; i < BUSY.length; i++) {
      var b = BUSY[i];
      if (from <= addDays(b.to, BUFFER) && to >= b.from) return b;
    }
    return null;
  }

  function recalc() {
    var f = $('bFrom').value, t = $('bTo').value;
    var el = $('iAvail');

    if (!f || !t) {
      el.className = 'avail unknown';
      el.textContent = 'Pick your dates to check availability';
      $('bTotal').style.display = 'none';
      $('ctaPrice').textContent = ITEM.rent === null ? '' : S.money(ITEM.rent) + '/day';
      return true;
    }

    var n = days(f, t);
    var hit = ITEM.quantity > 1 ? null : clash(f, t);

    if (hit) {
      el.className = 'avail busy';
      el.textContent = 'Already booked for those dates — free from ' +
        S.dateOut(addDays(hit.to, 1));
    } else {
      el.className = 'avail free';
      el.textContent = 'Available for those dates';
    }

    if (ITEM.rent !== null) {
      var total = ITEM.rent * n;
      $('bTotal').style.display = 'flex';
      $('bDays').textContent = n + ' day' + (n === 1 ? '' : 's') +
        ' × ' + S.money(ITEM.rent);
      $('bAmount').textContent = S.money(total);
      $('ctaPrice').textContent = S.money(total);
    }
    return !hit;
  }

  /* ---------------------------------------------------------- add to bag */

  [$('addBtn'), $('ctaBtn')].forEach(function (b) {
    b.addEventListener('click', addToBag);
  });

  function addToBag() {
    var f = $('bFrom').value, t = $('bTo').value;
    if (!f || !t) {
      flash($('bMsg'), 'Pick your pickup and return dates first.', 'err');
      $('bFrom').focus();
      return;
    }
    if (!recalc()) {
      flash($('bMsg'), 'Those dates are taken. Try different ones.', 'err');
      return;
    }

    var btns = [$('addBtn'), $('ctaBtn')];
    btns.forEach(function (b) { b.disabled = true; });
    $('addBtn').textContent = 'Adding…';

    Shop.call({ action: 'cartAdd', itemId: ITEM.id, from: f, to: t })
      .then(function (r) {
        btns.forEach(function (b) { b.disabled = false; });
        $('addBtn').textContent = 'Add to bag';
        if (!r.ok) { flash($('bMsg'), r.error, 'err'); return; }
        Shop.setCart(r.totals.count);
        flash($('bMsg'), 'Added to your bag.', 'ok');
        $('addBtn').textContent = 'Added ✓';
        setTimeout(function () { location.href = 'cart.html'; }, 700);
      })
      .catch(function () {
        btns.forEach(function (b) { b.disabled = false; });
        $('addBtn').textContent = 'Add to bag';
        flash($('bMsg'), 'Could not add that. Try again.', 'err');
      });
  }
})();
