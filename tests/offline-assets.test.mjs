import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

const runtimeFiles = [
  "index.html",
  "app.js",
  "game-state.js",
  "bingo-check.js",
  "bingo-camera.js",
  "manifest.webmanifest",
  "service-worker.js",
];

const ocrAssets = [
  "vendor/tesseract/tesseract.min.js",
  "vendor/tesseract/worker.min.js",
  "vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  "vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "vendor/tesseract/lang/eng.traineddata.gz",
];

test("first-party runtime bevat geen externe internet-URL's", () => {
  for (const path of runtimeFiles) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /https?:\/\//i, `${path} bevat een externe URL`);
  }
});

test("alle lokale OCR-bestanden bestaan en worden vooraf gecachet", () => {
  const serviceWorker = readFileSync("service-worker.js", "utf8");

  for (const path of ocrAssets) {
    assert.equal(existsSync(path), true, `${path} ontbreekt`);
    assert.ok(statSync(path).size > 10_000, `${path} is onverwacht klein`);
    assert.ok(serviceWorker.includes(`./${path}`), `${path} ontbreekt in de offline-cache`);
  }
});

test("de OCR-worker gebruikt uitsluitend lokale paden", () => {
  const camera = readFileSync("bingo-camera.js", "utf8");
  assert.match(camera, /workerPath:\s*assetUrl\(TESSERACT_ASSETS\.worker\)/);
  assert.match(camera, /corePath:\s*assetUrl\(TESSERACT_ASSETS\.core\)/);
  assert.match(camera, /langPath:\s*assetUrl\(TESSERACT_ASSETS\.language\)/);
});
