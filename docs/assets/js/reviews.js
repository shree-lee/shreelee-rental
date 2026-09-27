/* -------------------------------------------------------------------------
   Reviews on the item page.

   Verified only — the server refuses a review from anyone who has not had
   the piece out, so this module just reflects what the server allows. It is
   given the item by item.js once loaded.
   ------------------------------------------------------------------------- */

window.Reviews = (function () {
  'use strict';
  var S = window.Shree, Shop = window.Shop;

  var ITEM = null, PICKED = 0, PHOTOS = [];

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hide', !on); }
  function flash(text, kind) {
    var el = $('revMsg');
    el.textContent = text;
    el.className = 'msg show ' + kind;
  }

  /** Five glyphs, filled to the rating. Half stars are more trouble than
      they are worth at this scale, so it rounds. */
  function stars(n) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="s' + (i <= Math.round(n) ? ' on' : '') + '">★</span>';
    }
    return out;
  }

  function paintSummary(sum) {
    if (!sum || !sum.count) { show($('revScore'), false); return; }
    show($('revScore'), true);
    $('revAvg').textContent = sum.average.toFixed(1);
    $('revStars').innerHTML = stars(sum.average);
    $('revCount').textContent = sum.count + (sum.count === 1 ? ' review' : ' reviews');
  }

  function paintList(rows) {
    show($('revNone'), !rows.length);
    $('revList').innerHTML = rows.map(function (r) {
      var shots = r.photos.length
        ? '<div class="rev-photos">' + r.photos.map(function (p) {
            return '<img src="' + S.esc(p) + '" alt="" loading="lazy">';
          }).join('') + '</div>'
        : '';
      return '<article class="rev">' +
        '<div class="rev-top">' +
          '<span class="rev-who">' + S.esc(r.name) + '</span>' +
          '<span class="rev-badge">Verified rental</span>' +
          '<span class="muted rev-date">' + S.esc(S.dateOut(r.at)) + '</span>' +
        '</div>' +
        '<div class="rev-rate">' + stars(r.rating) + '</div>' +
        (r.comment ? '<p>' + S.esc(r.comment) + '</p>' : '') +
        shots +
        '</article>';
    }).join('');
  }

  /* ------------------------------------------------------------- writing */

  Array.prototype.forEach.call($('starPick').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      PICKED = Number(b.dataset.v);
      paintPicker();
    });
  });

  function paintPicker() {
    Array.prototype.forEach.call($('starPick').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', Number(b.dataset.v) <= PICKED);
    });
  }

  /* Reviewer photos go through the same resize-then-upload path as the
     shop's own images — a 4MB phone shot would otherwise be posted raw. */
  function shrink(file, maxPx) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that photo.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That file is not an image.')); };
        img.onload = function () {
          var scale = Math.min(1, maxPx / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $('revFiles').addEventListener('change', function (e) {
    var list = Array.prototype.slice.call(e.target.files)
      .filter(function (f) { return /^image\//.test(f.type); });
    e.target.value = '';
    if (!list.length) return;

    if (PHOTOS.length + list.length > 4) {
      flash('Four photos is the limit.', 'err');
      return;
    }
    flash('Adding photo(s)…', 'ok');

    list.reduce(function (chain, file) {
      return chain
        .then(function () { return shrink(file, 1000); })
        .then(function (dataUrl) {
          return Shop.call({ action: 'uploadImage',
            name: 'review-' + (ITEM ? ITEM.code || ITEM.id : 'x'), dataUrl: dataUrl });
        })
        .then(function (r) {
          if (!r.ok) throw new Error(r.error);
          PHOTOS.push(r.url);
          paintShots();
        });
    }, Promise.resolve())
      .then(function () { flash('Photos added.', 'ok'); })
      .catch(function (err) { flash(err.message || 'Could not add that photo.', 'err'); });
  });

  function paintShots() {
    $('revShots').innerHTML = PHOTOS.map(function (p, i) {
      return '<div class="rev-shot"><img src="' + S.esc(p) + '" alt="">' +
        '<button type="button" class="x" data-rm="' + i + '">✕</button></div>';
    }).join('');
    Array.prototype.forEach.call($('revShots').querySelectorAll('[data-rm]'), function (b) {
      b.addEventListener('click', function () {
        PHOTOS.splice(Number(b.dataset.rm), 1);
        paintShots();
      });
    });
  }

  $('revSave').addEventListener('click', function () {
    if (!PICKED) { flash('Pick a star rating first.', 'err'); return; }

    var btn = $('revSave');
    btn.disabled = true; btn.textContent = 'Posting…';

    Shop.call({ action: 'addReview', itemId: ITEM.id,
      rating: PICKED, comment: $('revComment').value, photos: PHOTOS })
      .then(function (r) {
        btn.disabled = false; btn.textContent = 'Post review';
        if (!r.ok) { flash(r.error, 'err'); return; }
        flash('Thank you — your review is live.', 'ok');
        paintSummary(r.summary);
        paintList(r.reviews);
        $('revWriteTitle').textContent = 'Edit your review';
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Post review';
        flash('Could not post that. Try again.', 'err');
      });
  });

  return {
    mount: function (item) {
      ITEM = item;
      paintSummary(item.rating);
      paintList(item.reviews || []);

      // The write box appears only for someone the server would accept.
      show($('revWrite'), !!item.canReview);
      if (item.myReview) {
        PICKED = item.myReview.rating;
        $('revComment').value = item.myReview.comment;
        $('revWriteTitle').textContent = 'Edit your review';
        paintPicker();
      }
      if (!item.canReview && (!item.reviews || !item.reviews.length)) {
        $('revVerified').textContent =
          'Reviews come from customers who have actually rented this piece.';
      }

      /* Arriving from "Rate this piece" in booking history. The page loads
         its item over the network, so the browser's own anchor jump has
         already fired against an empty page by now — do it again here. */
      if (location.hash === '#reviewsBlock') {
        $('reviewsBlock').scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (item.canReview) $('revComment').focus({ preventScroll: true });
      }
    }
  };
})();
