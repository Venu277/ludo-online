const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e5 });

const PORT = process.env.PORT || 3000;
app.use(express.static("public", {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

const rooms = {};

const TRACK = [
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0],
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7],
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14],
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7]
];

const HOME_CELLS = {
  red:    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]], green:  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]], blue:   [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]
};

const START_INDEX = { red: 1, blue: 14, yellow: 27, green: 40 };
const SAFE_SQUARES = new Set([1, 9, 14, 22, 27, 35, 40, 48]);

function createInitialGameState() {
  return { lastDice: null, turnOrder: [], currentTurnIndex: 0, pawns: {}, finished: {} };
}

function assignColor(room) {
  const colors = ["red", "green", "yellow", "blue"];
  const used = new Set(Object.values(room.players).map(p => p.color));
  for (const c of colors) if (!used.has(c)) return c;
  return "gray";
}

function sendRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  io.to(roomCode).emit("room_state", { roomCode, players: Object.values(room.players), gameState: room.gameState });
}

function advanceTurn(room) {
  if (!room.gameState.turnOrder.length) return;
  room.gameState.currentTurnIndex = (room.gameState.currentTurnIndex + 1) % room.gameState.turnOrder.length;
  room.gameState.lastDice = null;
}

function isSafeTrackIndex(i) { return SAFE_SQUARES.has(i); }

function pawnAtTrackIndex(room, trackIndex, ignorePlayerId, ignorePawnIndex) {
  for (const [pid, pawns] of Object.entries(room.gameState.pawns)) {
    for (let i = 0; i < pawns.length; i++) {
      if (pid === ignorePlayerId && i === ignorePawnIndex) continue;
      if (pawns[i] >= 0 && pawns[i] < 52 && pawns[i] === trackIndex) return { pid, i };
    }
  }
  return null;
}

function sanitizeRoomCode(code) { return String(code || "").toUpperCase().trim().substring(0, 10); }

io.on("connection", (socket) => {
  
  socket.on("join_room", ({ roomCode, name }) => {
    roomCode = sanitizeRoomCode(roomCode);
    if (!roomCode) return;
    if (!rooms[roomCode]) rooms[roomCode] = { players: {}, gameState: createInitialGameState() };

    const room = rooms[roomCode];
    if (Object.keys(room.players).length >= 4) return socket.emit("room_full");

    const player = { id: socket.id, name: String(name || "Player").substring(0, 20), color: assignColor(room) };
    room.players[socket.id] = player;
    room.gameState.pawns[socket.id] = [-1, -1, -1, -1];
    room.gameState.finished[socket.id] = 0;

    if (!room.gameState.turnOrder.includes(socket.id)) room.gameState.turnOrder.push(socket.id);

    socket.join(roomCode);
    socket.emit("joined_room", { roomCode, you: player, players: Object.values(room.players), gameState: room.gameState });
    io.to(roomCode).emit("player_joined", { player });
    sendRoomState(roomCode);
  });

  socket.on("roll_dice", ({ roomCode }) => {
    roomCode = sanitizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || room.gameState.turnOrder.length === 0) return;
    if (socket.id !== room.gameState.turnOrder[room.gameState.currentTurnIndex]) return socket.emit("not_your_turn");
    if (room.gameState.lastDice !== null) return;

    room.gameState.lastDice = 1 + Math.floor(Math.random() * 6);
    io.to(roomCode).emit("dice_rolled", { value: room.gameState.lastDice });
    sendRoomState(roomCode);
  });

  socket.on("move_pawn", ({ roomCode, pawnIndex }) => {
    roomCode = sanitizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || room.gameState.turnOrder.length === 0) return;
    if (socket.id !== room.gameState.turnOrder[room.gameState.currentTurnIndex]) return socket.emit("not_your_turn");

    const dice = room.gameState.lastDice;
    if (!dice) return socket.emit("must_roll_first");

    const player = room.players[socket.id], pawns = room.gameState.pawns[socket.id];
    if (!player || !Array.isArray(pawns) || pawnIndex < 0 || pawnIndex >= pawns.length) return;

    const oldPos = pawns[pawnIndex];
    let newPos = oldPos, finishedNow = false, capturedPawn = false;

    if (oldPos === -1) {
      if (dice === 6) newPos = START_INDEX[player.color];
      else return socket.emit("must_roll_6_to_leave_home");
    } 
    else if (oldPos >= 0 && oldPos < 52) {
      const rel = (oldPos - START_INDEX[player.color] + 52) % 52, progress = rel + dice;
      if (progress < 51) newPos = (START_INDEX[player.color] + progress) % 52;
      else {
        const homeStep = progress - 51;
        if (homeStep < 6) newPos = 52 + homeStep;
        else if (homeStep === 6) { newPos = 100 + room.gameState.finished[socket.id]; finishedNow = true; } 
        else return socket.emit("exact_roll_required");
      }
    } 
    else if (oldPos >= 52 && oldPos < 58) {
      const homeStep = oldPos - 52 + dice;
      if (homeStep < 6) newPos = 52 + homeStep;
      else if (homeStep === 6) { newPos = 100 + room.gameState.finished[socket.id]; finishedNow = true; } 
      else return socket.emit("exact_roll_required");
    } 
    else return;

    if (newPos >= 0 && newPos < 52 && !isSafeTrackIndex(newPos)) {
      const hit = pawnAtTrackIndex(room, newPos, socket.id, pawnIndex);
      if (hit && hit.pid !== socket.id) {
        room.gameState.pawns[hit.pid][hit.i] = -1;
        capturedPawn = true;
        io.to(roomCode).emit("pawn_captured", { by: socket.id, victim: hit.pid, victimPawnIndex: hit.i });
      }
    }

    pawns[pawnIndex] = newPos;
    if (finishedNow) room.gameState.finished[socket.id] += 1;

    const playerWon = room.gameState.finished[socket.id] >= 4;
    const extraTurn = (dice === 6 || capturedPawn) && !finishedNow && !playerWon;

    if (!extraTurn) advanceTurn(room);
    else room.gameState.lastDice = null;

    io.to(roomCode).emit("pawn_moved", {
      playerId: socket.id, pawnIndex, newPos, oldPos,
      currentTurnIndex: room.gameState.currentTurnIndex, turnOrder: room.gameState.turnOrder, extraTurn
    });

    if (playerWon) {
      // LEADERBOARD LOGIC: Score prioritizes finished pawns, then total distance travelled by remaining pawns
      const leaderboard = Object.values(room.players).map(p => {
        const playerPawns = room.gameState.pawns[p.id];
        const playerFinished = room.gameState.finished[p.id];
        let score = playerFinished * 1000;
        
        playerPawns.forEach(pos => {
          if (pos >= 0 && pos < 52) score += (pos - START_INDEX[p.color] + 52) % 52;
          else if (pos >= 52 && pos < 58) score += pos; 
        });
        
        return { name: p.name, color: p.color, score, finished: playerFinished };
      }).sort((a, b) => b.score - a.score);

      io.to(roomCode).emit("game_over", { winner: player.name, leaderboard });
    }

    sendRoomState(roomCode);
  });

  socket.on("skip_turn", ({ roomCode }) => {
    roomCode = sanitizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || room.gameState.turnOrder.length === 0) return;
    if (socket.id !== room.gameState.turnOrder[room.gameState.currentTurnIndex]) return;
    if (room.gameState.lastDice === null) return;

    advanceTurn(room);
    io.to(roomCode).emit("turn_skipped", { playerId: socket.id });
    sendRoomState(roomCode);
  });

  socket.on("chat_message", ({ roomCode, name, text }) => {
    roomCode = sanitizeRoomCode(roomCode);
    if (!rooms[roomCode]) return;
    const safeText = String(text).substring(0, 200);
    if (!safeText.trim()) return;
    io.to(roomCode).emit("chat_message", { name, text: safeText });
  });

  socket.on("disconnect", () => {
    for (const [roomCode, room] of Object.entries(rooms)) {
      if (!room.players[socket.id]) continue;
      const name = room.players[socket.id].name;
      delete room.players[socket.id];
      delete room.gameState.pawns[socket.id];
      delete room.gameState.finished[socket.id];
      
      room.gameState.turnOrder = room.gameState.turnOrder.filter(id => id !== socket.id);
      if (room.gameState.currentTurnIndex >= room.gameState.turnOrder.length) room.gameState.currentTurnIndex = 0;

      io.to(roomCode).emit("player_left", { id: socket.id, name });
      if (Object.keys(room.players).length === 0) delete rooms[roomCode];
      else sendRoomState(roomCode);
      break;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});