import { createRecognitionCandidates, normalizeOcrNumber, validateMarkedNumbers } from "./bingo-check.js";

const TESSERACT_ASSETS = {
  script: "./vendor/tesseract/tesseract.min.js",
  worker: "./vendor/tesseract/worker.min.js",
  core: "./vendor/tesseract/core",
  language: "./vendor/tesseract/lang",
};
let tesseractLoader = null;

function assetUrl(path) {
  return new URL(path, document.baseURI).href;
}

function loadTesseract() {
  if (globalThis.Tesseract) {
    return Promise.resolve(globalThis.Tesseract);
  }

  if (!tesseractLoader) {
    tesseractLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = assetUrl(TESSERACT_ASSETS.script);
      script.onload = () => resolve(globalThis.Tesseract);
      script.onerror = () => reject(new Error("OCR kon niet worden geladen"));
      document.head.append(script);
    });
  }

  return tesseractLoader;
}

async function imageToCanvas(file) {
  const bitmap = await decodeImage(file);
  const crop = detectCardBounds(bitmap);
  const maximumSide = 1800;
  const sourceMaximumSide = Math.max(crop.width, crop.height);
  const scale = sourceMaximumSide < 1600 ? 1600 / sourceMaximumSide : Math.min(1, maximumSide / sourceMaximumSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const processedImageData = removeGridLines(context, imageData);
  return { canvas, imageData: processedImageData };
}

async function decodeImage(file) {
  if ("createImageBitmap" in globalThis) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari-fallback hieronder.
    }
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = imageUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function largestTrueRun(flags) {
  let bestStart = 0;
  let bestEnd = -1;
  let currentStart = null;

  for (let index = 0; index <= flags.length; index += 1) {
    if (flags[index] && currentStart === null) {
      currentStart = index;
    }
    if ((!flags[index] || index === flags.length) && currentStart !== null) {
      const end = index - 1;
      if (end - currentStart > bestEnd - bestStart) {
        bestStart = currentStart;
        bestEnd = end;
      }
      currentStart = null;
    }
  }

  return { start: bestStart, end: bestEnd };
}

function detectCardBounds(bitmap) {
  const detectionMaximumSide = 900;
  const detectionScale = Math.min(1, detectionMaximumSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * detectionScale));
  canvas.height = Math.max(1, Math.round(bitmap.height * detectionScale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

  const isLightPaper = (index) => {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    return luminance > 150 && Math.max(red, green, blue) - Math.min(red, green, blue) < 105;
  };

  const rowFlags = [];
  for (let y = 0; y < height; y += 1) {
    let lightPixels = 0;
    for (let x = 0; x < width; x += 3) {
      if (isLightPaper((y * width + x) * 4)) lightPixels += 1;
    }
    rowFlags.push(lightPixels / Math.ceil(width / 3) > 0.28);
  }

  const rowRun = largestTrueRun(rowFlags);
  if (rowRun.end - rowRun.start < height * 0.16) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }

  const columnFlags = [];
  const sampledRows = Math.max(1, rowRun.end - rowRun.start + 1);
  for (let x = 0; x < width; x += 1) {
    let lightPixels = 0;
    for (let y = rowRun.start; y <= rowRun.end; y += 2) {
      if (isLightPaper((y * width + x) * 4)) lightPixels += 1;
    }
    columnFlags.push(lightPixels / Math.ceil(sampledRows / 2) > 0.24);
  }

  const columnRun = largestTrueRun(columnFlags);
  if (columnRun.end - columnRun.start < width * 0.2) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }

  const paddingX = Math.round(width * 0.025);
  const paddingY = Math.round(height * 0.025);
  const left = Math.max(0, columnRun.start - paddingX);
  const right = Math.min(width - 1, columnRun.end + paddingX);
  const top = Math.max(0, rowRun.start - paddingY);
  const bottom = Math.min(height - 1, rowRun.end + paddingY);

  return {
    x: Math.round(left / detectionScale),
    y: Math.round(top / detectionScale),
    width: Math.round((right - left + 1) / detectionScale),
    height: Math.round((bottom - top + 1) / detectionScale),
  };
}

function removeGridLines(context, sourceImageData) {
  const { width, height, data } = sourceImageData;
  const processed = context.createImageData(width, height);
  processed.data.set(data);
  const horizontalLines = [];
  const verticalLines = [];

  for (let y = 0; y < height; y += 1) {
    let darkPixels = 0;
    for (let x = 0; x < width; x += 3) {
      const index = (y * width + x) * 4;
      const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      if (luminance < 115) darkPixels += 1;
    }
    if (darkPixels / Math.ceil(width / 3) > 0.42) horizontalLines.push(y);
  }

  for (let x = 0; x < width; x += 1) {
    let darkPixels = 0;
    for (let y = 0; y < height; y += 3) {
      const index = (y * width + x) * 4;
      const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      if (luminance < 115) darkPixels += 1;
    }
    if (darkPixels / Math.ceil(height / 3) > 0.42) verticalLines.push(x);
  }

  const clearPixel = (x, y) => {
    const index = (y * width + x) * 4;
    processed.data[index] = 255;
    processed.data[index + 1] = 255;
    processed.data[index + 2] = 255;
    processed.data[index + 3] = 255;
  };

  for (const lineY of horizontalLines) {
    for (let y = Math.max(0, lineY - 2); y <= Math.min(height - 1, lineY + 2); y += 1) {
      for (let x = 0; x < width; x += 1) clearPixel(x, y);
    }
  }

  for (const lineX of verticalLines) {
    for (let x = Math.max(0, lineX - 2); x <= Math.min(width - 1, lineX + 2); x += 1) {
      for (let y = 0; y < height; y += 1) clearPixel(x, y);
    }
  }

  context.putImageData(processed, 0, 0);
  return processed;
}

function progressText(message) {
  const labels = {
    "loading tesseract core": "Herkenningsmodule laden",
    "initializing tesseract": "Herkenning voorbereiden",
    "loading language traineddata": "Cijfermodel laden",
    "initializing api": "Cijfermodel starten",
    "recognizing text": "Nummers lezen",
  };
  const label = labels[message.status] ?? "Kaart analyseren";
  return message.progress ? `${label} · ${Math.round(message.progress * 100)}%` : label;
}

export function setupBingoChecker({ getGameState }) {
  const elements = {
    dialog: document.querySelector("#bingo-check-dialog"),
    closeButton: document.querySelector("#close-bingo-check"),
    gameSummary: document.querySelector("#check-game-summary"),
    photoInput: document.querySelector("#bingo-photo-input"),
    photoStep: document.querySelector("#photo-step"),
    recognitionStep: document.querySelector("#recognition-step"),
    correctionStep: document.querySelector("#correction-step"),
    preview: document.querySelector("#bingo-photo-preview"),
    progress: document.querySelector("#recognition-progress"),
    recognitionStatus: document.querySelector("#recognition-status"),
    recognitionSummary: document.querySelector("#recognition-summary"),
    candidateList: document.querySelector("#candidate-list"),
    addCandidateButton: document.querySelector("#add-candidate"),
    validateButton: document.querySelector("#validate-bingo"),
    result: document.querySelector("#bingo-result"),
  };

  let candidates = [];
  let nextCandidateId = 1;
  let previewUrl = null;

  function resetDialog() {
    candidates = [];
    nextCandidateId = 1;
    elements.photoInput.value = "";
    elements.photoStep.hidden = false;
    elements.recognitionStep.hidden = true;
    elements.correctionStep.hidden = true;
    elements.result.hidden = true;
    elements.result.className = "bingo-result";
    elements.candidateList.replaceChildren();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function open() {
    const state = getGameState();
    if (!state.maxNumber || state.drawnNumbers.length === 0) {
      return;
    }

    resetDialog();
    elements.gameSummary.textContent = `Bingo ${state.maxNumber} · ${state.drawnNumbers.length} getallen getrokken`;
    elements.dialog.showModal();
  }

  function close() {
    elements.dialog.close();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function renderCandidates() {
    elements.candidateList.replaceChildren();
    const maxNumber = getGameState().maxNumber;

    for (const candidate of candidates) {
      const row = document.createElement("div");
      row.className = "candidate-row";
      row.dataset.candidateId = String(candidate.id);

      const numberInput = document.createElement("input");
      numberInput.type = "number";
      numberInput.min = "1";
      numberInput.max = String(maxNumber);
      numberInput.inputMode = "numeric";
      numberInput.value = candidate.number ?? "";
      numberInput.setAttribute("aria-label", "Herkend nummer");
      numberInput.addEventListener("input", () => {
        candidate.number = normalizeOcrNumber(numberInput.value, maxNumber);
        elements.result.hidden = true;
      });

      const markedLabel = document.createElement("label");
      markedLabel.className = "marked-checkbox";
      const markedInput = document.createElement("input");
      markedInput.type = "checkbox";
      markedInput.checked = candidate.marked;
      markedInput.addEventListener("change", () => {
        candidate.marked = markedInput.checked;
        elements.result.hidden = true;
      });
      const markedText = document.createElement("span");
      markedText.textContent = "Ja";
      markedLabel.append(markedInput, markedText);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-candidate";
      removeButton.setAttribute("aria-label", `Nummer ${candidate.number ?? ""} verwijderen`);
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        candidates = candidates.filter((item) => item.id !== candidate.id);
        renderCandidates();
      });

      row.append(numberInput, markedLabel, removeButton);
      elements.candidateList.append(row);
    }
  }

  function addCandidate(candidate = { number: null, marked: true, confidence: null }) {
    candidates.push({ ...candidate, id: nextCandidateId });
    nextCandidateId += 1;
    renderCandidates();
  }

  async function recognize(file) {
    const state = getGameState();
    elements.photoStep.hidden = true;
    elements.recognitionStep.hidden = false;
    elements.correctionStep.hidden = true;
    elements.recognitionStatus.textContent = "Foto voorbereiden";
    previewUrl = URL.createObjectURL(file);
    elements.preview.src = previewUrl;

    try {
      const [{ canvas, imageData }, Tesseract] = await Promise.all([imageToCanvas(file), loadTesseract()]);
      const worker = await Tesseract.createWorker("eng", 1, {
        workerPath: assetUrl(TESSERACT_ASSETS.worker),
        corePath: assetUrl(TESSERACT_ASSETS.core),
        langPath: assetUrl(TESSERACT_ASSETS.language),
        logger: (message) => {
          elements.recognitionStatus.textContent = progressText(message);
        },
      });

      try {
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789",
          tessedit_pageseg_mode: "11",
        });
        const result = await worker.recognize(canvas);
        candidates = createRecognitionCandidates(result.data.words, state.maxNumber, imageData).map((candidate) => ({
          ...candidate,
          id: nextCandidateId++,
        }));
      } finally {
        await worker.terminate();
      }

      elements.recognitionSummary.textContent = candidates.length
        ? `${candidates.length} unieke nummers herkend. Controleer vooral welke vakjes als afgestreept zijn gemarkeerd.`
        : "Geen nummers betrouwbaar herkend. Voeg de afgestreepte nummers hieronder handmatig toe.";
    } catch (error) {
      elements.recognitionSummary.textContent =
        "Automatische herkenning is niet gelukt. Je kunt de afgestreepte nummers hieronder handmatig invoeren.";
    }

    if (candidates.length === 0) {
      addCandidate();
    } else {
      renderCandidates();
    }
    elements.recognitionStep.hidden = true;
    elements.correctionStep.hidden = false;
  }

  function validate() {
    const state = getGameState();
    const invalidInputs = candidates.filter((candidate) => candidate.marked && candidate.number === null);
    if (invalidInputs.length > 0) {
      elements.result.className = "bingo-result result-warning";
      elements.result.textContent = "Vul voor ieder aangevinkt vakje een geldig nummer in.";
      elements.result.hidden = false;
      return;
    }

    const markedNumbers = candidates.filter((candidate) => candidate.marked).map((candidate) => candidate.number);
    const result = validateMarkedNumbers(markedNumbers, state.drawnNumbers, state.maxNumber);
    elements.result.hidden = false;

    if (result.checkedNumbers.length === 0) {
      elements.result.className = "bingo-result result-warning";
      elements.result.textContent = "Markeer minstens één nummer als afgestreept.";
    } else if (result.isValid) {
      elements.result.className = "bingo-result result-valid";
      elements.result.innerHTML = `<strong>Bingo klopt</strong><span>Alle ${result.checkedNumbers.length} afgestreepte nummers zijn getrokken.</span>`;
    } else {
      elements.result.className = "bingo-result result-invalid";
      elements.result.innerHTML = `<strong>Bingo klopt niet</strong><span>Niet getrokken: ${result.notDrawn.join(", ")}.</span>`;
    }
  }

  elements.closeButton.addEventListener("click", close);
  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  elements.photoInput.addEventListener("change", () => {
    const [file] = elements.photoInput.files;
    if (file) {
      recognize(file);
    }
  });
  elements.addCandidateButton.addEventListener("click", () => addCandidate());
  elements.validateButton.addEventListener("click", validate);

  return { open };
}
