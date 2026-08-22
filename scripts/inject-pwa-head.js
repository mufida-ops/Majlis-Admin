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

const tags = `
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="theme-color" content="#1B3A5C" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Majlis" />
  <meta name="mobile-web-app-capable" content="yes" />
</head>`;

if (html.includes('rel="manifest"')) {
  console.log('inject-pwa-head: manifest tag already present, skipping');
  process.exit(0);
}

const patched = html.replace('</head>', tags);
fs.writeFileSync(indexPath, patched);
console.log(`inject-pwa-head: patched ${indexPath}`);
