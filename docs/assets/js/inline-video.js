/* -------------------------------------------------------------------------
   In-page video, clean — no third-party player, no chrome.

   Put data-video="<path>" on any element:

     <div class="vid-slot" data-video="assets/video/shop-reel.mp4"></div>

   Plays muted and looped, starts when it scrolls into view, pauses when it
   scrolls away, and offers a sound button. Only what is on screen plays, so
   several clips on one page do not chew through a phone's data or battery.
   ------------------------------------------------------------------------- */

/* The wide store stage is hand-built in the markup (two <video> elements,
   one blurred), so it needs its own sound toggle and scroll handling. */
(function () {
  'use strict';

  var stage = document.getElementById('storeStage');
  if (!stage) return;

  var fg = document.getElementById('storeVideo');
  var bg = stage.querySelector('.stage-bg');
  var btn = document.getElementById('storeSound');
  if (!fg) return;

  if (btn) {
    btn.addEventListener('click', function () {
      fg.muted = !fg.muted;
      btn.textContent = fg.muted ? '🔇' : '🔊';
      var label = fg.muted ? 'Turn sound on' : 'Turn sound off';
      btn.setAttribute('aria-label', label);
      btn.title = label;
      if (!fg.muted) fg.play();
    });
  }

  // Pause when off screen; the blurred copy follows the sharp one.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        [fg, bg].forEach(function (v) {
          if (!v) return;
          if (e.isIntersecting) {
            var p = v.play();
            if (p && p.catch) p.catch(function () { /* autoplay refused */ });
          } else { v.pause(); }
        });
      });
    }, { threshold: 0.2 }).observe(stage);
  }
})();

(function () {
  'use strict';

  var slots = document.querySelectorAll('[data-video]');
  if (!slots.length) return;

  Array.prototype.forEach.call(slots, function (slot) {
    var src = String(slot.getAttribute('data-video') || '').trim();
    if (!src || !/\.(mp4|webm)(\?|$)/i.test(src)) return;

    var wrap = document.createElement('div');
    wrap.className = 'vid';

    var v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'metadata';
    var poster = slot.getAttribute('data-poster');
    if (poster) v.poster = poster;

    // Missing or unplayable: leave whatever placeholder was already there.
    v.addEventListener('error', function () { wrap.remove(); });

    var sound = document.createElement('button');
    sound.type = 'button';
    sound.className = 'vid-sound';
    sound.setAttribute('aria-label', 'Turn sound on');
    sound.title = 'Turn sound on';
    sound.textContent = '🔇';
    sound.addEventListener('click', function (e) {
      e.preventDefault();
      v.muted = !v.muted;
      sound.textContent = v.muted ? '🔇' : '🔊';
      var label = v.muted ? 'Turn sound on' : 'Turn sound off';
      sound.setAttribute('aria-label', label);
      sound.title = label;
      if (!v.muted) v.play();
    });

    wrap.appendChild(v);
    wrap.appendChild(sound);

    v.addEventListener('loadeddata', function () {
      slot.innerHTML = '';
      slot.appendChild(wrap);
      slot.classList.add('is-video');
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var p = v.play();
            if (p && p.catch) p.catch(function () { /* autoplay refused */ });
          } else {
            v.pause();
          }
        });
      }, { threshold: 0.25 }).observe(wrap);
    } else {
      v.autoplay = true;
    }
  });
})();
