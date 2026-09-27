/* The collection grid: category + type + date filters, members only. */
(function () {
  'use strict';
  var S = window.Shree, Shop = window.Shop;

  var CATS = [], ALL = [], FLAG = '';

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hide', !on); }

  var params = new URLSearchParams(location.search);

  document.addEventListener('shop:ready', function () {
    show($('loadingView'), false);

    if (!S.configured()) {
      show($('gateView'), true);
      $('gateView').querySelector('.lead').textContent =
        'The shop is not connected yet. Once the store’s sheet is linked, the collection appears here.';
      return;
    }
    if (!Shop.me) { show($('gateView'), true); return; }

    show($('shopView'), true);
    $('from').min = new Date().toISOString().slice(0, 10);
    $('to').min = $('from').min;

    if (params.get('cat')) $('cat').value = params.get('cat');
    load();
  });

  /* ------------------------------------------------------------- filters */

  var timer;
  ['q'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      clearTimeout(timer); timer = setTimeout(render, 250);
    });
  });
  $('cat').addEventListener('change', function () { syncTypes(); load(); });
  $('sub').addEventListener('change', render);

  /* Quick flags beside the category chips: on offer, and free today. Both
     filter what is already loaded, so they answer instantly. Tapping the
     same one again clears it. */
  Array.prototype.forEach.call($('quickFlags').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      FLAG = (FLAG === b.dataset.flag) ? '' : b.dataset.flag;
      Array.prototype.forEach.call($('quickFlags').querySelectorAll('button'), function (x) {
        x.classList.toggle('on', x.dataset.flag === FLAG);
      });
      render();
    });
  });

  // Pickup must come before return; nudge the return date rather than erroring.
  $('from').addEventListener('change', function () {
    $('to').min = $('from').value || $('from').min;
    if ($('to').value && $('to').value < $('from').value) $('to').value = $('from').value;
    load();
  });
  $('to').addEventListener('change', load);

  function syncTypes() {
    var parent = $('cat').value;
    var kids = CATS.filter(function (c) { return c.parent === parent; });
    $('sub').innerHTML = '<option value="">All types</option>' +
      kids.map(function (c) {
        return '<option value="' + S.esc(c.slug) + '">' + S.esc(c.name) + '</option>';
      }).join('');
    show($('sub').parentNode, kids.length > 0);
  }

  function paintCats() {
    var tops = CATS.filter(function (c) { return !c.parent; });
    $('cat').innerHTML = '<option value="">All occasions</option>' +
      tops.map(function (c) {
        return '<option value="' + S.esc(c.slug) + '">' + S.esc(c.name) + '</option>';
      }).join('');
    if (params.get('cat')) $('cat').value = params.get('cat');

    $('quickCats').innerHTML =
      '<button data-slug="">Everything</button>' +
      tops.map(function (c) {
        return '<button data-slug="' + S.esc(c.slug) + '">' + S.esc(c.name) + '</button>';
      }).join('');

    Array.prototype.forEach.call($('quickCats').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.slug === $('cat').value);
      b.addEventListener('click', function () {
        $('cat').value = b.dataset.slug;
        syncTypes();
        load();
      });
    });
    syncTypes();
  }

  /* ---------------------------------------------------------------- load */

  function load() {
    $('grid').innerHTML =
      '<div class="skeleton sk-card"></div><div class="skeleton sk-card"></div>' +
      '<div class="skeleton sk-card"></div><div class="skeleton sk-card"></div>';
    show($('emptyState'), false);

    var both = $('from').value && $('to').value;

    Shop.call({ action: 'catalog',
      category: $('cat').value,
      from: both ? $('from').value : '',
      to: both ? $('to').value : ''
    }).then(function (r) {
      if (r && r.needLogin) { show($('shopView'), false); show($('gateView'), true); return; }
      if (!r || !r.ok) {
        $('grid').innerHTML = '';
        $('resultCount').textContent = (r && r.error) || 'Could not load the collection.';
        return;
      }
      CATS = r.categories || CATS;
      if (!$('cat').options.length || $('cat').options.length === 1) paintCats();
      Array.prototype.forEach.call($('quickCats').querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b.dataset.slug === $('cat').value);
      });
      ALL = r.items || [];
      render();
    }).catch(function () {
      $('grid').innerHTML = '';
      $('resultCount').textContent = 'Could not reach the shop.';
    });
  }

  /* -------------------------------------------------------------- render */

  function render() {
    var q = $('q').value.trim().toLowerCase();
    var sub = $('sub').value;

    var rows = ALL.filter(function (i) {
      if (sub && i.subcategory !== sub) return false;
      if (FLAG === 'offers' && !i.discount) return false;
      if (FLAG === 'available' && i.status !== 'available') return false;
      if (!q) return true;
      return [i.name, i.colour, i.size, i.code, i.description]
        .some(function (v) { return String(v || '').toLowerCase().indexOf(q) > -1; });
    });

    $('grid').innerHTML = rows.map(card).join('');
    show($('emptyState'), rows.length === 0);

    var dated = $('from').value && $('to').value;
    $('resultCount').textContent = rows.length
      ? rows.length + ' piece' + (rows.length === 1 ? '' : 's') +
        (dated ? ' free from ' + S.dateOut($('from').value) + ' to ' + S.dateOut($('to').value) : '')
      : '';
  }

  function card(i) {
    var cover = i.images[0] || '';
    var img = !cover ? '<span class="ph">श्री</span>'
      : /\.(mp4|webm|mov)(\?|$)/i.test(cover)
        ? '<video src="' + S.esc(cover) + '" muted loop playsinline preload="metadata"></video>'
        : '<img src="' + S.esc(cover) + '" alt="' + S.esc(i.name) + '" loading="lazy">';

    var pill = i.status === 'booked'
      ? '<span class="pill busy">Booked' + (i.freeFrom ? ' · back ' + S.dateOut(i.freeFrom) : '') + '</span>'
      : i.status === 'soon'
        ? '<span class="pill soon">Free from ' + S.dateOut(i.freeFrom) + '</span>'
        : '<span class="pill free">Available</span>';

    var price = i.rent === null
      ? '<span class="muted">Enquire</span>'
      : S.money(i.rent) + ' <small>/ day</small>' +
        (i.rentWas ? ' <s class="muted">' + S.money(i.rentWas) + '</s>' : '');

    // Carry the chosen dates into the item page so the picker is pre-filled.
    var qs = '?id=' + encodeURIComponent(i.id) +
      ($('from').value && $('to').value
        ? '&from=' + $('from').value + '&to=' + $('to').value : '');

    return '<a class="item' + (i.status === 'booked' ? ' is-busy' : '') +
      '" href="item.html' + qs + '">' +
      '<div class="item-shot">' + pill + img +
        (i.discount ? '<span class="pill soon" style="left:auto;right:10px">' +
          i.discount + '% off</span>' : '') +
        '<span class="item-look">View piece</span></div>' +
      '<div class="item-body">' +
        '<span class="item-cat">' + S.esc(catName(i.subcategory || i.category)) +
          (i.size ? ' · ' + S.esc(i.size) : '') + '</span>' +
        '<span class="item-name">' + S.esc(i.name) + '</span>' +
        '<span class="item-price">' + price + '</span>' +
      '</div></a>';
  }

  function catName(slug) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].slug === slug) return CATS[i].name;
    return slug || '';
  }
})();
