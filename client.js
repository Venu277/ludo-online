// ============================================================================
// 1. INITIALIZATION & DOM ELEMENTS
// ============================================================================
const socket = io();

const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const roomTitle = document.getElementById("roomTitle");
const playersDiv = document.getElementById("players");
const rollBtn = document.getElementById("rollBtn");
const diceEl = document.getElementById("dice");
const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const emojiBtns = document.querySelectorAll(".emoji-btn");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const leaderboardOverlay = document.getElementById("leaderboard-overlay");
const winnerText = document.getElementById("winnerText");
const leaderboardList = document.getElementById("leaderboard-list");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

// ============================================================================
// 2. AUDIO ENGINE
// ============================================================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, type, duration, vol = 0.1) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
  roll: () => { let t = 0; for(let i=0; i<5; i++){ setTimeout(()=>playTone(300+Math.random()*200, 'square', 0.1, 0.05), t); t+=60; } },
  hop: () => playTone(500, 'sine', 0.1, 0.05),
  capture: () => { playTone(150, 'sawtooth', 0.3, 0.15); setTimeout(()=>playTone(100, 'sawtooth', 0.4, 0.15), 100); },
  win: () => [523, 659, 783, 1046, 1318].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.3, 0.1), i * 150)),
  error: () => playTone(200, 'square', 0.2, 0.1)
};

// ============================================================================
// 3. GAME CONSTANTS & STATE
// ============================================================================
const TRACK = [
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0],
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7],
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14],
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7]
];

const HOME_CELLS = {
  red:    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]], green:  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]], blue:   [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]
};

const START_INDEX = { red: 1, blue: 14, yellow: 27, green: 40 };

const COLORS = { 
  red: "#ff4757", green: "#2ed573", yellow: "#ffa502", blue: "#1e90ff", 
  bg: "#1e293b", track: "#334155", safe: "#475569", line: "#0f172a" 
};

let currentRoom = null, currentPlayer = null, allPlayers = [], animatingPawn = null;
let gameState = { pawns: {}, finished: {}, turnOrder: [], currentTurnIndex: 0, lastDice: null };
let pendingRoomState = null; // QUEUE FOR SERVER SYNC

// ============================================================================
// 4. UI EVENT LISTENERS
// ============================================================================
document.body.addEventListener("click", () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Player";
  const roomCode = roomInput.value.trim() || "LUDO1";
  currentRoom = roomCode.toUpperCase();
  socket.emit("join_room", { roomCode: currentRoom, name });
});

rollBtn.addEventListener("click", () => { if (currentRoom) socket.emit("roll_dice", { roomCode: currentRoom }); });

sendBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
emojiBtns.forEach(btn => { btn.addEventListener("click", () => { chatInput.value += btn.textContent; chatInput.focus(); }); });

canvas.addEventListener("click", (e) => {
  if (!currentRoom || !currentPlayer || animatingPawn) return;
  const pawns = gameState.pawns?.[currentPlayer.id];
  if (!Array.isArray(pawns) || !gameState.lastDice) return;

  const rect = canvas.getBoundingClientRect(), scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX, clickY = (e.clientY - rect.top) * scaleY;
  const pawnRadius = (canvas.width / 15) * 0.4;
  let clickedPawnIndex = -1;

  for (let i = 0; i < pawns.length; i++) {
    const coords = getPawnCoordinates(currentPlayer.color, pawns[i], i);
    if (Math.hypot(clickX - coords.x, clickY - coords.y) <= pawnRadius) { clickedPawnIndex = i; break; }
  }

  if (clickedPawnIndex !== -1) {
    socket.emit("move_pawn", { roomCode: currentRoom, pawnIndex: clickedPawnIndex });
  }
});

leaveRoomBtn.addEventListener("click", () => { location.reload(); });

// ============================================================================
// 5. SOCKET LISTENERS & QUEUE LOGIC
// ============================================================================
function applyRoomState(state) {
  allPlayers = state.players || allPlayers; 
  gameState = state.gameState || gameState;
  ensureGameStateShape(); 
  updateTurnUI(); 
  renderAll();
}

socket.on("joined_room", (data) => {
  currentRoom = data.roomCode; currentPlayer = data.you; 
  joinScreen.classList.remove("active"); joinScreen.classList.add("hidden"); 
  gameScreen.classList.remove("hidden");
  roomTitle.textContent = `Room: ${currentRoom}`; 
  applyRoomState(data);
});

socket.on("room_state", (state) => {
  // THE FIX: If animating, queue the update. Otherwise apply immediately.
  if (animatingPawn) {
    pendingRoomState = state;
    return;
  }
  applyRoomState(state);
});

socket.on("player_joined", ({ player }) => addMessage(`System: ${player.name} joined`, "system"));
socket.on("player_left", ({ name }) => addMessage(`System: ${name} left`, "system"));

socket.on("dice_rolled", ({ value }) => {
  sounds.roll(); 
  diceEl.classList.add("rolling-dice");
  let rolls = 0;
  
  const rollInterval = setInterval(() => {
    diceEl.textContent = Math.floor(Math.random() * 6) + 1; // Flash random bold numbers
    rolls++;
    
    if (rolls > 10) {
      clearInterval(rollInterval); 
      diceEl.classList.remove("rolling-dice"); 
      diceEl.textContent = value; // Lock in the final number
      
      gameState.lastDice = value; 
      addMessage(`System: Dice rolled -> ${value}`, "system"); 
      updateTurnUI();

      if (currentPlayer && gameState.turnOrder[gameState.currentTurnIndex] === currentPlayer.id) {
        if (!hasAnyValidMove(gameState.pawns[currentPlayer.id], value, currentPlayer.color)) {
          addMessage("System: No moves possible. Auto-skipping...", "system");
          setTimeout(() => { if (gameState.lastDice !== null) socket.emit("skip_turn", { roomCode: currentRoom }); }, 1500);
        }
      }
    }
  }, 50);
});

socket.on("chat_message", ({ name, text }) => addMessage(`${name}: ${text}`, "user"));

socket.on("pawn_moved", ({ playerId, pawnIndex, newPos, oldPos, currentTurnIndex, turnOrder }) => {
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return;
  
  animatePawnMove(player.color, pawnIndex, oldPos, newPos, () => {
    // 1. Manually update state right after landing
    if (!gameState.pawns) gameState.pawns = {};
    if (gameState.pawns[playerId]) gameState.pawns[playerId][pawnIndex] = newPos;
    if (turnOrder) gameState.turnOrder = turnOrder;
    if (typeof currentTurnIndex === 'number') gameState.currentTurnIndex = currentTurnIndex;
    gameState.lastDice = null; 
    
    updateTurnUI(); 
    renderAll();

    // 2. THE FIX: Process any queued server syncs to guarantee zero desync
    if (pendingRoomState) {
      applyRoomState(pendingRoomState);
      pendingRoomState = null;
    }
  });
});

socket.on("pawn_captured", ({ by, victim, victimPawnIndex }) => {
  sounds.capture();
  const a = allPlayers.find(p => p.id === by), b = allPlayers.find(p => p.id === victim);
  if (gameState.pawns && gameState.pawns[victim]) {
    gameState.pawns[victim][victimPawnIndex] = -1;
  }
  addMessage(`System: ⚔️ ${a ? a.name : "Player"} captured ${b ? b.name : "someone"}!`, "system"); 
});

socket.on("turn_skipped", ({ playerId }) => {
  const p = allPlayers.find(x => x.id === playerId);
  addMessage(`System: ${p ? p.name : "A player"} skipped.`, "system");
  gameState.lastDice = null;
});

socket.on("game_over", ({ winner, leaderboard }) => {
  sounds.win();
  winnerText.textContent = `🏆 ${winner} wins! 🏆`;
  leaderboardList.innerHTML = ""; 

  leaderboard.forEach((player, index) => {
    const item = document.createElement("div");
    item.className = `leaderboard-item rank-${index + 1}`;
    
    const leftSide = document.createElement("div");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = `#${index + 1}  ${player.name}`;
    nameSpan.style.color = COLORS[player.color];
    leftSide.appendChild(nameSpan);

    const statSpan = document.createElement("span");
    statSpan.textContent = `${player.finished} / 4 Home`;
    statSpan.style.fontSize = "0.9rem";
    statSpan.style.color = "#cbd5e1";

    item.appendChild(leftSide);
    item.appendChild(statSpan);
    leaderboardList.appendChild(item);
  });
  
  leaderboardOverlay.classList.remove("hidden");
});

socket.on("not_your_turn", () => { sounds.error(); addMessage("System: Not your turn.", "system"); });
socket.on("must_roll_first", () => { sounds.error(); addMessage("System: Roll dice first.", "system"); });
socket.on("must_roll_6_to_leave_home", () => { sounds.error(); addMessage("System: Need a 6 to leave home.", "system"); });

// ============================================================================
// 6. HELPERS
// ============================================================================
function hasAnyValidMove(pawns, dice, color) {
  if (!pawns || !Array.isArray(pawns)) return false;
  for (let pos of pawns) {
    if (pos === -1 && dice === 6) return true;
    else if (pos >= 0 && pos < 52) {
      const rel = (pos - START_INDEX[color] + 52) % 52;
      if (rel + dice < 51 || rel + dice - 51 <= 6) return true;
    } else if (pos >= 52 && pos < 58 && pos - 52 + dice <= 6) return true;
  }
  return false; 
}
function ensureGameStateShape() {
  if (!gameState.pawns) gameState.pawns = {}; if (!gameState.turnOrder) gameState.turnOrder = [];
  if (typeof gameState.currentTurnIndex !== "number") gameState.currentTurnIndex = 0;
}
function sendChat() {
  const text = chatInput.value.trim();
  if (!text || !currentRoom || !currentPlayer) return;
  socket.emit("chat_message", { roomCode: currentRoom, name: currentPlayer.name, text });
  chatInput.value = "";
}
function addMessage(text, type) {
  const div = document.createElement("div"); div.className = "message " + type; div.textContent = text;
  messagesDiv.appendChild(div); messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function updateTurnUI() {
  if (!gameState.turnOrder.length || !currentPlayer) return;
  const currentTurnId = gameState.turnOrder[gameState.currentTurnIndex];
  rollBtn.disabled = !(currentTurnId === currentPlayer.id) || gameState.lastDice !== null;
  playersDiv.innerHTML = "";
  allPlayers.forEach(p => {
    const div = document.createElement("div");
    div.textContent = `${p.id === currentTurnId ? "▶ " : "  "}${p.name}`;
    if (p.id === currentTurnId) { div.style.backgroundColor = "rgba(255,255,255,0.1)"; }
    div.style.color = COLORS[p.color]; playersDiv.appendChild(div);
  });
}

// ============================================================================
// 7. CANVAS RENDERING
// ============================================================================
function animatePawnMove(color, index, oldPos, newPos, onComplete) {
  const start = getPawnCoordinates(color, oldPos, index), end = getPawnCoordinates(color, newPos, index);
  sounds.hop();
  animatingPawn = { color, index, startX: start.x, startY: start.y, endX: end.x, endY: end.y, progress: 0 };
  function step() {
    animatingPawn.progress += 0.08; 
    if (animatingPawn.progress >= 1) { animatingPawn = null; onComplete(); } 
    else { renderAll(); requestAnimationFrame(step); }
  }
  requestAnimationFrame(step);
}

function renderAll() {
  const size = 15, cell = canvas.width / size;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = COLORS.line; ctx.lineWidth = 2;
  for (let i = 0; i <= size; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
  }

  drawHomeZone(0, 0, COLORS.red); drawHomeZone(0, 9, COLORS.green);
  drawHomeZone(9, 9, COLORS.yellow); drawHomeZone(9, 0, COLORS.blue);
  
  ctx.fillStyle = "#0f172a"; ctx.fillRect(6 * cell, 6 * cell, 3 * cell, 3 * cell);
  drawTrack(); drawPawns();

  if (animatingPawn) {
    const p = animatingPawn.progress;
    const currentX = animatingPawn.startX + (animatingPawn.endX - animatingPawn.startX) * p;
    const currentY = animatingPawn.startY + (animatingPawn.endY - animatingPawn.startY) * p - (Math.sin(p * Math.PI) * (cell * 0.8));
    drawSinglePawn(currentX, currentY, animatingPawn.color, cell, true, 1);
  }
}

function drawHomeZone(rowStart, colStart, color) {
  const cell = canvas.width / 15; 
  ctx.fillStyle = color; ctx.fillRect(colStart * cell, rowStart * cell, 6 * cell, 6 * cell);
  ctx.fillStyle = COLORS.bg; ctx.fillRect((colStart + 1) * cell, (rowStart + 1) * cell, 4 * cell, 4 * cell);
}

function drawTrack() {
  const cell = canvas.width / 15;
  const safeSquaresSet = new Set([1, 9, 14, 22, 27, 35, 40, 48]);
  
  // THE FIX: Define the specific starting tiles for each color
  const startColors = { 1: COLORS.red, 14: COLORS.blue, 27: COLORS.yellow, 40: COLORS.green };

  TRACK.forEach(([r, c], index) => {
    if (startColors[index]) {
      ctx.fillStyle = startColors[index];
    } else if (safeSquaresSet.has(index)) {
      ctx.fillStyle = COLORS.safe;
    } else {
      ctx.fillStyle = COLORS.track;
    }
    ctx.fillRect(c * cell, r * cell, cell, cell);
  });

  Object.entries(HOME_CELLS).forEach(([colorName, cells]) => {
    ctx.fillStyle = COLORS[colorName]; ctx.globalAlpha = 0.4;
    cells.forEach(([r, c]) => ctx.fillRect(c * cell, r * cell, cell, cell)); 
    ctx.globalAlpha = 1.0;
  });
}

function getPawnCoordinates(playerColor, pos, pawnIndex) {
  const cell = canvas.width / 15; let x, y;
  if (pos === -1) {
    const [ox, oy] = [[1.8, 1.8], [3.2, 1.8], [1.8, 3.2], [3.2, 3.2]][pawnIndex];
    if (playerColor === "red") { x = ox; y = oy; }
    if (playerColor === "green") { x = ox + 9; y = oy; }
    if (playerColor === "yellow") { x = ox + 9; y = oy + 9; }
    if (playerColor === "blue") { x = ox; y = oy + 9; }
    x *= cell; y *= cell;
  } else if (pos >= 0 && pos < 52) {
    const [r, c] = TRACK[pos]; x = c * cell + cell / 2; y = r * cell + cell / 2;
  } else if (pos >= 52 && pos < 58) {
    const [r, c] = (HOME_CELLS[playerColor] || [])[pos - 52] || [7, 7]; x = c * cell + cell / 2; y = r * cell + cell / 2;
  } else { x = 7.5 * cell; y = 7.5 * cell; }
  return { x, y };
}

function drawSinglePawn(x, y, color, cell, isFlying = false, scale = 1) {
  const radius = cell * (isFlying ? 0.4 : 0.35) * scale;
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = isFlying ? 15 : 6;
  ctx.shadowOffsetY = isFlying ? 10 : 3;

  ctx.fillStyle = COLORS[color];
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";
  
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.beginPath(); ctx.arc(x - radius*0.3, y - radius*0.3, radius*0.3, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = "#ffffff"; 
  ctx.lineWidth = Math.max(1, 2 * scale); 
  ctx.stroke();
}

function drawPawns() {
  if (!gameState?.pawns) return; 
  const cell = canvas.width / 15;
  const pawnsToDraw = [];

  allPlayers.forEach(player => {
    if (!Array.isArray(gameState.pawns[player.id])) return;
    gameState.pawns[player.id].forEach((pos, index) => {
      if (animatingPawn && animatingPawn.color === player.color && animatingPawn.index === index) return;
      const { x, y } = getPawnCoordinates(player.color, pos, index);
      pawnsToDraw.push({ color: player.color, index, pos, x, y });
    });
  });

  const groups = {};
  pawnsToDraw.forEach(p => {
    if (p.pos === -1 || p.pos >= 100) { 
      p.renderX = p.x; p.renderY = p.y; p.scale = 1;
    } else {
      const key = `${Math.round(p.x)},${Math.round(p.y)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
  });

  Object.values(groups).forEach(group => {
    const count = group.length;
    group.forEach((p, i) => {
      if (count === 1) { p.renderX = p.x; p.renderY = p.y; p.scale = 1; } 
      else if (count === 2) {
        p.renderX = p.x + (i === 0 ? -cell * 0.18 : cell * 0.18); p.renderY = p.y; p.scale = 0.8; 
      } 
      else if (count === 3) {
        if (i === 0) { p.renderX = p.x; p.renderY = p.y - cell * 0.15; }
        else if (i === 1) { p.renderX = p.x - cell * 0.15; p.renderY = p.y + cell * 0.15; }
        else { p.renderX = p.x + cell * 0.15; p.renderY = p.y + cell * 0.15; }
        p.scale = 0.7;
      } 
      else { 
        const row = Math.floor(i / 2), col = i % 2;
        p.renderX = p.x + (col === 0 ? -cell * 0.15 : cell * 0.15);
        p.renderY = p.y + (row === 0 ? -cell * 0.15 : cell * 0.15);
        p.scale = 0.7;
      }
    });
  });

  pawnsToDraw.forEach(p => drawSinglePawn(p.renderX, p.renderY, p.color, cell, false, p.scale));
}