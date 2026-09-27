/* Storefront behaviour: header state, mobile nav, and the item grids. */
(function () {
  'use strict';
  var S = window.Shree;

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* --------------------------------------------------------- header state */

  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ------------------------------------------------------------ item card */

  var CAT_LABEL = {
    bridal: 'Bridal', festive: 'Festive',
    party: 'Party Wear', jewellery: 'Jewellery'
  };

  /**
   * An item is never simply in or out of stock — it is free, out, or back on
   * a known date. The pill says which, and a booked piece is greyed so the
   * grid reads at a glance.
   */
  function pill(item) {
    if (item.status === 'booked') {
      return '<span class="pill busy">Booked' +
        (item.freeFrom ? ' · back ' + S.dateOut(item.freeFrom) : '') + '</span>';
    }
    if (item.status === 'soon') {
      return '<span class="pill soon">Free from ' + S.dateOut(item.freeFrom) + '</span>';
    }
    return '<span class="pill free">Available</span>';
  }

  function card(item) {
    var img = item.image
      ? '<img src="' + S.esc(item.image) + '" alt="' + S.esc(item.name) + '" loading="lazy">'
      : '<span class="ph">श्री</span>';

    return '<a class="item' + (item.status === 'booked' ? ' is-busy' : '') +
      '" href="item.html?id=' + encodeURIComponent(item.id) + '">' +
      '<div class="item-shot">' + pill(item) + img +
        '<span class="item-look">View piece</span></div>' +
      '<div class="item-body">' +
        '<span class="item-cat">' + S.esc(CAT_LABEL[item.category] || item.category) +
          (item.size ? ' · ' + S.esc(item.size) : '') + '</span>' +
        '<span class="item-name">' + S.esc(item.name) + '</span>' +
        '<span class="item-price">' + S.money(item.rent) +
          ' <small>/ day</small></span>' +
      '</div></a>';
  }

  window.ShreeCards = { card: card, pill: pill, CAT_LABEL: CAT_LABEL };

  /* ------------------------------------------------------- featured grid */

  var grid = document.getElementById('featuredGrid');
  if (!grid) return;

  function render(items) {
    if (!items.length) {
      grid.innerHTML = '<p class="muted">Nothing listed yet.</p>';
      return;
    }
    grid.innerHTML = items.slice(0, 8).map(card).join('');
  }

  if (!S.configured()) {
    // No backend yet — show the sample stock so the layout can be judged.
    render(window.DEMO_ITEMS || []);
    var note = document.createElement('p');
    note.className = 'muted center';
    note.style.marginTop = '18px';
    note.textContent = 'Sample pieces shown — the real collection appears once the store’s sheet is connected.';
    grid.parentNode.insertBefore(note, grid.nextSibling);
    return;
  }

  S.post({ action: 'items', limit: 8 })
    .then(function (r) { render((r && r.ok && r.items) ? r.items : []); })
    .catch(function () { render(window.DEMO_ITEMS || []); });
})();
