// Undoes public/404.html's (in the root app, since this whole site is one
// GitHub Pages deployment) redirect trick — folds a 404'd deep link's real
// path back out of the "?/" query string via history.replaceState, before
// expo-router boots and reads the URL. Without this, reloading this app on
// any page past the sign-in screen (or an "Add to Home Screen" icon saved
// from one) would 404 instead of landing back on that page.
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'dist';
const indexPath = path.join(outDir, 'index.html');

const html = fs.readFileSync(indexPath, 'utf8');

const script = `
  <script>
    (function (l) {
      if (l.search[1] === '/') {
        var decoded = l.search.slice(1).split('&').map(function (s) {
          return s.replace(/~and~/g, '&');
        }).join('?');
        window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash);
      }
    })(window.location);
  </script>
</head>`;

if (html.includes('history.replaceState')) {
  console.log('inject-spa-redirect: already present, skipping');
  process.exit(0);
}

const patched = html.replace('</head>', script);
fs.writeFileSync(indexPath, patched);
console.log(`inject-spa-redirect: patched ${indexPath}`);
