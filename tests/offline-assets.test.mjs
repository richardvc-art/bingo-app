import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const runtimeFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "game-state.js",
  "manifest.webmanifest",
  "service-worker.js",
];

test("first-party runtime bevat geen externe internet-URL's", () => {
  for (const path of runtimeFiles) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /https?:\/\//i, `${path} bevat een externe URL`);
  }
});

test("alle vooraf gecachete kernbestanden bestaan lokaal", () => {
  const serviceWorker = readFileSync("service-worker.js", "utf8");
  const cachedPaths = [...serviceWorker.matchAll(/^\s+"(\.\/[^\"]*)",?$/gm)].map((match) => match[1]);

  assert.ok(cachedPaths.length >= 10, "offline-cache bevat te weinig kernbestanden");
  for (const path of cachedPaths) {
    assert.equal(existsSync(path), true, `${path} ontbreekt`);
  }
});
