import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pagesBase = new URL("https://voorbeeld.github.io/bingo-app/");
const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
const index = readFileSync("index.html", "utf8");
const app = readFileSync("app.js", "utf8");
const serviceWorker = readFileSync("service-worker.js", "utf8");

function assertInsideProject(path, label) {
  const resolved = new URL(path, pagesBase);
  assert.equal(resolved.origin, pagesBase.origin, `${label} wijst naar een ander domein`);
  assert.ok(resolved.pathname.startsWith("/bingo-app/"), `${label} valt buiten de GitHub Pages-projectmap`);
}

test("PWA-identiteit, start-URL, scope en iconen blijven in de projectsubmap", () => {
  for (const key of ["id", "start_url", "scope"]) {
    assert.equal(manifest[key], "./", `${key} moet relatief zijn`);
    assertInsideProject(manifest[key], `manifest ${key}`);
  }

  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\.\//, `icoonpad ${icon.src} moet relatief zijn`);
    assertInsideProject(icon.src, `icoon ${icon.src}`);
  }
});

test("HTML en service-workerregistratie gebruiken relatieve projectpaden", () => {
  const documentAssets = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(documentAssets.length > 0);

  for (const path of documentAssets) {
    assert.match(path, /^\.\//, `documentpad ${path} moet relatief zijn`);
    assertInsideProject(path, `documentpad ${path}`);
  }

  assert.match(app, /serviceWorker\.register\("\.\/service-worker\.js"\)/);
  assertInsideProject("./service-worker.js", "service worker");
});

test("CSP beperkt runtimebronnen tot wat de lokale PWA nodig heeft", () => {
  const match = index.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert.ok(match, "Content-Security-Policy meta-tag ontbreekt");

  const csp = match[1];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /worker-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.match(csp, /img-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /(?:^|\s)'unsafe-inline'(?:\s|;|$)/);
  assert.doesNotMatch(csp, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/);
  assert.doesNotMatch(csp, /https?:\/\//);
});

test("offline-cache blijft in de projectsubmap", () => {
  const cachedPaths = [...serviceWorker.matchAll(/^\s+"(\.\/[^\"]*)",?$/gm)].map((match) => match[1]);
  assert.ok(cachedPaths.length >= 10, "offline-cache bevat te weinig appbestanden");

  for (const path of cachedPaths) {
    assertInsideProject(path, `cachepad ${path}`);
  }
});
