// Applies the visitor's saved light/dark choice before the page paints, so there
// is no flash of the wrong theme. Loaded as a tiny blocking script in <head>
// (a separate file, because the CSP forbids inline scripts).
(function () {
  try {
    var t = localStorage.getItem('tt-theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the device setting */ }
})();
