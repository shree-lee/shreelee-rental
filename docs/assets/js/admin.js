/* =========================================================================
   श्रीली — staff panel
   Dashboard · collection · bookings · enquiries · categories · reports
   ========================================================================= */
(function () {
  'use strict';
  var S = window.Shree;

  var TOKEN = null, USER = null, CFG = null, TAB = 'dash';
  var ITEMS = [], BOOKINGS = [], ENQS = [], CATS = [], SHOTS = [], EDIT_ID = null, EQ_ID = null;

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hide', !on); }

  function flash(el, text, kind) {
    el.textContent = text;
    el.className = 'msg show ' + kind;
    if (kind === 'ok') setTimeout(function () { el.className = 'msg'; }, 4000);
  }

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private */ } }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function forget(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /** Any call that comes back expired sends the user to the login screen. */
  function dead(r) {
    if (r && r.expired) {
      forget('shreeToken');
      alert('Your session has ended. Please sign in again.');
      location.reload();
      return true;
    }
    return false;
  }

  function api(payload) {
    payload.token = TOKEN;
    return S.post(payload);
  }

  /* ================================================================ auth */

  function showLogin() {
    show($('bootView'), false);
    show($('loginView'), true);
    $('userId').focus();
  }

  var saved = recall('shreeToken');
  if (saved && S.configured()) {
    S.post({ action: 'ping', token: saved })
      .then(function (r) {
        if (r && r.ok) { TOKEN = saved; USER = r.user; CFG = r.config; enter(); }
        else { forget('shreeToken'); showLogin(); }
      })
      .catch(showLogin);
  } else {
    showLogin();
  }

  $('loginBtn').addEventListener('click', doLogin);
  $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  $('userId').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('password').focus(); });

  (function passwordEye() {
    var btn = $('pwToggle'), f = $('password');
    var slash = btn.querySelector('.eye-slash');
    btn.addEventListener('click', function () {
      var reveal = f.type === 'password';
      f.type = reveal ? 'text' : 'password';
      btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      slash.setAttribute('opacity', reveal ? '1' : '0');
      var label = reveal ? 'Hide password' : 'Show password';
      btn.setAttribute('aria-label', label); btn.title = label;
      f.focus();
    });
  })();

  function doLogin() {
    if (!S.configured()) {
      flash($('loginMsg'), 'The panel is not connected yet — paste the Apps Script url into assets/js/config.js.', 'err');
      return;
    }
    var btn = $('loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    S.post({ action: 'login',
      userId: $('userId').value.trim().toLowerCase(),
      password: $('password').value })
      .then(function (r) {
        btn.disabled = false; btn.textContent = 'Sign in';
        if (!r.ok) { flash($('loginMsg'), r.error, 'err'); return; }
        TOKEN = r.token; USER = r.user; CFG = r.config;
        store('shreeToken', TOKEN);
        enter();
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Sign in';
        flash($('loginMsg'), 'Could not reach the server. Check your connection.', 'err');
      });
  }

  $('logoutBtn').addEventListener('click', function () {
    api({ action: 'logout' });
    forget('shreeToken'); forget('shreeTab');
    location.reload();
  });

  function enter() {
    show($('bootView'), false);
    show($('loginView'), false);
    show($('appView'), true);
    $('whoName').textContent = USER.name;
    $('whoRole').textContent = USER.role === 'admin' ? 'Admin' : 'Staff';
    CATS = (CFG && CFG.categories) || [];
    fillCategorySelects();
    var last = recall('shreeTab');
    switchTab(['dash','approvals','items','bookings','enquiries','categories','reports']
      .indexOf(last) > -1 ? last : 'dash');
  }

  /* ================================================================ tabs */

  Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });

  function switchTab(tab) {
    TAB = tab;
    store('shreeTab', tab);
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    ['dash','approvals','items','bookings','enquiries','categories','reports'].forEach(function (t) {
      show($('panel-' + t), t === tab);
    });

    if (tab === 'dash') loadDash();
    if (tab === 'approvals') loadApprovals();
    if (tab === 'items') loadItems();
    if (tab === 'bookings') loadBookings();
    if (tab === 'enquiries') loadEnquiries();
    if (tab === 'categories') renderCats();
    if (tab === 'reports') { if (!$('repFrom').value) quickRange('30'); runReport(); }
  }

  /* ---------------------------------------------------------- shared bits */

  function loadingRow(cols, text) {
    return '<tr><td colspan="' + cols + '" class="loading-row">' +
      '<span class="spin"></span>' + (text || 'Loading…') + '</td></tr>';
  }
  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '" class="empty">' + S.esc(text) + '</td></tr>';
  }
  function chip(v) { return '<span class="chip ' + S.esc(v) + '">' + S.esc(String(v).replace('_',' ')) + '</span>'; }

  function fillCategorySelects() {
    var tops = CATS.filter(function (c) { return !c.parent; });
    var opts = function (list, blank) {
      return (blank ? '<option value="">' + blank + '</option>' : '') +
        list.map(function (c) {
          return '<option value="' + S.esc(c.slug) + '">' + S.esc(c.name) + '</option>';
        }).join('');
    };
    $('itemCat').innerHTML = opts(tops, 'All categories');
    $('fCategory').innerHTML = opts(tops, '');
    $('cParent').innerHTML = opts(tops, '— none, this is a main category —');
    syncSubcategories();
  }

  /** Types follow the chosen category. */
  function syncSubcategories() {
    var parent = $('fCategory').value;
    var kids = CATS.filter(function (c) { return c.parent === parent; });
    $('fSubcategory').innerHTML = '<option value="">—</option>' +
      kids.map(function (c) {
        return '<option value="' + S.esc(c.slug) + '">' + S.esc(c.name) + '</option>';
      }).join('');
  }
  $('fCategory').addEventListener('change', syncSubcategories);

  /* =========================================================== dashboard */

  $('dashRefresh').addEventListener('click', loadDash);

  function loadDash() {
    $('dashStats').innerHTML = '';
    $('dashTable').innerHTML = loadingRow(6);

    api({ action: 'dashboard' }).then(function (d) {
      if (dead(d)) return;
      if (!d.ok) { $('dashTable').innerHTML = emptyRow(6, d.error); return; }

      $('dashStats').innerHTML =
        stat('Waiting to confirm', d.pending, 'requests', d.pending ? 'alert' : '') +
        stat('Out with customers', d.outNow, 'pieces', '') +
        stat('Due back', d.dueBack, 'today or overdue', d.dueBack ? 'alert' : '') +
        stat('Pieces listed', d.itemsActive, 'of ' + d.itemsTotal + ' total', 'good');

      return api({ action: 'bookings', filter: { status: 'REQUESTED' } });
    }).then(function (r) {
      if (!r || dead(r)) return;
      if (!r.ok) return;
      renderBookingRows($('dashTable'), r.bookings,
        'Nothing waiting — everything is up to date.');
    }).catch(function () {
      $('dashTable').innerHTML = emptyRow(6, 'Could not load the dashboard.');
    });
  }

  function stat(k, v, s, cls) {
    return '<div class="stat ' + cls + '"><div class="k">' + S.esc(k) +
      '</div><div class="v">' + S.esc(v) + '</div><div class="s">' + S.esc(s) + '</div></div>';
  }

  /* =========================================================== approvals */

  $('apRefresh').addEventListener('click', loadApprovals);

  function loadApprovals() {
    $('apTable').innerHTML = loadingRow(7, 'Checking for new requests…');
    api({ action: 'bookings', filter: { status: 'REQUESTED' } })
      .then(function (r) {
        if (dead(r)) return;
        if (!r.ok) { $('apTable').innerHTML = emptyRow(7, r.error); return; }
        renderBookingRows($('apTable'), r.bookings,
          'Nothing waiting. Every request has been dealt with.');
        var n = r.bookings.length;
        $('cntApprovals').textContent = n;
        show($('cntApprovals'), n > 0);
      })
      .catch(function () { $('apTable').innerHTML = emptyRow(7, 'Could not load requests.'); });
  }

  /* =============================================================== items */

  ['itemQ'].forEach(function (id) {
    var t; $(id).addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(loadItems, 320);
    });
  });
  $('itemCat').addEventListener('change', loadItems);
  $('itemStatus').addEventListener('change', loadItems);
  $('itemClear').addEventListener('click', function () {
    $('itemQ').value = ''; $('itemCat').value = ''; $('itemStatus').value = '';
    loadItems();
  });

  function loadItems() {
    $('itemTable').innerHTML = loadingRow(7);
    api({ action: 'allItems', filter: {
      q: $('itemQ').value, category: $('itemCat').value, status: $('itemStatus').value
    }}).then(function (r) {
      if (dead(r)) return;
      if (!r.ok) { $('itemTable').innerHTML = emptyRow(7, r.error); return; }
      ITEMS = r.items;
      if (r.categories) { CATS = r.categories; }
      renderItems();
    }).catch(function () {
      $('itemTable').innerHTML = emptyRow(7, 'Could not load the collection.');
    });
  }

  function renderItems() {
    if (!ITEMS.length) {
      $('itemTable').innerHTML = emptyRow(7, 'No pieces yet. Use “Add piece” to list the first one.');
      $('itemCount').textContent = '0 pieces';
      return;
    }
    var head = '<tr><th>Order</th><th></th><th>Piece</th><th>Category</th><th>Size</th>' +
      '<th class="amt">Rent</th><th>Status</th><th class="actions"></th></tr>';

    var body = ITEMS.map(function (it, i) {
      var img = it.images.length
        ? '<img class="thumb" src="' + S.esc(it.images[0]) + '" alt="" loading="lazy">'
        : '<div class="thumb ph">श्री</div>';

      var price = it.rentWas
        ? S.money(it.rent) + ' <s class="muted">' + S.money(it.rentWas) + '</s>'
        : S.money(it.rent);

      // Reorder straight from the list — opening a modal to change one
      // number is exactly the friction that stops people curating at all.
      var order = '<td class="seq">' +
        '<button class="seq-btn" data-up="' + i + '" title="Move up"' +
          (i === 0 ? ' disabled' : '') + '>▲</button>' +
        '<span class="seq-n">' + (it.sequence === 999 ? '–' : it.sequence) + '</span>' +
        '<button class="seq-btn" data-down="' + i + '" title="Move down"' +
          (i === ITEMS.length - 1 ? ' disabled' : '') + '>▼</button>' +
        '</td>';

      return '<tr>' + order +
        '<td>' + img + '</td>' +
        '<td><strong>' + S.esc(it.name) + '</strong><br>' +
          '<span class="muted">' + S.esc(it.code) +
          (it.quantity > 1 ? ' · ' + it.quantity + ' copies' : '') + '</span></td>' +
        '<td>' + S.esc(catName(it.category)) +
          (it.subcategory ? '<br><span class="muted">' + S.esc(catName(it.subcategory)) + '</span>' : '') + '</td>' +
        '<td>' + S.esc(it.size || '—') + '</td>' +
        '<td class="amt">' + price +
          (it.discount ? '<br>' + chip('offer') : '') + '</td>' +
        '<td>' + chip(it.itemStatus) + '</td>' +
        '<td class="actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + i + '">Edit</button>' +
          (USER.role === 'admin' && it.itemStatus !== 'RETIRED'
            ? ' <button class="btn btn-ghost btn-sm" data-retire="' + i + '">Retire</button>' : '') +
        '</td></tr>';
    }).join('');

    $('itemTable').innerHTML = head + body;
    $('itemCount').textContent = ITEMS.length + ' piece' + (ITEMS.length === 1 ? '' : 's');

    wire($('itemTable'), 'edit', function (i) { openItem(ITEMS[i]); });
    wire($('itemTable'), 'retire', function (i, btn) { retireItem(ITEMS[i], btn); });
    wire($('itemTable'), 'up', function (i) { reorder(i, -1); });
    wire($('itemTable'), 'down', function (i) { reorder(i, 1); });
  }

  /**
   * Swaps a piece with its neighbour in the displayed order. Positions are
   * rewritten as 10, 20, 30… so there is always room to slot something in
   * between later without renumbering the whole collection.
   */
  function reorder(index, dir) {
    var target = index + dir;
    if (target < 0 || target >= ITEMS.length) return;

    var a = ITEMS[index], b = ITEMS[target];
    ITEMS[index] = b; ITEMS[target] = a;

    var rows = $('itemTable').querySelectorAll('tbody tr, tr');
    Array.prototype.forEach.call(rows, function (tr) { tr.classList.add('row-busy'); });

    // Renumber only the pair that moved, keeping the request small.
    var seqA = (target + 1) * 10, seqB = (index + 1) * 10;
    Promise.all([
      api({ action: 'saveItem', item: { ID: a.id, Sequence: seqA } }),
      api({ action: 'saveItem', item: { ID: b.id, Sequence: seqB } })
    ]).then(function (res) {
      if (res.some(function (r) { return dead(r); })) return;
      var bad = res.filter(function (r) { return !r.ok; })[0];
      if (bad) { alert(bad.error); }
      loadItems();
    }).catch(function () {
      alert('Could not save the new order.');
      loadItems();
    });
  }

  function catName(slug) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].slug === slug) return CATS[i].name;
    return slug || '—';
  }

  function wire(root, attr, fn) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-' + attr + ']'), function (b) {
      b.addEventListener('click', function () { fn(Number(b.dataset[attr]), b); });
    });
  }

  function retireItem(it, btn) {
    if (!confirm('Retire “' + it.name + '”?\n\nIt disappears from the website but stays\n' +
      'in past bookings. You can set it back to ACTIVE later.')) return;
    var tr = btn.closest('tr');
    if (tr) tr.classList.add('row-busy');
    api({ action: 'deleteItem', id: it.id }).then(function (r) {
      if (dead(r)) return;
      if (!r.ok) { alert(r.error); if (tr) tr.classList.remove('row-busy'); return; }
      loadItems();
    }).catch(function () {
      if (tr) tr.classList.remove('row-busy');
      alert('Could not retire that piece.');
    });
  }

  /* ---------------------------------------------------------- item modal */

  $('addItemBtn').addEventListener('click', function () { openItem(null); });

  function openItem(it) {
    EDIT_ID = it ? it.id : null;
    $('itemModalTitle').textContent = it ? 'Edit piece' : 'Add a piece';
    $('itemMsg').className = 'msg';

    $('fName').value = it ? it.name : '';
    $('fCategory').value = it ? it.category : ($('fCategory').options[0] || {}).value || '';
    syncSubcategories();
    $('fSubcategory').value = it ? it.subcategory : '';
    $('fCode').value = it ? it.code : '';
    $('fSize').value = it ? it.size : '';
    $('fColour').value = it ? it.colour : '';
    $('fQuantity').value = it ? it.quantity : 1;
    $('fRent').value = it ? (it.rentWas || it.rent || '') : '';
    $('fDeposit').value = it ? it.deposit : '';
    $('fSequence').value = it && it.sequence !== 999 ? it.sequence : '';
    $('fDiscount').value = it ? it.discount : 0;
    $('fOfferUntil').value = it ? it.offerUntil : '';
    $('fOfferNote').value = it ? it.offerNote : '';
    $('fDescription').value = it ? it.description : '';
    $('fStatus').value = it ? it.itemStatus : 'ACTIVE';

    SHOTS = it ? it.images.slice() : [];
    renderShots();
    openModal('itemModal');
  }

  function isVideo(src) { return /\.(mp4|webm|mov)(\?|$)/i.test(String(src)); }

  function renderShots() {
    $('shots').innerHTML = SHOTS.map(function (src, i) {
      var media = isVideo(src)
        ? '<video src="' + S.esc(src) + '" muted playsinline preload="metadata"></video>' +
          '<span class="shot-tag">VIDEO</span>'
        : '<img src="' + S.esc(src) + '" alt="">';
      return '<div class="shot">' + media +
        '<button class="x" data-rm="' + i + '" title="Remove">✕</button>' +
        '<span class="mv">' +
          (i > 0 ? '<button data-left="' + i + '" title="Move earlier">←</button>' : '') +
          (i < SHOTS.length - 1 ? '<button data-right="' + i + '" title="Move later">→</button>' : '') +
        '</span></div>';
    }).join('');

    wire($('shots'), 'rm', function (i) { SHOTS.splice(i, 1); renderShots(); });
    wire($('shots'), 'left', function (i) { swap(i, i - 1); });
    wire($('shots'), 'right', function (i) { swap(i, i + 1); });
  }

  function swap(a, b) {
    var t = SHOTS[a]; SHOTS[a] = SHOTS[b]; SHOTS[b] = t;
    renderShots();
  }

  /* Videos are referenced by path rather than uploaded — see the note in
     admin.html. Validated here so a typo does not become a dead tile. */
  $('vidAddBtn').addEventListener('click', function () {
    var v = $('vidUrl').value.trim();
    if (!v) { $('vidUrl').focus(); return; }
    if (!isVideo(v)) {
      flash($('itemMsg'), 'That must end in .mp4, .webm or .mov', 'err');
      return;
    }
    if (SHOTS.indexOf(v) > -1) {
      flash($('itemMsg'), 'That video is already on this piece.', 'err');
      return;
    }
    if (SHOTS.length >= 8) {
      flash($('itemMsg'), 'Eight items of media is plenty — remove one first.', 'err');
      return;
    }
    SHOTS.push(v);
    $('vidUrl').value = '';
    renderShots();
    flash($('itemMsg'), 'Video added.', 'ok');
  });

  /* ------------------------------------------------------- image upload */

  var drop = $('dropZone');
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });
  $('fileInput').addEventListener('change', function (e) {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  /**
   * Resize in the browser before uploading. A phone photo is 3-5MB; the
   * catalogue never needs more than ~1200px, which lands around 150KB.
   * Doing it here means the upload is fast and the repo stays small.
   */
  function shrink(file, maxPx) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That file is not an image.')); };
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxPx / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * scale);
          c.height = Math.round(h * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /** Reads a video straight through — it cannot be resized in the browser. */
  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(new Error('Could not read that file.')); };
      r.onload = function () { resolve(r.result); };
      r.readAsDataURL(file);
    });
  }

  var VIDEO_CAP_MB = 12;

  function handleFiles(files) {
    var list = Array.prototype.slice.call(files).filter(function (f) {
      return /^(image|video)\//.test(f.type);
    });
    if (!list.length) return;

    if (SHOTS.length + list.length > 8) {
      flash($('itemMsg'), 'Eight items of media per piece is plenty — remove one first.', 'err');
      return;
    }

    // Catch an oversized clip here rather than after a long upload.
    var tooBig = list.filter(function (f) {
      return /^video\//.test(f.type) && f.size > VIDEO_CAP_MB * 1024 * 1024;
    });
    if (tooBig.length) {
      flash($('itemMsg'), tooBig[0].name + ' is ' +
        (tooBig[0].size / 1048576).toFixed(1) + 'MB. Videos must be under ' +
        VIDEO_CAP_MB + 'MB — trim it to about 15 seconds.', 'err');
      return;
    }

    flash($('itemMsg'), 'Uploading ' + list.length + ' file(s)…', 'ok');

    list.reduce(function (chain, file) {
      return chain.then(function () {
        var isVid = /^video\//.test(file.type);
        // Photos shrink first; videos go up as they are.
        var prep = isVid ? readAsDataUrl(file) : shrink(file, 1200);

        return prep.then(function (dataUrl) {
          if (isVid) {
            flash($('itemMsg'), 'Uploading ' + file.name + ' (' +
              (file.size / 1048576).toFixed(1) + 'MB) — this takes a moment…', 'ok');
          }
          return api({ action: 'uploadImage',
            name: $('fName').value || file.name, dataUrl: dataUrl });
        }).then(function (r) {
          if (dead(r)) throw new Error('expired');
          if (!r.ok) throw new Error(r.error);
          SHOTS.push(r.url);
          renderShots();
        });
      });
    }, Promise.resolve())
      .then(function () { flash($('itemMsg'), 'Media added.', 'ok'); })
      .catch(function (e) {
        if (e.message === 'expired') return;
        flash($('itemMsg'), e.message || 'Upload failed.', 'err');
      });
  }

  $('itemSave').addEventListener('click', function () {
    var btn = $('itemSave');
    var item = {
      ID: EDIT_ID,
      Name: $('fName').value, Category: $('fCategory').value,
      Subcategory: $('fSubcategory').value, Code: $('fCode').value,
      Size: $('fSize').value, Colour: $('fColour').value,
      Quantity: $('fQuantity').value, Rent: $('fRent').value,
      Deposit: $('fDeposit').value, Sequence: $('fSequence').value || 999,
      Discount: $('fDiscount').value, OfferUntil: $('fOfferUntil').value,
      OfferNote: $('fOfferNote').value, Description: $('fDescription').value,
      Status: $('fStatus').value, Images: SHOTS.join(',')
    };

    btn.disabled = true; btn.textContent = 'Saving…';
    api({ action: 'saveItem', item: item }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Save piece';
      if (dead(r)) return;
      if (!r.ok) { flash($('itemMsg'), r.error, 'err'); return; }
      closeModal('itemModal');
      loadItems();
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Save piece';
      flash($('itemMsg'), 'Could not save. Try again.', 'err');
    });
  });

  /* ============================================================ bookings */

  ['bkQ'].forEach(function (id) {
    var t; $(id).addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(loadBookings, 320);
    });
  });
  $('bkStatus').addEventListener('change', loadBookings);
  $('bkClear').addEventListener('click', function () {
    $('bkQ').value = ''; $('bkStatus').value = ''; loadBookings();
  });

  function loadBookings() {
    $('bkTable').innerHTML = loadingRow(7);
    api({ action: 'bookings', filter: { q: $('bkQ').value, status: $('bkStatus').value } })
      .then(function (r) {
        if (dead(r)) return;
        if (!r.ok) { $('bkTable').innerHTML = emptyRow(7, r.error); return; }
        BOOKINGS = r.bookings;
        renderBookingRows($('bkTable'), BOOKINGS, 'No bookings match that.');
        $('bkCount').textContent = r.count + ' booking' + (r.count === 1 ? '' : 's');

        var pending = BOOKINGS.filter(function (b) { return b.status === 'REQUESTED'; }).length;
        $('cntBookings').textContent = pending;
        show($('cntBookings'), pending > 0);
      })
      .catch(function () { $('bkTable').innerHTML = emptyRow(7, 'Could not load bookings.'); });
  }

  /* Which buttons make sense depends on where the booking has got to. */
  var NEXT = {
    REQUESTED: [['CONFIRMED', 'Confirm'], ['CANCELLED', 'Decline']],
    CONFIRMED: [['PICKED_UP', 'Picked up'], ['CANCELLED', 'Cancel'], ['NO_SHOW', 'No show']],
    PICKED_UP: [['RETURNED', 'Returned']],
    RETURNED: [], CANCELLED: [], NO_SHOW: []
  };

  function renderBookingRows(table, rows, emptyText) {
    if (!rows.length) { table.innerHTML = emptyRow(7, emptyText); return; }

    var head = '<tr><th>Ref</th><th>Piece</th><th>Customer</th><th>Dates</th>' +
      '<th class="amt">Rent</th><th>Status</th><th class="actions"></th></tr>';

    var body = rows.map(function (b, i) {
      var acts = (NEXT[b.status] || []).map(function (n) {
        return '<button class="btn btn-ghost btn-sm" data-act="' + i +
          '" data-next="' + n[0] + '">' + n[1] + '</button>';
      }).join(' ');

      return '<tr>' +
        '<td><strong>' + S.esc(b.ref) + '</strong></td>' +
        '<td>' + S.esc(b.item) + '<br><span class="muted">' + S.esc(b.itemCode) + '</span></td>' +
        '<td>' + S.esc(b.customer) + '<br>' +
          '<a class="muted" href="tel:+91' + S.esc(b.phone) + '">' + S.esc(b.phone) + '</a> ' +
          '<a class="muted" href="https://wa.me/91' + S.esc(b.phone) + '" target="_blank" rel="noopener">WA</a></td>' +
        '<td>' + S.esc(S.dateOut(b.from)) + '<br><span class="muted">to ' +
          S.esc(S.dateOut(b.to)) + ' · ' + b.days + 'd</span></td>' +
        '<td class="amt">' + S.money(b.rent) +
          '<br><span class="muted">+' + S.money(b.deposit) + '</span></td>' +
        '<td>' + chip(b.status) + '</td>' +
        '<td class="actions">' + acts + '</td></tr>';
    }).join('');

    table.innerHTML = head + body;

    Array.prototype.forEach.call(table.querySelectorAll('[data-act]'), function (btn) {
      btn.addEventListener('click', function () {
        var b = rows[Number(btn.dataset.act)];
        var next = btn.dataset.next;
        if (next === 'CANCELLED' || next === 'NO_SHOW') {
          if (!confirm('Mark ' + b.ref + ' as ' + next.replace('_', ' ') + '?\n\n' +
            'The dates free up immediately.')) return;
        }
        var tr = btn.closest('tr');
        if (tr) tr.classList.add('row-busy');
        api({ action: 'setStatus', id: b.id, status: next }).then(function (r) {
          if (dead(r)) return;
          if (!r.ok) { alert(r.error); if (tr) tr.classList.remove('row-busy'); return; }
          if (TAB === 'dash') loadDash();
          else if (TAB === 'approvals') loadApprovals();
          else loadBookings();
        }).catch(function () {
          if (tr) tr.classList.remove('row-busy');
          alert('Could not update that booking.');
        });
      });
    });
  }

  $('bkCsv').addEventListener('click', function () {
    if (!BOOKINGS.length) { alert('Nothing to download.'); return; }
    var cols = ['ref','item','customer','phone','from','to','days','status','rent','deposit'];
    var lines = [cols.join(',')];
    BOOKINGS.forEach(function (b) {
      lines.push(cols.map(function (c) {
        return '"' + String(b[c] === undefined ? '' : b[c]).replace(/"/g, '""') + '"';
      }).join(','));
    });
    downloadCsv(lines.join('\r\n'), 'bookings.csv');
  });

  function downloadCsv(text, name) {
    // BOM so Excel reads it as UTF-8 rather than mangling names.
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* =========================================================== enquiries */

  ['eqQ'].forEach(function (id) {
    var t; $(id).addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(loadEnquiries, 320);
    });
  });
  $('eqStatus').addEventListener('change', loadEnquiries);
  $('eqClear').addEventListener('click', function () {
    $('eqQ').value = ''; $('eqStatus').value = ''; loadEnquiries();
  });

  function loadEnquiries() {
    $('eqTable').innerHTML = loadingRow(6);
    api({ action: 'enquiries', filter: { q: $('eqQ').value, status: $('eqStatus').value } })
      .then(function (r) {
        if (dead(r)) return;
        if (!r.ok) { $('eqTable').innerHTML = emptyRow(6, r.error); return; }
        ENQS = r.enquiries;

        if (!ENQS.length) {
          $('eqTable').innerHTML = emptyRow(6, 'No enquiries yet.');
        } else {
          var head = '<tr><th>Ref</th><th>From</th><th>About</th><th>Message</th>' +
            '<th>Status</th><th class="actions"></th></tr>';
          $('eqTable').innerHTML = head + ENQS.map(function (e, i) {
            return '<tr>' +
              '<td><strong>' + S.esc(e.ref) + '</strong><br><span class="muted">' +
                S.esc(String(e.createdAt).slice(0, 10)) + '</span></td>' +
              '<td>' + S.esc(e.name) + '<br>' +
                '<a class="muted" href="https://wa.me/91' + S.esc(e.phone) +
                '" target="_blank" rel="noopener">' + S.esc(e.phone) + '</a></td>' +
              '<td>' + S.esc(e.item || '—') + '</td>' +
              '<td style="max-width:280px">' + S.esc(e.message.slice(0, 120)) +
                (e.message.length > 120 ? '…' : '') + '</td>' +
              '<td>' + chip(e.status) + '</td>' +
              '<td class="actions"><button class="btn btn-ghost btn-sm" data-open="' + i +
                '">Open</button></td></tr>';
          }).join('');
          wire($('eqTable'), 'open', function (i) { openEnquiry(ENQS[i]); });
        }
        $('eqCount').textContent = r.count + ' enquir' + (r.count === 1 ? 'y' : 'ies');

        var fresh = ENQS.filter(function (e) { return e.status === 'NEW'; }).length;
        $('cntEnq').textContent = fresh;
        show($('cntEnq'), fresh > 0);
      })
      .catch(function () { $('eqTable').innerHTML = emptyRow(6, 'Could not load enquiries.'); });
  }

  function openEnquiry(e) {
    EQ_ID = e.id;
    $('eqBody').innerHTML =
      '<p><strong>' + S.esc(e.name) + '</strong> · ' +
        '<a href="tel:+91' + S.esc(e.phone) + '">' + S.esc(e.phone) + '</a> · ' +
        '<a href="https://wa.me/91' + S.esc(e.phone) + '" target="_blank" rel="noopener">WhatsApp</a></p>' +
      (e.item ? '<p class="muted">About: ' + S.esc(e.item) + '</p>' : '') +
      '<p style="background:var(--blush);padding:14px;border-radius:10px">' +
        S.esc(e.message) + '</p>' +
      '<label for="eqReply">Your note</label>' +
      '<textarea id="eqReply">' + S.esc(e.reply) + '</textarea>' +
      '<label for="eqNewStatus">Status</label>' +
      '<select id="eqNewStatus">' +
        ['NEW','ANSWERED','CLOSED'].map(function (s) {
          return '<option' + (s === e.status ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select>';
    openModal('eqModal');
  }

  $('eqSave').addEventListener('click', function () {
    var btn = $('eqSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    api({ action: 'replyEnquiry', id: EQ_ID,
      status: $('eqNewStatus').value, reply: $('eqReply').value })
      .then(function (r) {
        btn.disabled = false; btn.textContent = 'Save reply';
        if (dead(r)) return;
        if (!r.ok) { alert(r.error); return; }
        closeModal('eqModal'); loadEnquiries();
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Save reply';
        alert('Could not save.');
      });
  });

  /* ========================================================== categories */

  $('addCatBtn').addEventListener('click', function () { openCat(null); });

  function renderCats() {
    if (!CATS.length) { $('catTable').innerHTML = emptyRow(5, 'No categories yet.'); return; }
    var head = '<tr><th>Name</th><th>Slug</th><th>Sits under</th><th>Order</th><th class="actions"></th></tr>';
    var sorted = CATS.slice().sort(function (a, b) {
      return (a.parent || a.slug).localeCompare(b.parent || b.slug) ||
        (a.parent ? 1 : 0) - (b.parent ? 1 : 0) || a.sequence - b.sequence;
    });
    $('catTable').innerHTML = head + sorted.map(function (c, i) {
      return '<tr>' +
        '<td>' + (c.parent ? '<span class="muted">↳ </span>' : '<strong>') +
          S.esc(c.name) + (c.parent ? '' : '</strong>') + '</td>' +
        '<td class="muted">' + S.esc(c.slug) + '</td>' +
        '<td>' + S.esc(c.parent ? catName(c.parent) : '—') + '</td>' +
        '<td>' + S.esc(c.sequence) + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-sm" data-cedit="' + i +
          '">Edit</button></td></tr>';
    }).join('');
    wire($('catTable'), 'cedit', function (i) { openCat(sorted[i]); });
  }

  function openCat(c) {
    $('catModalTitle').textContent = c ? 'Edit category' : 'Add category';
    $('cName').value = c ? c.name : '';
    $('cSlug').value = c ? c.slug : '';
    $('cSlug').readOnly = !!c;      // slug is the key; changing it would orphan items
    $('cParent').value = c ? (c.parent || '') : '';
    $('cSequence').value = c ? c.sequence : 1;
    $('cActive').value = 'true';
    $('catMsg').className = 'msg';
    openModal('catModal');
  }

  // Suggest a slug while the name is typed, for new categories only.
  $('cName').addEventListener('input', function () {
    if ($('cSlug').readOnly) return;
    $('cSlug').value = $('cName').value.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  });

  $('catSave').addEventListener('click', function () {
    var btn = $('catSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    api({ action: 'saveCategory', category: {
      slug: $('cSlug').value, name: $('cName').value, parent: $('cParent').value,
      sequence: $('cSequence').value, active: $('cActive').value === 'true'
    }}).then(function (r) {
      btn.disabled = false; btn.textContent = 'Save';
      if (dead(r)) return;
      if (!r.ok) { flash($('catMsg'), r.error, 'err'); return; }
      CATS = r.categories;
      fillCategorySelects();
      closeModal('catModal');
      renderCats();
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Save';
      flash($('catMsg'), 'Could not save.', 'err');
    });
  });

  /* ============================================================= reports */

  $('repRun').addEventListener('click', runReport);
  $('repPrint').addEventListener('click', function () { window.print(); });
  $('repQuick').addEventListener('change', function () {
    if (this.value) { quickRange(this.value); runReport(); }
  });

  function quickRange(v) {
    var to = new Date(), from = new Date();
    if (v === 'all') { $('repFrom').value = ''; $('repTo').value = ''; return; }
    from.setDate(from.getDate() - Number(v));
    $('repFrom').value = from.toISOString().slice(0, 10);
    $('repTo').value = to.toISOString().slice(0, 10);
  }

  function runReport() {
    $('repStats').innerHTML = '<p class="muted"><span class="spin"></span> Working…</p>';
    api({ action: 'reports', from: $('repFrom').value, to: $('repTo').value })
      .then(function (r) {
        if (dead(r)) return;
        if (!r.ok) { $('repStats').innerHTML = '<p class="muted">' + S.esc(r.error) + '</p>'; return; }
        var t = r.totals;

        $('repStats').innerHTML =
          stat('Earned', S.money(t.earned), 'picked up or returned', 'good') +
          stat('In the pipeline', S.money(t.pipeline), 'requested or confirmed', '') +
          stat('Bookings', t.bookings, 'in this period', '') +
          stat('Customers', t.customers, 'on record', '');

        bars($('repMonths'), r.byMonth.map(function (m) {
          return { label: m.month + '  (' + m.bookings + ')', amount: m.earned };
        }));
        bars($('repCats'), r.byCategory.map(function (c) {
          return { label: catName(c.label), amount: c.amount };
        }));

        $('repTop').innerHTML = r.topItems.length
          ? '<tr><th>Piece</th><th class="amt">Times out</th><th class="amt">Earned</th></tr>' +
            r.topItems.map(function (i) {
              return '<tr><td>' + S.esc(i.name) + '<br><span class="muted">' +
                S.esc(i.code) + '</span></td><td class="amt">' + i.times +
                '</td><td class="amt">' + S.money(i.earned) + '</td></tr>';
            }).join('')
          : emptyRow(3, 'Nothing rented in this period.');

        $('repIdle').innerHTML = r.idleItems.length
          ? '<tr><th>Piece</th><th>Category</th><th>Listed</th></tr>' +
            r.idleItems.map(function (i) {
              return '<tr><td>' + S.esc(i.name) + '</td><td>' + S.esc(catName(i.category)) +
                '</td><td class="muted">' + S.esc(String(i.addedAt).slice(0, 10)) + '</td></tr>';
            }).join('')
          : emptyRow(3, 'Every piece has been out at least once.');
      })
      .catch(function () {
        $('repStats').innerHTML = '<p class="muted">Could not build the report.</p>';
      });
  }

  function bars(el, rows) {
    if (!rows || !rows.length) { el.innerHTML = '<p class="muted">Nothing yet.</p>'; return; }
    var max = rows.reduce(function (m, r) { return Math.max(m, r.amount); }, 0) || 1;
    el.innerHTML = rows.map(function (r) {
      return '<div class="row"><div class="top"><span>' + S.esc(r.label) +
        '</span><b>' + S.money(r.amount) + '</b></div><div class="track"><div class="fill" style="width:' +
        Math.max(3, Math.round(r.amount / max * 100)) + '%"></div></div></div>';
    }).join('');
  }

  /* =============================================================== modal */

  function openModal(id) { $(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) { $(id).classList.remove('open'); document.body.style.overflow = ''; }

  Array.prototype.forEach.call(document.querySelectorAll('.modal'), function (m) {
    m.addEventListener('click', function (e) {
      // Clicking the backdrop or an ✕ closes; clicking inside the card does not.
      if (e.target === m || e.target.hasAttribute('data-close')) closeModal(m.id);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    Array.prototype.forEach.call(document.querySelectorAll('.modal.open'), function (m) {
      closeModal(m.id);
    });
  });
})();
