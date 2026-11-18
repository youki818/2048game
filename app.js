"use strict";

const storageKey = "dieshu-2048.v1";
const byId = id => document.getElementById(id);
const board = byId("board");
const score = byId("score");
const best = byId("best");
const largest = byId("largest");
const progressBar = byId("progress-bar");
const moves = byId("moves");
const undoButton = byId("undo");
const undoLabel = byId("undo-label");
const help = byId("help-dialog");
const result = byId("result");
const resultTitle = byId("result-title");
const resultDescription = byId("result-description");
const resultAction = byId("result-action");
const resultUndo = byId("result-undo");
const announcement = byId("announcement");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const formatNumber = new Intl.NumberFormat("zh-CN");
const keys = new Map([
  ["arrowleft", "left"], ["a", "left"],
  ["arrowright", "right"], ["d", "right"],
  ["arrowup", "up"], ["w", "up"],
  ["arrowdown", "down"], ["s", "down"],
]);

const tiles = [];
for (const row of board.children) {
  for (let column = 0; column < MergeGame.size; column++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.setAttribute("role", "img");
    row.append(tile);
    tiles.push(tile);
  }
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSnapshot(value) {
  return Array.isArray(value?.board) &&
    value.board.length === MergeGame.size ** 2 &&
    value.board.some(Boolean) &&
    value.board.every(tile => tile === 0 ||
      (Number.isSafeInteger(tile) && tile >= 2 && Number.isInteger(Math.log2(tile)))) &&
    isCount(value.score) && isCount(value.moves) &&
    typeof value.winAcknowledged === "boolean" && typeof value.undoUsed === "boolean";
}

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const game = saved?.game;
    const savedBest = isCount(saved?.best) ? saved.best : 0;
    if (!isSnapshot(game)) return { game: MergeGame.newGame(), best: savedBest };

    const previous = game.previous;
    game.previous = !game.undoUsed && isSnapshot(previous) && previous.moves === game.moves - 1
      ? { ...previous, previous: null }
      : null;
    return { game, best: Math.max(savedBest, game.score) };
  } catch {
    return { game: MergeGame.newGame(), best: 0 };
  }
}

let { game, best: bestScore } = readSave();
let swipe = null;

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ game, best: bestScore }));
  } catch {
    // Play remains available when browser storage is disabled or full.
  }
}

function render(animateMove = null, focusResult = false) {
  game.board.forEach((value, index) => {
    const tile = tiles[index];
    const label = value === 0 ? "" : String(value);
    tile.textContent = label;
    tile.setAttribute("aria-label", value === 0 ? "空格" : label);
    if (value === 0) delete tile.dataset.value;
    else tile.dataset.value = label;
    tile.classList.toggle("long-number", label.length === 4);
    tile.classList.toggle("extra-long-number", label.length >= 5);
  });

  if (animateMove && !reducedMotion.matches) {
    tiles[animateMove.spawned].animate(
      [{ opacity: .45, transform: "scale(.7)" }, { opacity: 1, transform: "scale(1)" }],
      { duration: 150, easing: "ease-out" }
    );
    for (const index of animateMove.merged) {
      tiles[index].animate(
        [{ transform: "scale(.94)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
        { duration: 175, easing: "ease-out" }
      );
    }
  }

  const maxTile = Math.max(...game.board);
  score.textContent = formatNumber.format(game.score);
  best.textContent = formatNumber.format(bestScore);
  moves.textContent = formatNumber.format(game.moves);
  largest.textContent = maxTile;
  progressBar.value = Math.min(progressBar.max, Math.log2(maxTile));
  progressBar.setAttribute("aria-valuetext", `${maxTile}，目标 ${MergeGame.target}`);
  undoButton.disabled = game.undoUsed || !game.previous;
  undoLabel.textContent = game.undoUsed ? "已撤回" : "撤回";

  const outcome = MergeGame.outcome(game);
  result.hidden = outcome === "playing";
  if (result.hidden) return;

  const won = outcome === "won";
  resultTitle.textContent = won ? "合出 2048 了！" : "本局结束";
  resultDescription.textContent = won ? "继续合并，挑战更大的数字。" : "棋盘已满，且没有可以合并的方块。";
  resultAction.textContent = won ? "继续挑战" : "再来一局";
  resultUndo.hidden = won || undoButton.disabled;
  if (focusResult) resultAction.focus();
}

function update(animateMove, message) {
  bestScore = Math.max(bestScore, game.score);
  save();
  render(animateMove, true);
  announcement.textContent = [message, result.hidden ? "" : resultTitle.textContent].filter(Boolean).join(" ");
}

function play(direction) {
  const turn = MergeGame.move(game, direction);
  if (!turn) return;

  game = turn.game;
  update(turn, `第 ${game.moves} 步，当前分数 ${game.score}，最大方块 ${Math.max(...game.board)}。`);
}

function restart() {
  game = MergeGame.newGame();
  update(null, "新一局已开始。");
  board.focus({ preventScroll: true });
}

function undoMove() {
  const previous = MergeGame.undo(game);
  if (!previous) return;

  game = previous;
  update(null, "已撤回上一步。");
  board.focus({ preventScroll: true });
}

byId("restart").addEventListener("click", restart);
undoButton.addEventListener("click", undoMove);
resultUndo.addEventListener("click", undoMove);
byId("help-button").addEventListener("click", () => help.showModal());
resultAction.addEventListener("click", () => {
  if (MergeGame.outcome(game) === "won") {
    game = { ...game, winAcknowledged: true };
    update(null, "继续挑战。");
    if (result.hidden) board.focus({ preventScroll: true });
  } else {
    restart();
  }
});

document.addEventListener("keydown", event => {
  if (help.open || !result.hidden || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;

  const direction = keys.get(event.key.toLowerCase());
  if (!direction) return;

  event.preventDefault();
  play(direction);
});

board.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;

  swipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  board.setPointerCapture(event.pointerId);
});

board.addEventListener("pointerup", event => {
  if (event.pointerId !== swipe?.pointerId) return;

  const dx = event.clientX - swipe.x;
  const dy = event.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;

  if (Math.abs(dx) > Math.abs(dy)) play(dx > 0 ? "right" : "left");
  else play(dy > 0 ? "down" : "up");
});

board.addEventListener("lostpointercapture", event => {
  if (event.pointerId === swipe?.pointerId) swipe = null;
});

save();
render();
