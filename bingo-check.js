function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeOcrNumber(text, maxNumber) {
  const digits = String(text ?? "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[^0-9]/g, "");

  if (!digits || digits.length > 2) {
    return null;
  }

  const number = Number(digits);
  return Number.isInteger(number) && number >= 1 && number <= maxNumber ? number : null;
}

export function isLikelyMarked(imageData, bbox) {
  if (!imageData || !bbox) {
    return false;
  }

  const wordWidth = Math.max(1, bbox.x1 - bbox.x0);
  const wordHeight = Math.max(1, bbox.y1 - bbox.y0);
  const left = clamp(Math.floor(bbox.x0 - wordWidth * 1.2), 0, imageData.width - 1);
  const right = clamp(Math.ceil(bbox.x1 + wordWidth * 1.2), 0, imageData.width - 1);
  const top = clamp(Math.floor(bbox.y0 - wordHeight * 0.85), 0, imageData.height - 1);
  const bottom = clamp(Math.ceil(bbox.y1 + wordHeight * 0.85), 0, imageData.height - 1);

  let outsidePixels = 0;
  let darkOutsidePixels = 0;
  let coloredPixels = 0;

  for (let y = top; y <= bottom; y += 2) {
    for (let x = left; x <= right; x += 2) {
      const index = (y * imageData.width + x) * 4;
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const isInsidePrintedNumber = x >= bbox.x0 && x <= bbox.x1 && y >= bbox.y0 && y <= bbox.y1;

      if (maximum - minimum > 55 && luminance < 225) {
        coloredPixels += 1;
      }

      if (!isInsidePrintedNumber) {
        outsidePixels += 1;
        if (luminance < 105) {
          darkOutsidePixels += 1;
        }
      }
    }
  }

  if (outsidePixels === 0) {
    return false;
  }

  const coloredRatio = coloredPixels / outsidePixels;
  const darkOutsideRatio = darkOutsidePixels / outsidePixels;
  return coloredRatio > 0.012 || darkOutsideRatio > 0.085;
}

export function createRecognitionCandidates(words, maxNumber, imageData = null) {
  const candidates = [];
  const seen = new Set();
  const orderedWords = [...(words ?? [])].sort((left, right) => {
    const verticalDifference = (left.bbox?.y0 ?? 0) - (right.bbox?.y0 ?? 0);
    return Math.abs(verticalDifference) > 12 ? verticalDifference : (left.bbox?.x0 ?? 0) - (right.bbox?.x0 ?? 0);
  });

  for (const word of orderedWords) {
    const number = normalizeOcrNumber(word.text, maxNumber);
    if (number === null || seen.has(number)) {
      continue;
    }

    seen.add(number);
    candidates.push({
      number,
      marked: isLikelyMarked(imageData, word.bbox),
      confidence: Math.round(Number(word.confidence) || 0),
    });
  }

  return candidates;
}

export function validateMarkedNumbers(markedNumbers, drawnNumbers, maxNumber) {
  const normalized = [...new Set(markedNumbers)]
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= maxNumber)
    .sort((left, right) => left - right);
  const drawn = new Set(drawnNumbers);
  const notDrawn = normalized.filter((number) => !drawn.has(number));

  return {
    checkedNumbers: normalized,
    notDrawn,
    isValid: normalized.length > 0 && notDrawn.length === 0,
  };
}
