const STORAGE_KEY = "bingo90.game.v1";
const NUMBER_MIN = 1;
const ALLOWED_MAX_NUMBERS = Object.freeze([75, 90]);
const ALLOWED_INTERVALS_SECONDS = Object.freeze([2, 3, 5, 10]);
const DEFAULT_INTERVAL_SECONDS = 3;

export const GameStatus = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETE: "complete",
});

function initialState(drawIntervalSeconds = DEFAULT_INTERVAL_SECONDS, showDrawnNumbers = true) {
  return {
    status: GameStatus.IDLE,
    maxNumber: null,
    drawIntervalSeconds,
    showDrawnNumbers,
    currentNumber: null,
    drawnNumbers: [],
  };
}

function isValidDrawnNumbers(numbers, maxNumber) {
  return (
    Array.isArray(numbers) &&
    numbers.every(Number.isInteger) &&
    numbers.every((number) => number >= NUMBER_MIN && number <= maxNumber) &&
    new Set(numbers).size === numbers.length
  );
}

function isValidSavedState(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settingsAreValid =
    ALLOWED_INTERVALS_SECONDS.includes(value.drawIntervalSeconds) && typeof value.showDrawnNumbers === "boolean";

  if (!settingsAreValid) {
    return false;
  }

  if (value.maxNumber === null) {
    return (
      value.status === GameStatus.IDLE &&
      value.currentNumber === null &&
      Array.isArray(value.drawnNumbers) &&
      value.drawnNumbers.length === 0
    );
  }

  if (!ALLOWED_MAX_NUMBERS.includes(value.maxNumber) || !isValidDrawnNumbers(value.drawnNumbers, value.maxNumber)) {
    return false;
  }

  const validStatuses = Object.values(GameStatus);
  const currentIsValid =
    value.currentNumber === null ||
    (Number.isInteger(value.currentNumber) && value.drawnNumbers.at(-1) === value.currentNumber);

  return validStatuses.includes(value.status) && currentIsValid;
}

export class BingoGame {
  constructor({ storage = globalThis.localStorage, random = Math.random } = {}) {
    this.storage = storage;
    this.random = random;
    this.state = this.load();
  }

  get snapshot() {
    return {
      status: this.state.status,
      maxNumber: this.state.maxNumber,
      drawIntervalSeconds: this.state.drawIntervalSeconds,
      showDrawnNumbers: this.state.showDrawnNumbers,
      currentNumber: this.state.currentNumber,
      drawnNumbers: [...this.state.drawnNumbers],
    };
  }

  selectGame(maxNumber) {
    if (!ALLOWED_MAX_NUMBERS.includes(maxNumber) || this.state.maxNumber !== null) {
      return false;
    }

    this.state.maxNumber = maxNumber;
    this.save();
    return true;
  }

  setDrawInterval(seconds) {
    if (!ALLOWED_INTERVALS_SECONDS.includes(seconds)) {
      return false;
    }

    this.state.drawIntervalSeconds = seconds;
    this.save();
    return true;
  }

  setShowDrawnNumbers(show) {
    if (typeof show !== "boolean") {
      return false;
    }

    this.state.showDrawnNumbers = show;
    this.save();
    return true;
  }

  start() {
    if (this.state.status !== GameStatus.IDLE || !ALLOWED_MAX_NUMBERS.includes(this.state.maxNumber)) {
      return null;
    }

    this.state.status = GameStatus.RUNNING;
    return this.drawNext();
  }

  pause() {
    if (this.state.status === GameStatus.RUNNING) {
      this.state.status = GameStatus.PAUSED;
      this.save();
    }
  }

  resume() {
    if (this.state.status === GameStatus.PAUSED) {
      this.state.status = GameStatus.RUNNING;
      this.save();
    }
  }

  drawNext() {
    if (this.state.status !== GameStatus.RUNNING) {
      return null;
    }

    const drawn = new Set(this.state.drawnNumbers);
    const remaining = [];
    for (let number = NUMBER_MIN; number <= this.state.maxNumber; number += 1) {
      if (!drawn.has(number)) {
        remaining.push(number);
      }
    }

    if (remaining.length === 0) {
      this.state.status = GameStatus.COMPLETE;
      this.save();
      return null;
    }

    const index = Math.floor(this.random() * remaining.length);
    const nextNumber = remaining[Math.min(index, remaining.length - 1)];
    this.state.drawnNumbers.push(nextNumber);
    this.state.currentNumber = nextNumber;

    if (this.state.drawnNumbers.length === this.state.maxNumber) {
      this.state.status = GameStatus.COMPLETE;
    }

    this.save();
    return nextNumber;
  }

  reset() {
    this.state = initialState(this.state.drawIntervalSeconds, this.state.showDrawnNumbers);
    this.save();
  }

  save() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // De app blijft werken wanneer privé-instellingen lokale opslag blokkeren.
    }
  }

  load() {
    try {
      const saved = JSON.parse(this.storage.getItem(STORAGE_KEY));

      if (saved && saved.drawIntervalSeconds === undefined) {
        saved.drawIntervalSeconds = DEFAULT_INTERVAL_SECONDS;
      }

      if (saved && saved.showDrawnNumbers === undefined) {
        saved.showDrawnNumbers = true;
      }

      // Een leeg oud spel toont de nieuwe keuze; een lopend oud spel blijft een 90-spel.
      if (saved && saved.maxNumber === undefined) {
        if (saved.status === GameStatus.IDLE && saved.currentNumber === null && saved.drawnNumbers?.length === 0) {
          saved.maxNumber = null;
        } else {
          saved.maxNumber = 90;
        }
      }

      if (!isValidSavedState(saved)) {
        return initialState();
      }

      if (saved.drawnNumbers.length === saved.maxNumber) {
        saved.status = GameStatus.COMPLETE;
      }

      return {
        status: saved.status,
        maxNumber: saved.maxNumber,
        drawIntervalSeconds: saved.drawIntervalSeconds,
        showDrawnNumbers: saved.showDrawnNumbers,
        currentNumber: saved.currentNumber,
        drawnNumbers: [...saved.drawnNumbers],
      };
    } catch {
      return initialState();
    }
  }
}
