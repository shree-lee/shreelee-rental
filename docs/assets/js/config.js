/* -------------------------------------------------------------------------
   श्रीली Rental Store — one place for every setting.

   MANDAL_API style: paste the Apps Script web app url here once the backend
   is deployed. Until then the site runs on the sample items below, so the
   design can be reviewed before any data exists.
   ------------------------------------------------------------------------- */

window.SHREELEE_API = 'PASTE_APPS_SCRIPT_EXEC_URL_HERE';

window.SHOP = {
  name: 'श्रीली Rental Store',
  phone: '919168754478',
  instagram: 'https://www.instagram.com/shreelee_rental/',
  maps: 'https://maps.app.goo.gl/j7tXfrdaB9cCsQw49',
  /* Days a piece is held back after return for cleaning. Real rental shops
     need this or a Sunday return gets promised to a Sunday collection. */
  cleaningBufferDays: 1
};

/* Sample stock so the layout can be judged before the Sheet is wired up.
   Deleted automatically the moment the API answers. */
window.DEMO_ITEMS = [
  { id: 'D1', name: 'Maroon Bridal Lehenga', category: 'bridal',
    rent: 3500, deposit: 5000, size: 'M', status: 'available' },
  { id: 'D2', name: 'Gold Embroidered Sharara', category: 'festive',
    rent: 1800, deposit: 3000, size: 'L', status: 'booked', freeFrom: '2026-10-12' },
  { id: 'D3', name: 'Emerald Party Gown', category: 'party',
    rent: 1500, deposit: 2500, size: 'S', status: 'available' },
  { id: 'D4', name: 'Kundan Bridal Set', category: 'jewellery',
    rent: 900, deposit: 4000, size: 'One size', status: 'available' },
  { id: 'D5', name: 'Peach Reception Gown', category: 'party',
    rent: 2200, deposit: 3500, size: 'M', status: 'soon', freeFrom: '2026-10-04' },
  { id: 'D6', name: 'Paithani Silk Saree', category: 'festive',
    rent: 1200, deposit: 2000, size: 'Free', status: 'available' },
  { id: 'D7', name: 'Ivory Christian Gown', category: 'bridal',
    rent: 4000, deposit: 6000, size: 'M', status: 'available' },
  { id: 'D8', name: 'Temple Jewellery Set', category: 'jewellery',
    rent: 700, deposit: 2500, size: 'One size', status: 'available' }
];

/* ------------------------------------------------------- shared helpers */

var netPending = 0;

function netBar() {
  var el = document.getElementById('netBar');
  if (!el) { el = document.createElement('div'); el.id = 'netBar'; document.body.appendChild(el); }
  return el;
}
function netStart() { if (++netPending === 1) netBar().classList.add('on'); }
function netStop() { if (--netPending <= 0) { netPending = 0; netBar().classList.remove('on'); } }

window.Shree = {
  money: function (n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  },

  esc: function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /** yyyy-mm-dd -> 12 Oct 2026 */
  dateOut: function (s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s || '';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return Number(m[3]) + ' ' + months[Number(m[2]) - 1] + ' ' + m[1];
  },

  today: function () { return new Date().toISOString().slice(0, 10); },

  /** Text/plain keeps it a simple CORS request — see the मंडळ notes. */
  post: function (payload) {
    netStart();
    return fetch(window.SHREELEE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { netStop(); return j; })
      .catch(function (e) { netStop(); throw e; });
  },

  configured: function () {
    return window.SHREELEE_API && window.SHREELEE_API.indexOf('script.google.com') > -1;
  }
};
