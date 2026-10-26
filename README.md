# Game Hub

A games website with a built-in web proxy, powered by **Scramjet v2**
(`@mercuryworkshop/scramjet@2.0.67-alpha.2`). It is plain files with no
build step, so it runs on GitHub Pages.

- 4 games built into the site (Snake, 2048, Flappy Block, Breakout). These
  work with no proxy at all.
- 7 web game sites that open through the proxy.
- A "Browse" tab to open any website or search through the proxy.
- A "Settings" tab to change the Wisp server, transport, and search engine.

## Put it on GitHub Pages

1. Make a new **public** repository on GitHub (free GitHub accounts can
   only use Pages on public repositories).
2. Upload everything **inside** this folder to the top of the repository
   (`index.html` must be at the top level, not inside another folder).
   Include the hidden `.nojekyll` file.
3. In the repository go to **Settings → Pages**. Under "Build and
   deployment", set Source to **Deploy from a branch**, pick **main** and
   **/ (root)**, then press **Save**.
4. Wait a minute or two. The site will be at
   `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`.

The site works from a sub-folder like `/YOUR-REPO-NAME/` or from the top
of a domain. Nothing needs to be changed for either.

## The Wisp server (important)

GitHub Pages can only serve files. The proxy also needs a **Wisp server**,
which is a small program that makes the actual connections to websites.
That server has to run somewhere else.

- By default the site uses `wss://wisp.mercurywork.shop/`, the public demo
  server run by Mercury Workshop (the Scramjet authors). Their own docs
  call it "the demo one with throttling", so it is rate limited and can
  go down or be blocked at any time.
- Some sites block that server. In testing, krunker.io and agar.io
  showed "Access denied" / 403.
- For anything serious, run your own Wisp server and put its address in
  **Settings** (or change `DEFAULT_SETTINGS.wisp` in `js/proxy.js` so it
  is the default for everyone). Options:
  - [wisp-js](https://www.npmjs.com/package/@mercuryworkshop/wisp-js) (Node.js)
  - [wisp-server-python](https://github.com/MercuryWorkshop/wisp-server-python)

For https websites, the encryption is done inside your browser, so the
Wisp server only sees scrambled data. For plain http websites it can see
everything. Do not log in to accounts through a server you don't trust.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/app.js` | The site and its menus |
| `js/proxy.js` | Starts Scramjet v2 (service worker, transport, controller) |
| `js/games.js` | The game lists. Edit this to add or remove games |
| `sw.js` | Service worker that hands proxied requests to Scramjet |
| `games/` | The 4 built-in games |
| `scram/` | Scramjet 2.0.67-alpha.2 and scramjet-utils 0.0.3 |
| `controller/` | scramjet-controller 0.0.14 |
| `transport/` | libcurl-transport 2.0.6 and epoxy-transport 3.0.2 |

The Scramjet files are copied in (not loaded from a CDN) so the site does
not depend on CDN sites that school or work filters often block.

## Things to know

- **Scramjet v2 is an alpha (test) release.** Some sites break. In
  testing, poki.com and paper-io.com got sent to a broken `/undefined`
  address.
- The site must be opened over **https** (GitHub Pages does this) or on
  `localhost`. Service workers do not run on plain http.
- Needs a recent browser. Scramjet uses a newer JavaScript feature
  (regular-expression modifiers like `(?i:...)`) that older browsers do
  not have.
- `controller.api.js` checks that the Scramjet version matches exactly.
  If you update one package, update all of them together (see below).

## Updating Scramjet later

```sh
npm install @mercuryworkshop/scramjet@alpha @mercuryworkshop/scramjet-controller @mercuryworkshop/scramjet-utils @mercuryworkshop/libcurl-transport @mercuryworkshop/epoxy-transport
M=node_modules/@mercuryworkshop
cp $M/scramjet/dist/scramjet.js $M/scramjet/dist/scramjet.wasm $M/scramjet-utils/dist/scramjet-utils.js scram/
cp $M/scramjet-controller/dist/controller.{api,inject,sw}.js controller/
cp $M/libcurl-transport/dist/index.js transport/libcurl.js
cp $M/epoxy-transport/dist/index.js transport/epoxy.js
```

Check that the new controller expects the same Scramjet version you
installed, then test before uploading.

## License

Scramjet and its packages are licensed under **AGPL-3.0**. Because this
site ships them, keep the repository public so the source stays
available. See `credits.html`.
