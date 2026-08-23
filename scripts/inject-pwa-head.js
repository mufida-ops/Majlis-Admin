// Adds the tags that make "Add to Home Screen" behave like a real app
// (manifest link, apple-touch-icon, theme-color) into the index.html that
// `expo export -p web` produces.
//
// Why this exists instead of app/+html.tsx: expo-router's static-render
// pipeline (the one that actually reads +html.tsx) crashes on this Expo/
// React version combo with "s.resetServerContext is not a function" — a
// react-dom 19 / expo-router version mismatch, not anything in this app's
// code. The classic "single" web output (one plain index.html, no
// server-side route rendering) still builds cleanly, so this script
// patches its output after the fact instead of fighting that bundler bug.
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'dist';
const indexPath = path.join(outDir, 'index.html');

const html = fs.readFileSync(indexPath, 'utf8');

// Same base path Expo's own export uses for the JS bundle/favicon (app.json
// expo.experiments.baseUrl) — GitHub Pages serves this site from
// /<repo-name>/, not the domain root, so every absolute link here needs the
// same prefix or it 404s silently and the page never loads (this bit us:
// the JS bundle 404ing looked like a totally blank page, nothing in the
// console pointed at "wrong base path" directly).
const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
const base = (appJson.expo?.experiments?.baseUrl ?? '').replace(/\/+$/, '');

const tags = `
  <link rel="manifest" href="${base}/manifest.json" />
  <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
  <meta name="theme-color" content="#1B3A5C" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Majlis" />
  <meta name="mobile-web-app-capable" content="yes" />
  <script>
    // Other half of public/404.html's redirect trick — undoes the "?/"
    // path-folding back into a real path via history.replaceState, before
    // expo-router boots and reads the URL, so a reload or a saved "Add to
    // Home Screen" link on any in-app page lands back on that same page
    // instead of 404ing.
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

if (html.includes('rel="manifest"')) {
  console.log('inject-pwa-head: manifest tag already present, skipping');
  process.exit(0);
}

const patched = html.replace('</head>', tags);
fs.writeFileSync(indexPath, patched);
console.log(`inject-pwa-head: patched ${indexPath}`);
