import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const runtimeFiles = ["index.html", "styles.css", "app.js", "game-state.js", "manifest.webmanifest", "service-worker.js"];
const removedPaths = [
  "bingo-camera.js",
  "bingo-check.js",
  "vendor/tesseract",
  "tests/fixtures/bingo-card-75.png",
  "tests/fixtures/bingo-card-75.svg",
];

test("foto-, camera- en OCR-runtime zijn volledig verwijderd", () => {
  for (const path of removedPaths) {
    assert.equal(existsSync(path), false, `${path} bestaat nog`);
  }

  const runtime = runtimeFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(runtime, /camera|foto|photo|ocr|tesseract|bingo-(?:camera|check)|controleer\s+bingo|mediaDevices|getUserMedia|capture\s*=|accept\s*=\s*["']image\//i);
  assert.doesNotMatch(runtime, /<input[^>]+type=["']file["']/i);
  assert.doesNotMatch(runtime, /globalThis\.bingoGame|window\.bingoGame/);
});

test("service-worker-cache bevat uitsluitend bestaande kernbestanden", () => {
  const serviceWorker = readFileSync("service-worker.js", "utf8");
  const cachedPaths = [...serviceWorker.matchAll(/^\s+"(\.\/[^\"]*)",?$/gm)].map((match) => match[1]);

  assert.doesNotMatch(serviceWorker, /ocr|tesseract|bingo-(?:camera|check)|vendor\//i);
  for (const path of cachedPaths) {
    assert.equal(existsSync(path), true, `${path} ontbreekt`);
  }
});

test("CSP bevat geen uitzonderingen voor OCR, blobs of onveilige evaluatie", () => {
  const index = readFileSync("index.html", "utf8");
  const match = index.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert.ok(match, "Content-Security-Policy meta-tag ontbreekt");

  const csp = match[1];
  assert.doesNotMatch(csp, /wasm-unsafe-eval|blob:|'unsafe-inline'|'unsafe-eval'/);
  assert.match(csp, /script-src 'self'(?:;|$)/);
  assert.match(csp, /worker-src 'self'(?:;|$)/);
  assert.match(csp, /img-src 'self'(?:;|$)/);
});
