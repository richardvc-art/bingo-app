import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecognitionCandidates,
  isLikelyMarked,
  normalizeOcrNumber,
  validateMarkedNumbers,
} from "../bingo-check.js";

test("normaliseert alleen nummers binnen de gekozen variant", () => {
  assert.equal(normalizeOcrNumber("42", 75), 42);
  assert.equal(normalizeOcrNumber("O7", 75), 7);
  assert.equal(normalizeOcrNumber("90", 75), null);
  assert.equal(normalizeOcrNumber("90", 90), 90);
  assert.equal(normalizeOcrNumber("kaart", 90), null);
});

test("maakt unieke kandidaten in leesvolgorde", () => {
  const words = [
    { text: "30", confidence: 88, bbox: { x0: 100, y0: 50, x1: 130, y1: 80 } },
    { text: "12", confidence: 91, bbox: { x0: 10, y0: 10, x1: 40, y1: 40 } },
    { text: "12", confidence: 70, bbox: { x0: 50, y0: 90, x1: 80, y1: 120 } },
  ];

  assert.deepEqual(
    createRecognitionCandidates(words, 75).map(({ number, confidence }) => ({ number, confidence })),
    [
      { number: 12, confidence: 91 },
      { number: 30, confidence: 88 },
    ],
  );
});

test("onderscheidt een gekleurde afstreping van een leeg vak", () => {
  const width = 24;
  const height = 24;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const imageData = { width, height, data: pixels };
  const bbox = { x0: 9, y0: 9, x1: 15, y1: 15 };
  assert.equal(isLikelyMarked(imageData, bbox), false);

  for (let x = 4; x <= 20; x += 1) {
    const index = (7 * width + x) * 4;
    pixels[index] = 210;
    pixels[index + 1] = 25;
    pixels[index + 2] = 25;
  }
  assert.equal(isLikelyMarked(imageData, bbox), true);
});

test("keurt bingo goed wanneer alle aangevinkte nummers zijn getrokken", () => {
  assert.deepEqual(validateMarkedNumbers([7, 12, 42], [2, 7, 12, 30, 42], 75), {
    checkedNumbers: [7, 12, 42],
    notDrawn: [],
    isValid: true,
  });
});

test("meldt exact welke aangevinkte nummers niet zijn getrokken", () => {
  assert.deepEqual(validateMarkedNumbers([7, 19, 42, 19], [7, 12, 42], 90), {
    checkedNumbers: [7, 19, 42],
    notDrawn: [19],
    isValid: false,
  });
});
