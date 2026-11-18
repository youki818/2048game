"use strict";

const MergeGame = (() => {
  const size = 4;
  const target = 2048;

  function addTile(board, random) {
    const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
    const index = empty[Math.floor(random() * empty.length)];
    board[index] = random() < 0.9 ? 2 : 4;
    return index;
  }

  function newGame(random = Math.random) {
    const board = Array(size * size).fill(0);
    addTile(board, random);
    addTile(board, random);
    return { board, score: 0, moves: 0, winAcknowledged: false, undoUsed: false, previous: null };
  }

  function canMove(board) {
    return board.some((value, index) =>
      value === 0 ||
      (index % size < size - 1 && value === board[index + 1]) ||
      (index < size * (size - 1) && value === board[index + size])
    );
  }

  function outcome(game) {
    if (!game.winAcknowledged && Math.max(...game.board) >= target) return "won";
    if (!canMove(game.board)) return "lost";
    return "playing";
  }

  function lineIndices(direction, line) {
    return Array.from({ length: size }, (_, offset) => {
      switch (direction) {
        case "left": return line * size + offset;
        case "right": return line * size + size - 1 - offset;
        case "up": return offset * size + line;
        case "down": return (size - 1 - offset) * size + line;
      }
    });
  }

  function move(game, direction, random = Math.random) {
    if (outcome(game) !== "playing") return null;

    const board = game.board.slice();
    const merged = [];
    let points = 0;

    for (let line = 0; line < size; line++) {
      const indices = lineIndices(direction, line);
      const values = indices.map(index => game.board[index]).filter(Boolean);
      indices.forEach(index => { board[index] = 0; });

      let destination = 0;
      for (let i = 0; i < values.length; i++) {
        const index = indices[destination++];
        board[index] = values[i];
        if (values[i] === values[i + 1]) {
          board[index] *= 2;
          points += board[index];
          merged.push(index);
          i++;
        }
      }
    }

    if (board.every((value, index) => value === game.board[index])) return null;

    const spawned = addTile(board, random);
    return {
      game: {
        board,
        score: game.score + points,
        moves: game.moves + 1,
        winAcknowledged: game.winAcknowledged,
        undoUsed: game.undoUsed,
        previous: game.undoUsed ? null : { ...game, previous: null },
      },
      merged,
      spawned,
    };
  }

  function undo(game) {
    if (game.undoUsed || !game.previous) return null;
    return { ...game.previous, undoUsed: true };
  }

  return { size, target, newGame, move, outcome, undo };
})();
