/* =========================================================================
   Customer session, shared by every shopping page.

   Loaded after config.js and before the page's own script. Exposes
   window.Shop, and fires `shop:ready` once the session is known — pages
   wait for that rather than guessing.
   ========================================================================= */

window.Shop = (function () {
  'use strict';
  var S = window.Shree;

  var TOKEN = null, ME = null, CFG = null, CART = 0;
  var ready = false;

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private */ } }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function forget(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function emit() {
    ready = true;
    document.documentElement.classList.toggle('signed-in', !!ME);
    document.dispatchEvent(new CustomEvent('shop:ready'));
    paintHeader();
  }

  /** Every call carries the token; an expired one drops the session. */
  function call(payload) {
    payload.token = TOKEN;
    return S.post(payload).then(function (r) {
      if (r && r.expired) { signOutLocal(); }
      return r;
    });
  }

  function signOutLocal() {
    TOKEN = null; ME = null;
    forget('shreeCustToken');
    document.documentElement.classList.remove('signed-in');
    paintHeader();
  }

  /* ---------------------------------------------------------- header bits */

  /** Swaps "Sign in" for the customer's name and shows the bag count. */
  function paintHeader() {
    var slot = document.getElementById('navAccount');
    if (slot) {
      slot.innerHTML = ME
        ? '<a href="cart.html">Bag <span class="bag-count' +
            (CART ? '' : ' hide') + '">' + CART + '</span></a>' +
          '<a class="btn btn-primary btn-sm" href="account.html">' +
            S.esc(ME.name.split(' ')[0]) + '</a>'
        : '<a class="btn btn-primary btn-sm" href="account.html">Sign in</a>';
    }
    var badge = document.getElementById('bagBadge');
    if (badge) {
      badge.textContent = CART;
      badge.classList.toggle('hide', !CART);
    }
  }

  function setCart(n) { CART = Number(n) || 0; paintHeader(); }

  /* -------------------------------------------------------------- startup */

  function boot() {
    if (!S.configured()) { emit(); return; }
    var saved = recall('shreeCustToken');
    if (!saved) { emit(); return; }

    TOKEN = saved;
    S.post({ action: 'custPing', token: saved })
      .then(function (r) {
        if (r && r.ok) { ME = r.customer; CFG = r.config; refreshCart(); }
        else { signOutLocal(); }
        emit();
      })
      .catch(function () { emit(); });
  }

  function refreshCart() {
    if (!TOKEN) return Promise.resolve();
    return call({ action: 'cartList' }).then(function (r) {
      if (r && r.ok) setCart(r.totals.count);
      return r;
    }).catch(function () { /* leave the count as it was */ });
  }

  document.addEventListener('DOMContentLoaded', boot);

  return {
    get me() { return ME; },
    get config() { return CFG; },
    get token() { return TOKEN; },
    get ready() { return ready; },
    call: call,
    setCart: setCart,
    refreshCart: refreshCart,

    signIn: function (email, password) {
      return S.post({ action: 'custLogin', email: email, password: password })
        .then(function (r) {
          if (r.ok) { TOKEN = r.token; ME = r.customer; CFG = r.config; store('shreeCustToken', TOKEN); refreshCart(); paintHeader(); }
          return r;
        });
    },

    register: function (payload) {
      payload.action = 'custRegister';
      return S.post(payload).then(function (r) {
        if (r.ok) { TOKEN = r.token; ME = r.customer; CFG = r.config; store('shreeCustToken', TOKEN); paintHeader(); }
        return r;
      });
    },

    signOut: function () {
      if (TOKEN) S.post({ action: 'custLogout', token: TOKEN });
      signOutLocal();
    },

    /** Sends an unsigned visitor to the account page and back again. */
    requireLogin: function (why) {
      var back = location.pathname.split('/').pop() + location.search;
      location.href = 'account.html?next=' + encodeURIComponent(back) +
        (why ? '&why=' + encodeURIComponent(why) : '');
    }
  };
})();
