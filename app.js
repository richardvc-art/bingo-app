import { BingoGame, GameStatus } from "./game-state.js";
import { setupBingoChecker } from "./bingo-camera.js";
const game = new BingoGame();

const elements = {
  title: document.querySelector("#app-title"),
  status: document.querySelector("#game-status"),
  gameChoice: document.querySelector("#game-choice"),
  choiceButtons: document.querySelectorAll("[data-max-number]"),
  gameArea: document.querySelector("#game-area"),
  currentNumber: document.querySelector("#current-number"),
  tempoSelect: document.querySelector("#tempo-select"),
  playButton: document.querySelector("#play-button"),
  resetButton: document.querySelector("#reset-button"),
  checkBingoButton: document.querySelector("#check-bingo-button"),
  drawCount: document.querySelector("#draw-count"),
  historyToggle: document.querySelector("#history-toggle"),
  numberGrid: document.querySelector("#number-grid"),
};

let timerId = null;
let renderedNumber = game.snapshot.currentNumber;
let renderedGridMax = null;
const bingoChecker = setupBingoChecker({ getGameState: () => game.snapshot });

function createNumberGrid(maxNumber) {
  elements.numberGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= maxNumber; number += 1) {
    const cell = document.createElement("span");
    cell.className = "number-cell";
    cell.dataset.number = String(number);
    cell.textContent = String(number);
    fragment.append(cell);
  }
  elements.numberGrid.append(fragment);
  elements.numberGrid.setAttribute("aria-label", `Overzicht van getallen 1 tot en met ${maxNumber}`);
  renderedGridMax = maxNumber;
}

function statusText(status, maxNumber) {
  switch (status) {
    case GameStatus.RUNNING:
      return "Spel loopt";
    case GameStatus.PAUSED:
      return "Gepauzeerd";
    case GameStatus.COMPLETE:
      return `Alle ${maxNumber} getallen zijn geweest`;
    default:
      return "Klaar om te beginnen";
  }
}

function render() {
  const state = game.snapshot;

  if (state.maxNumber === null) {
    elements.title.textContent = "Bingo";
    elements.status.textContent = "Kies een spel";
    elements.status.classList.remove("complete");
    elements.gameChoice.hidden = false;
    elements.gameArea.hidden = true;
    document.title = "Bingo";
    return;
  }

  if (renderedGridMax !== state.maxNumber) {
    createNumberGrid(state.maxNumber);
  }

  const drawn = new Set(state.drawnNumbers);

  elements.title.textContent = `Bingo ${state.maxNumber}`;
  elements.status.textContent = statusText(state.status, state.maxNumber);
  elements.status.classList.toggle("complete", state.status === GameStatus.COMPLETE);
  elements.gameChoice.hidden = true;
  elements.gameArea.hidden = false;
  document.title = `Bingo ${state.maxNumber}`;
  elements.currentNumber.textContent = state.currentNumber ?? "–";
  elements.currentNumber.classList.toggle("empty", state.currentNumber === null);
  elements.tempoSelect.value = String(state.drawIntervalSeconds);
  elements.historyToggle.checked = state.showDrawnNumbers;
  elements.numberGrid.hidden = !state.showDrawnNumbers;
  elements.drawCount.textContent = `${state.drawnNumbers.length} / ${state.maxNumber}`;
  elements.checkBingoButton.disabled = state.drawnNumbers.length === 0;

  if (state.currentNumber !== renderedNumber) {
    elements.currentNumber.classList.remove("changed");
    requestAnimationFrame(() => elements.currentNumber.classList.add("changed"));
    renderedNumber = state.currentNumber;
  }

  for (const cell of elements.numberGrid.children) {
    const number = Number(cell.dataset.number);
    cell.classList.toggle("drawn", drawn.has(number));
    cell.classList.toggle("current", number === state.currentNumber);
    cell.setAttribute("aria-label", drawn.has(number) ? `${number}, getrokken` : `${number}, nog niet getrokken`);
  }

  if (state.status === GameStatus.RUNNING) {
    elements.playButton.textContent = "Pauze";
    elements.playButton.disabled = false;
  } else if (state.status === GameStatus.PAUSED) {
    elements.playButton.textContent = "Hervatten";
    elements.playButton.disabled = false;
  } else if (state.status === GameStatus.COMPLETE) {
    elements.playButton.textContent = "Klaar";
    elements.playButton.disabled = true;
  } else {
    elements.playButton.textContent = "Start";
    elements.playButton.disabled = false;
  }
}

function clearDrawTimer() {
  if (timerId !== null) {
    window.clearTimeout(timerId);
    timerId = null;
  }
}

function scheduleNextDraw() {
  clearDrawTimer();
  if (game.snapshot.status !== GameStatus.RUNNING) {
    return;
  }

  timerId = window.setTimeout(() => {
    timerId = null;
    game.drawNext();
    render();
    scheduleNextDraw();
  }, game.snapshot.drawIntervalSeconds * 1000);
}

elements.playButton.addEventListener("click", () => {
  const { status } = game.snapshot;
  if (status === GameStatus.IDLE) {
    game.start();
  } else if (status === GameStatus.RUNNING) {
    game.pause();
  } else if (status === GameStatus.PAUSED) {
    game.resume();
  }

  render();
  scheduleNextDraw();
});

for (const button of elements.choiceButtons) {
  button.addEventListener("click", () => {
    game.selectGame(Number(button.dataset.maxNumber));
    renderedNumber = null;
    render();
  });
}

elements.tempoSelect.addEventListener("change", () => {
  game.setDrawInterval(Number(elements.tempoSelect.value));
  scheduleNextDraw();
});

elements.historyToggle.addEventListener("change", () => {
  game.setShowDrawnNumbers(elements.historyToggle.checked);
  render();
});

elements.resetButton.addEventListener("click", () => {
  const confirmed = window.confirm("Nieuw spel starten? Alle getrokken getallen van dit spel worden gewist.");
  if (!confirmed) {
    return;
  }

  clearDrawTimer();
  game.reset();
  renderedNumber = null;
  render();
});

elements.checkBingoButton.addEventListener("click", () => {
  bingoChecker.open();
});

render();
scheduleNextDraw();

// Alleen-lezen toegang voor de cameracontrole en mogelijke latere uitbreidingen.
globalThis.bingoGame = Object.freeze({
  getState: () => game.snapshot,
  getDrawnNumbers: () => game.snapshot.drawnNumbers,
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Offline caching is een verbetering; het spel zelf blijft zonder registratie werken.
    });
  });
}
