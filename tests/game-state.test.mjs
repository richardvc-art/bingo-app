import test from "node:test";
import assert from "node:assert/strict";
import { BingoGame, GameStatus } from "../game-state.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

function selectedGame(maxNumber = 90, options = {}) {
  const game = new BingoGame({ storage: new MemoryStorage(), random: () => 0, ...options });
  game.selectGame(maxNumber);
  return game;
}

for (const maxNumber of [75, 90]) {
  test(`trekt alle getallen 1 t/m ${maxNumber} precies eenmaal`, () => {
    const game = selectedGame(maxNumber);
    game.start();
    while (game.snapshot.status === GameStatus.RUNNING) {
      game.drawNext();
    }

    const drawn = game.snapshot.drawnNumbers;
    assert.equal(drawn.length, maxNumber);
    assert.equal(new Set(drawn).size, maxNumber);
    assert.deepEqual(
      [...drawn].sort((a, b) => a - b),
      Array.from({ length: maxNumber }, (_, index) => index + 1),
    );
    assert.equal(game.snapshot.status, GameStatus.COMPLETE);
  });
}

test("weigert starten voordat een variant is gekozen", () => {
  const game = new BingoGame({ storage: new MemoryStorage(), random: () => 0 });
  assert.equal(game.start(), null);
  assert.equal(game.snapshot.status, GameStatus.IDLE);
});

test("pauzeren blokkeert een trekking en hervatten maakt die weer mogelijk", () => {
  const game = selectedGame(75, { random: () => 0.5 });
  game.start();
  game.pause();
  assert.equal(game.drawNext(), null);
  assert.equal(game.snapshot.drawnNumbers.length, 1);

  game.resume();
  assert.notEqual(game.drawNext(), null);
  assert.equal(game.snapshot.drawnNumbers.length, 2);
});

test("herstelt de volledige spelstatus uit lokale opslag", () => {
  const storage = new MemoryStorage();
  const firstSession = new BingoGame({ storage, random: () => 0.25 });
  firstSession.selectGame(75);
  firstSession.setDrawInterval(5);
  firstSession.start();
  firstSession.drawNext();
  firstSession.pause();

  const reopened = new BingoGame({ storage, random: () => 0.75 });
  assert.deepEqual(reopened.snapshot, firstSession.snapshot);
});

test("bewaart alleen ondersteunde tempo-opties", () => {
  const game = selectedGame(75);
  assert.equal(game.setDrawInterval(10), true);
  assert.equal(game.snapshot.drawIntervalSeconds, 10);
  assert.equal(game.setDrawInterval(1), false);
  assert.equal(game.snapshot.drawIntervalSeconds, 10);
});

test("verbergt alleen het overzicht en behoudt de getrokken getallen", () => {
  const storage = new MemoryStorage();
  const game = new BingoGame({ storage, random: () => 0.5 });
  game.selectGame(75);
  game.start();
  game.drawNext();
  const drawnBeforeHiding = game.snapshot.drawnNumbers;

  assert.equal(game.setShowDrawnNumbers(false), true);
  assert.deepEqual(game.snapshot.drawnNumbers, drawnBeforeHiding);

  const reopened = new BingoGame({ storage });
  assert.equal(reopened.snapshot.showDrawnNumbers, false);
  assert.deepEqual(reopened.snapshot.drawnNumbers, drawnBeforeHiding);
});

test("behoudt een lopend spel uit de eerdere 90-getallenversie", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "bingo90.game.v1",
    JSON.stringify({ status: GameStatus.PAUSED, currentNumber: 42, drawnNumbers: [7, 42] }),
  );

  const migrated = new BingoGame({ storage });
  assert.equal(migrated.snapshot.maxNumber, 90);
  assert.deepEqual(migrated.snapshot.drawnNumbers, [7, 42]);
});

test("toont de keuze bij een leeg spel uit de eerdere versie", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "bingo90.game.v1",
    JSON.stringify({ status: GameStatus.IDLE, currentNumber: null, drawnNumbers: [] }),
  );

  const migrated = new BingoGame({ storage });
  assert.equal(migrated.snapshot.maxNumber, null);
});

test("nieuw spel wist alle getrokken getallen", () => {
  const game = selectedGame(90, { random: () => 0.1 });
  game.start();
  game.drawNext();
  game.reset();

  assert.deepEqual(game.snapshot, {
    status: GameStatus.IDLE,
    maxNumber: null,
    drawIntervalSeconds: 3,
    showDrawnNumbers: true,
    currentNumber: null,
    drawnNumbers: [],
  });
});
