// Cloudflare Web Analytics — privacy-first, cookieless visitor counts.
//
// Cloudflare Web Analytics sets no cookies, stores no personal data, and can't
// track visitors across sites, so it needs no consent banner (see privacy.html).
//
// The beacon token is NOT a secret — it ships in the client and is visible to
// every visitor — so it lives in a GitHub Actions *variable* (not a secret):
//   repo Settings -> Secrets and variables -> Actions -> Variables ->
//   CF_ANALYTICS_TOKEN
// The Pages deploy (.github/workflows/pages.yml) injects that value into the
// placeholder below at build time, the same way js/build-info.js is stamped.
//
// TO ENABLE: create a free site in the Cloudflare dashboard (Web Analytics ->
// "Add a site"), then add its token as the CF_ANALYTICS_TOKEN repo variable.
// It works on GitHub Pages as-is — no hosting or DNS move to Cloudflare needed.
//
// Until a real token is injected (variable unset, or running locally), this
// loader does nothing: no beacon is requested, so the site keeps its "no
// analytics" behaviour and never ships a broken tag.
(function () {
  var TOKEN = 'REPLACE_WITH_CLOUDFLARE_WEB_ANALYTICS_TOKEN';
  // Bail out while the placeholder is still in place (startsWith, ES5-safe).
  if (!TOKEN || TOKEN.lastIndexOf('REPLACE_WITH', 0) === 0) return;

  var beacon = document.createElement('script');
  beacon.defer = true;
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  (document.head || document.documentElement).appendChild(beacon);
})();
