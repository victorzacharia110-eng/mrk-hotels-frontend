# Deploying the frontend (nginx / CDN) — avoiding the "blocked MIME type" errors

## The symptom

```
Loading module from "https://mrk-hotels.com/assets/ProfilePage-Bqksgxis.js" was
blocked because of a disallowed MIME type ("text/html").
```

A lazy-loaded JS chunk fails to load and the page section goes blank.

## Why it happens

- Vite names every built file with a content hash (`ProfilePage-Bqksgxis.js`).
- On each build the old hashed chunks are **deleted** from `dist/assets/`.
- nginx is usually configured as an SPA with:
  `try_files $uri $uri/ /index.html;`
- When the browser still has a **cached old `index.html`** (browser or CDN) that
  references chunk names that no longer exist on disk, nginx responds to the
  `.js` request with `index.html` content and `Content-Type: text/html`.
- The browser refuses to execute it → "blocked because of a disallowed MIME type".

`index.html` is served with a long/`public` cache (or the CDN caches it) so the
stale page survives for hours/days and the error keeps re-appearing.

## The fix (nginx)

```nginx
# SPA fallback — HTML routes only, never for built assets.
location / {
    try_files $uri $uri/ /index.html;
}

# Built assets are immutable: serve them, or 404 — never index.html.
location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# index.html must never be cached by the browser or CDN.
location = /index.html {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

After changing the config: `nginx -t && systemctl reload nginx`.

## CDN in front (Cloudflare etc.)

- CDNs cache HTML aggressively by default. Configure `index.html` as
  **no-cache / bypass** (cache level "Bypass" or a rule on `index.html`), and
  let `/assets/*` be cached as static.
- After every deploy, **purge the HTML cache** for the site so clients pick up
  the fresh `index.html` that points at the current chunk hashes.

Without a purge, users keep the old `index.html` and hit the 404+HTML fallback
for deleted chunks until their cache expires.

## Deploy checklist

1. `npm run build` (produces `dist/`).
2. Upload/rsync the **entire `dist/`** output, never just files you think
   changed — old hashed chunks are removed and must disappear from the server.
3. Purge the CDN HTML cache (if a CDN is in front).
4. Spot-check the live site with a hard refresh (Ctrl+Shift+R).

## Verification

After applying the config, a request for a missing asset must return a real `404`
with `Content-Type: application/javascript`-less body (or nothing), not `index.html`:

```bash
curl -sI https://mrk-hotels.com/assets/definitely-missing-file.js | head -5
```

`Content-Type` should NOT be `text/html`. And:

```bash
curl -sI https://mrk-hotels.com/ | grep -i cache-control   # expect: no-cache/no-store
```