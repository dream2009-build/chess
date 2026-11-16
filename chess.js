const PIECE_SYMBOLS = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
};
const PIECE_NAMES = { q: "后", r: "車", b: "象", n: "馬" };
const FILES = "abcdefgh";

class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = [
      [..."rnbqkbnr"], [..."pppppppp"],
      ...Array.from({ length: 4 }, () => Array(8).fill(null)),
      [..."PPPPPPPP"], [..."RNBQKBNR"]
    ];
    this.turn = "w";
    this.castling = { K: true, Q: true, k: true, q: true };
    this.enPassant = null;
    this.history = [];
    this.moves = [];
    this.lastMove = null;
    this.gameOver = false;
  }

  clonePosition() {
    return {
      board: this.board.map((rank) => rank.slice()),
      turn: this.turn,
      castling: { ...this.castling },
      enPassant: this.enPassant && [...this.enPassant]
    };
  }

  restorePosition(position) {
    this.board = position.board.map((rank) => rank.slice());
    this.turn = position.turn;
    this.castling = { ...position.castling };
    this.enPassant = position.enPassant && [...position.enPassant];
  }

  colorOf(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? "w" : "b";
  }

  findKing(color) {
    const king = color === "w" ? "K" : "k";
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (this.board[row][col] === king) return [row, col];
      }
    }
    return null;
  }

  isSquareAttacked(row, col, byColor) {
    const pawnRow = row + (byColor === "w" ? 1 : -1);
    const pawn = byColor === "w" ? "P" : "p";
    for (const pawnCol of [col - 1, col + 1]) {
      if (this.inBounds(pawnRow, pawnCol) && this.board[pawnRow][pawnCol] === pawn) return true;
    }

    const knight = byColor === "w" ? "N" : "n";
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      const r = row + dr;
      const c = col + dc;
      if (this.inBounds(r, c) && this.board[r][c] === knight) return true;
    }

    const king = byColor === "w" ? "K" : "k";
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (this.inBounds(r, c) && this.board[r][c] === king) return true;
      }
    }

    for (const [dr, dc, attackers] of [
      [-1, 0, "rq"], [1, 0, "rq"], [0, -1, "rq"], [0, 1, "rq"],
      [-1, -1, "bq"], [-1, 1, "bq"], [1, -1, "bq"], [1, 1, "bq"]
    ]) {
      let r = row + dr;
      let c = col + dc;
      while (this.inBounds(r, c)) {
        const piece = this.board[r][c];
        if (piece) {
          if (this.colorOf(piece) === byColor && attackers.includes(piece.toLowerCase())) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return false;
  }

  isInCheck(color) {
    const king = this.findKing(color);
    return king ? this.isSquareAttacked(king[0], king[1], color === "w" ? "b" : "w") : false;
  }

  inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  pseudoMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const color = this.colorOf(piece);
    const moves = [];
    const add = (toRow, toCol, extra = {}) => {
      if (!this.inBounds(toRow, toCol)) return false;
      const target = this.board[toRow][toCol];
      if (this.colorOf(target) === color) return false;
      moves.push({ from: [row, col], to: [toRow, toCol], ...extra });
      return !target;
    };
    const type = piece.toLowerCase();

    if (type === "p") {
      const direction = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const oneRow = row + direction;
      if (this.inBounds(oneRow, col) && !this.board[oneRow][col]) {
        add(oneRow, col);
        const twoRow = row + direction * 2;
        if (row === startRow && !this.board[twoRow][col]) add(twoRow, col);
      }
      for (const dc of [-1, 1]) {
        const targetRow = row + direction;
        const targetCol = col + dc;
        if (!this.inBounds(targetRow, targetCol)) continue;
        const target = this.board[targetRow][targetCol];
        if (target && this.colorOf(target) !== color) add(targetRow, targetCol);
        else if (this.enPassant && this.enPassant[0] === targetRow && this.enPassant[1] === targetCol) {
          moves.push({ from: [row, col], to: [targetRow, targetCol], enPassant: true });
        }
      }
    } else if (type === "n") {
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        add(row + dr, col + dc);
      }
    } else if (type === "k") {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr !== 0 || dc !== 0) add(row + dr, col + dc);
        }
      }
      const homeRow = color === "w" ? 7 : 0;
      const enemy = color === "w" ? "b" : "w";
      if (row === homeRow && col === 4 && !this.isSquareAttacked(row, col, enemy)) {
        const kingSide = color === "w" ? "K" : "k";
        const queenSide = color === "w" ? "Q" : "q";
        if (this.castling[kingSide] && !this.board[row][5] && !this.board[row][6] &&
            this.board[row][7] === (color === "w" ? "R" : "r") &&
            !this.isSquareAttacked(row, 5, enemy) && !this.isSquareAttacked(row, 6, enemy)) {
          add(row, 6, { castle: "king" });
        }
        if (this.castling[queenSide] && !this.board[row][1] && !this.board[row][2] && !this.board[row][3] &&
            this.board[row][0] === (color === "w" ? "R" : "r") &&
            !this.isSquareAttacked(row, 3, enemy) && !this.isSquareAttacked(row, 2, enemy)) {
          add(row, 2, { castle: "queen" });
        }
      }
    } else {
      const directions = [];
      if (type === "r" || type === "q") directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      if (type === "b" || type === "q") directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      for (const [dr, dc] of directions) {
        let targetRow = row + dr;
        let targetCol = col + dc;
        while (add(targetRow, targetCol)) {
          targetRow += dr;
          targetCol += dc;
        }
      }
    }
    return moves;
  }

  legalMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece || this.colorOf(piece) !== this.turn || this.gameOver) return [];
    const color = this.turn;
    return this.pseudoMoves(row, col).filter((move) => {
      const position = this.clonePosition();
      this.applyMove(move, piece);
      const safe = !this.isInCheck(color);
      this.restorePosition(position);
      return safe;
    });
  }

  applyMove(move, piece, promotion = "q") {
    const [fromRow, fromCol] = move.from;
    const [toRow, toCol] = move.to;
    const color = this.colorOf(piece);
    const captured = move.enPassant ? this.board[fromRow][toCol] : this.board[toRow][toCol];
    const promotes = piece.toLowerCase() === "p" && (toRow === 0 || toRow === 7);
    this.board[fromRow][fromCol] = null;
    if (move.enPassant) this.board[fromRow][toCol] = null;
    this.board[toRow][toCol] = promotes ? (color === "w" ? promotion.toUpperCase() : promotion) : piece;

    if (move.castle === "king") {
      this.board[fromRow][5] = this.board[fromRow][7];
      this.board[fromRow][7] = null;
    } else if (move.castle === "queen") {
      this.board[fromRow][3] = this.board[fromRow][0];
      this.board[fromRow][0] = null;
    }

    if (piece === "K") this.castling.K = this.castling.Q = false;
    if (piece === "k") this.castling.k = this.castling.q = false;
    if (piece === "R" && fromRow === 7 && fromCol === 0) this.castling.Q = false;
    if (piece === "R" && fromRow === 7 && fromCol === 7) this.castling.K = false;
    if (piece === "r" && fromRow === 0 && fromCol === 0) this.castling.q = false;
    if (piece === "r" && fromRow === 0 && fromCol === 7) this.castling.k = false;
    if (captured === "R" && toRow === 7 && toCol === 0) this.castling.Q = false;
    if (captured === "R" && toRow === 7 && toCol === 7) this.castling.K = false;
    if (captured === "r" && toRow === 0 && toCol === 0) this.castling.q = false;
    if (captured === "r" && toRow === 0 && toCol === 7) this.castling.k = false;

    this.enPassant = piece.toLowerCase() === "p" && Math.abs(toRow - fromRow) === 2
      ? [(toRow + fromRow) / 2, fromCol]
      : null;
    this.turn = color === "w" ? "b" : "w";
    return captured;
  }

  allLegalMoves(color) {
    const originalTurn = this.turn;
    this.turn = color;
    const moves = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (this.colorOf(this.board[row][col]) === color) moves.push(...this.legalMoves(row, col));
      }
    }
    this.turn = originalTurn;
    return moves;
  }

  play(move, promotion = "q") {
    const piece = this.board[move.from[0]][move.from[1]];
    if (!piece || this.colorOf(piece) !== this.turn || this.gameOver) return false;
    const legal = this.legalMoves(move.from[0], move.from[1]).find((candidate) =>
      candidate.to[0] === move.to[0] && candidate.to[1] === move.to[1]);
    if (!legal) return false;

    this.history.push({
      position: this.clonePosition(),
      lastMove: this.lastMove && { from: [...this.lastMove.from], to: [...this.lastMove.to] }
    });
    const notation = this.notation(legal, piece, this.board[legal.to[0]][legal.to[1]], promotion);
    this.applyMove(legal, piece, promotion);
    const checked = this.isInCheck(this.turn);
    const noMoves = this.allLegalMoves(this.turn).length === 0;
    this.gameOver = noMoves;
    this.moves.push(`${notation}${checked ? (noMoves ? "#" : "+") : ""}`);
    this.lastMove = { from: legal.from, to: legal.to };
    return true;
  }

  notation(move, piece, target, promotion) {
    const [fromRow, fromCol] = move.from;
    const [toRow, toCol] = move.to;
    if (move.castle === "king") return "O-O";
    if (move.castle === "queen") return "O-O-O";
    const capture = Boolean(target || move.enPassant);
    const prefix = piece.toLowerCase() === "p" ? (capture ? FILES[fromCol] : "") : piece.toUpperCase();
    const destination = `${FILES[toCol]}${8 - toRow}`;
    const promotionSuffix = piece.toLowerCase() === "p" && (toRow === 0 || toRow === 7)
      ? `=${promotion.toUpperCase()}`
      : "";
    return `${prefix}${capture ? "x" : ""}${destination}${promotionSuffix}`;
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.restorePosition(previous.position);
    this.moves.pop();
    this.lastMove = previous.lastMove;
    this.gameOver = false;
    return true;
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = { ChessGame, PIECE_SYMBOLS };

if (typeof document !== "undefined") {
  const game = new ChessGame();
  const boardElement = document.getElementById("board");
  const moveList = document.getElementById("move-list");
  const undoButton = document.getElementById("undo-button");
  const newGameButton = document.getElementById("new-game-button");
  const statusText = document.getElementById("status-text");
  const statusPiece = document.getElementById("status-piece");
  const statusCard = document.getElementById("status-card");
  const moveCount = document.getElementById("move-count");
  const promotionDialog = document.getElementById("promotion-dialog");
  const promotionOptions = document.getElementById("promotion-options");
  let selected = null;
  let legalTargets = [];
  let pendingPromotion = null;

  function squareName(row, col) {
    return `${FILES[col]}${8 - row}`;
  }

  function render() {
    boardElement.replaceChildren();
    const checkedKing = game.isInCheck(game.turn) ? game.findKing(game.turn) : null;

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const square = document.createElement("button");
        const piece = game.board[row][col];
        const isLight = (row + col) % 2 === 0;
        const isSelected = selected && selected[0] === row && selected[1] === col;
        const isTarget = legalTargets.some((move) => move.to[0] === row && move.to[1] === col);
        square.type = "button";
        square.className = `square ${isLight ? "light" : "dark"}`;
        square.setAttribute("role", "gridcell");
        square.setAttribute("aria-label", `${squareName(row, col)}${piece ? ` ${pieceName(piece)}` : ""}`);
        square.setAttribute("aria-selected", String(Boolean(isSelected)));
        if (isSelected) square.classList.add("selected");
        if (game.lastMove && [game.lastMove.from, game.lastMove.to].some(([r, c]) => r === row && c === col)) {
          square.classList.add("last-move");
        }
        if (checkedKing && checkedKing[0] === row && checkedKing[1] === col) square.classList.add("in-check");
        if (isTarget && piece) square.classList.add("legal-capture");
        if (piece) {
          const glyph = document.createElement("span");
          glyph.className = `piece ${game.colorOf(piece) === "w" ? "white" : "black"}`;
          glyph.setAttribute("aria-hidden", "true");
          glyph.textContent = PIECE_SYMBOLS[piece];
          square.append(glyph);
        } else if (isTarget) {
          const dot = document.createElement("span");
          dot.className = "legal-dot";
          square.append(dot);
        }
        square.addEventListener("click", () => handleSquareClick(row, col));
        boardElement.append(square);
      }
    }
    renderStatus();
    renderMoves();
  }

  function pieceName(piece) {
    const names = { k: "王", q: "后", r: "車", b: "象", n: "馬", p: "兵" };
    return `${game.colorOf(piece) === "w" ? "白" : "黑"}${names[piece.toLowerCase()]}`;
  }

  function handleSquareClick(row, col) {
    if (game.gameOver) return;
    const piece = game.board[row][col];
    if (selected) {
      const move = legalTargets.find((candidate) => candidate.to[0] === row && candidate.to[1] === col);
      if (move) {
        const movingPiece = game.board[selected[0]][selected[1]];
        if (movingPiece.toLowerCase() === "p" && (row === 0 || row === 7)) {
          showPromotion(movingPiece, move);
          return;
        }
        completeMove(move);
        return;
      }
      if (piece && game.colorOf(piece) === game.turn) {
        selectSquare(row, col);
        return;
      }
      selected = null;
      legalTargets = [];
      render();
      return;
    }
    if (piece && game.colorOf(piece) === game.turn) selectSquare(row, col);
  }

  function selectSquare(row, col) {
    selected = [row, col];
    legalTargets = game.legalMoves(row, col);
    render();
  }

  function completeMove(move, promotion = "q") {
    if (!game.play(move, promotion)) return;
    selected = null;
    legalTargets = [];
    render();
  }

  function showPromotion(pawn, move) {
    pendingPromotion = move;
    promotionOptions.replaceChildren();
    for (const type of ["q", "r", "b", "n"]) {
      const button = document.createElement("button");
      const piece = game.colorOf(pawn) === "w" ? type.toUpperCase() : type;
      const symbol = document.createElement("span");
      const name = document.createElement("small");
      symbol.textContent = PIECE_SYMBOLS[piece];
      name.textContent = PIECE_NAMES[type];
      button.type = "button";
      button.append(symbol, name);
      button.addEventListener("click", () => {
        const chosenMove = pendingPromotion;
        promotionDialog.close();
        pendingPromotion = null;
        completeMove(chosenMove, type);
      });
      promotionOptions.append(button);
    }
    promotionDialog.showModal();
  }

  function renderStatus() {
    const whitePlayer = document.getElementById("white-player");
    const blackPlayer = document.getElementById("black-player");
    const inCheck = game.isInCheck(game.turn);
    whitePlayer.classList.toggle("active", !game.gameOver && game.turn === "w");
    blackPlayer.classList.toggle("active", !game.gameOver && game.turn === "b");
    statusCard.classList.toggle("check", inCheck);

    if (game.gameOver) {
      if (inCheck) {
        statusText.textContent = `${game.turn === "w" ? "黑方" : "白方"}獲勝 · 將死`;
      } else {
        statusText.textContent = "和局 · 無子可動";
      }
      statusPiece.textContent = "♚";
      document.querySelector(".live-badge").classList.add("finished");
      document.querySelector(".live-badge").innerHTML = "<span></span> 對局結束";
    } else {
      statusText.textContent = `${game.turn === "w" ? "白方" : "黑方"}行棋${inCheck ? " · 將軍" : ""}`;
      statusPiece.textContent = game.turn === "w" ? "♙" : "♟";
      document.querySelector(".live-badge").classList.remove("finished");
      document.querySelector(".live-badge").innerHTML = "<span></span> 對局中";
    }
    undoButton.disabled = game.history.length === 0;
  }

  function renderMoves() {
    moveList.replaceChildren();
    if (game.moves.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-moves";
      empty.textContent = "棋局開始，請白方先行。";
      moveList.append(empty);
    } else {
      for (let index = 0; index < game.moves.length; index += 2) {
        const row = document.createElement("div");
        const number = document.createElement("span");
        const white = document.createElement("span");
        const black = document.createElement("span");
        row.className = "move-row";
        number.className = "move-number";
        number.textContent = `${Math.floor(index / 2) + 1}.`;
        white.className = `move-san${index === game.moves.length - 1 ? " latest" : ""}`;
        white.textContent = game.moves[index];
        row.append(number, white);
        if (game.moves[index + 1]) {
          black.className = `move-san${index + 1 === game.moves.length - 1 ? " latest" : ""}`;
          black.textContent = game.moves[index + 1];
          row.append(black);
        }
        moveList.append(row);
      }
      moveList.scrollTop = moveList.scrollHeight;
    }
    moveCount.textContent = `${Math.ceil(game.moves.length / 2)} 回合`;
  }

  undoButton.addEventListener("click", () => {
    if (game.undo()) {
      selected = null;
      legalTargets = [];
      render();
    }
  });

  newGameButton.addEventListener("click", () => {
    game.reset();
    selected = null;
    legalTargets = [];
    render();
  });

  render();
}
