/* -------------------------------------------------------------------------
   Scroll reveals and small motion touches.

   Nothing decorative is applied until JS runs, so with scripts blocked the
   page is simply visible rather than permanently invisible — the usual bug
   with reveal-on-scroll.
   ------------------------------------------------------------------------- */

(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('js');
  if (reduce || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('anim');

  /* --------------------------------------------------------- reveal on scroll */

  var targets = document.querySelectorAll(
    '[data-reveal], section > .wrap > *, .item, .occasion, .step, .milestones li'
  );

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  Array.prototype.forEach.call(targets, function (el, i) {
    el.classList.add('rv');
    // Stagger siblings so a grid arrives as a wave, not a slab.
    var sibs = el.parentNode ? el.parentNode.children : [];
    var idx = Array.prototype.indexOf.call(sibs, el);
    el.style.setProperty('--rv-delay', Math.min(idx, 6) * 70 + 'ms');
    io.observe(el);
  });

  /* ------------------------------------------------------- hero entrance */

  var hero = document.querySelector('.hero-content');
  if (hero) {
    hero.classList.add('hero-in');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { hero.classList.add('go'); });
    });
  }

  /* ---------------------------------------------------- hero parallax drift */

  var media = document.querySelector('.hero-wash');
  if (media) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = Math.min(window.scrollY, 700);
        // Slow drift, never more than 60px — enough to feel alive, not seasick.
        media.style.transform = 'translate3d(0,' + (y * 0.07) + 'px,0) scale(1.14)';
        ticking = false;
      });
    }, { passive: true });
  }
})();
