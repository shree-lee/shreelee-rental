/* -------------------------------------------------------------------------
   In-page video, clean — no third-party player, no chrome.

   Put data-video="<path>" on any element:

     <div class="vid-slot" data-video="assets/video/shop-reel.mp4"></div>

   Plays muted and looped, starts when it scrolls into view, pauses when it
   scrolls away, and offers a sound button. Only what is on screen plays, so
   several clips on one page do not chew through a phone's data or battery.
   ------------------------------------------------------------------------- */

/* Several clips share one page, so only one of them may be audible. Each
   sound button registers a "mute yourself" callback here; turning any one on
   turns the rest off. Without this a visitor scrolling down ends up with the
   shop reel and the owner's film talking over each other. */
window.VideoAudio = (function () {
  'use strict';
  var others = [];

  return {
    register: function (muteMe) { others.push(muteMe); },
    /** Call just before unmuting: silences every other clip on the page. */
    claim: function (mine) {
      others.forEach(function (muteMe) { if (muteMe !== mine) muteMe(); });
    }
  };
})();

/** Wires one <video> to one button, with the shared audio rule applied. */
function soundButton(video, btn) {
  function paint() {
    btn.textContent = video.muted ? '🔇' : '🔊';
    var label = video.muted ? 'Turn sound on' : 'Turn sound off';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  function mute() { video.muted = true; paint(); }
  window.VideoAudio.register(mute);

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    if (video.muted) {
      window.VideoAudio.claim(mute);
      video.muted = false;
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay refused */ });
    } else {
      video.muted = true;
    }
    paint();
  });

  // A clip that scrolls away goes quiet rather than following you down.
  video.addEventListener('pause', function () {
    if (!video.muted) mute();
  });

  paint();
}

/* The hero film is a background wash, so it has no scroll handling of its
   own — only a toggle, since it cannot autoplay with sound. */
(function () {
  'use strict';
  var v = document.getElementById('heroVideo');
  var btn = document.getElementById('heroSound');
  if (v && btn) soundButton(v, btn);
})();

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

  // The blurred backdrop is decoration; it stays silent whatever happens.
  if (bg) bg.muted = true;

  if (btn) soundButton(fg, btn);

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
    soundButton(v, sound);

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
