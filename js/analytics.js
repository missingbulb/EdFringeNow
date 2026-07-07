// Cloudflare Web Analytics — privacy-first, cookieless visitor counts.
//
// One place for the beacon token, shared by every page. Cloudflare Web
// Analytics sets no cookies, stores no personal data, and can't track visitors
// across sites, so it needs no consent banner (see privacy.html).
//
// TO ENABLE: in the Cloudflare dashboard go to Web Analytics -> "Add a site",
// enter this site's hostname, copy the token it generates, and paste it below
// in place of the placeholder. It's free and works on GitHub Pages as-is — you
// do NOT need to move hosting or DNS to Cloudflare.
//
// Until a real token is set, this loader does nothing: no beacon is requested,
// so the site keeps its "no analytics" behaviour and never ships a broken tag.
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
