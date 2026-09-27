/* The public enquiry form. No account needed — it is a message, not a booking. */
(function () {
  'use strict';
  var S = window.Shree;

  var form = document.getElementById('enquireForm');
  if (!form) return;

  function $(id) { return document.getElementById(id); }
  function flash(text, kind) {
    var el = $('eqMsgBox');
    el.textContent = text;
    el.className = 'msg show ' + kind;
  }

  // Digits only, and strip a pasted country code — the +91 is printed beside.
  $('eqPhone').addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '');
    if (v.length === 12 && v.indexOf('91') === 0) v = v.slice(2);
    else if (v.length === 11 && v.charAt(0) === '0') v = v.slice(1);
    this.value = v.slice(0, 10);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!S.configured()) {
      flash('The shop is not connected yet. Please WhatsApp 91687 54478 instead.', 'err');
      return;
    }

    var phone = $('eqPhone').value.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      flash('Enter a 10 digit Indian mobile number starting 6, 7, 8 or 9.', 'err');
      $('eqPhone').focus();
      return;
    }

    var btn = $('eqBtn');
    btn.disabled = true; btn.textContent = 'Sending…';

    S.post({
      action: 'enquire',
      name: $('eqName').value.trim(),
      phone: '91' + phone,
      message: $('eqMsg').value.trim()
    }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Send enquiry';
      if (!r.ok) { flash(r.error, 'err'); return; }
      form.reset();
      flash('Sent — reference ' + r.ref + '. Laxmi will reply on WhatsApp.', 'ok');
      btn.textContent = 'Sent ✓';
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Send enquiry';
      flash('Could not send. Please WhatsApp 91687 54478 instead.', 'err');
    });
  });
})();
