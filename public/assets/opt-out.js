// Opt-out page: records a "Do not contact" request.
(function () {
  'use strict';
  const form = document.getElementById('optout-form');
  const status = document.getElementById('optout-status');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.classList.remove('error');
    const contact = form.elements.contact.value.trim();
    if (contact.length < 5) {
      status.textContent = 'Please enter your mobile or email. · 請輸入手機或電子郵件。';
      status.classList.add('error');
      return;
    }
    try {
      const tok = await (await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' })).json();
      const res = await fetch('/api/opt-out', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tok.token },
        body: JSON.stringify({ contact, website: form.elements.website.value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'failed');
      form.reset();
      status.textContent = 'Done. We will not send you marketing messages again. · 已完成，我們不會再傳行銷訊息給您。';
    } catch {
      status.textContent = 'Something went wrong. Please message us "stop" on LINE. · 發生錯誤，請在 LINE 傳「停止」給我們。';
      status.classList.add('error');
    }
  });
})();
