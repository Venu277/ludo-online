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
const roomBadge = document.getElementById("roomBadge");
const roomHint = document.getElementById("roomHint");
const playersDiv = document.getElementById("players");
const rollBtn = document.getElementById("rollBtn");
const diceEl = document.getElementById("dice");
const diceCube = diceEl.querySelector(".cube");
const diceTray = diceEl.closest(".dice-tray");
const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const emojiBtns = document.querySelectorAll(".emoji-btn");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const themeToggle = document.getElementById("themeToggle");

const leaderboardOverlay = document.getElementById("leaderboard-overlay");
const winnerText = document.getElementById("winnerText");
const leaderboardList = document.getElementById("leaderboard-list");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

// ============================================================================
// 2. AUDIO ENGINE (unchanged)
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
const SAFE_SQUARES = new Set([1, 9, 14, 22, 27, 35, 40, 48]);

// Pawn / UI colours (kept in sync with the CSS --c-* variables)
const PIECE = { red: "#e5484d", green: "#34b765", yellow: "#f5b82e", blue: "#3b82f0" };
const COLORS = PIECE; // alias so older references keep working

// Where each colour's yard sits, and where the 4 pawn sockets are inside it (in cell units)
const ZONE_ORIGIN = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] }; // [colOffset, rowOffset]
const HOME_SLOTS = [[2.05, 2.05], [3.95, 2.05], [2.05, 3.95], [3.95, 3.95]];

// Board palettes - one per theme
const PALETTES = {
  light: {
    boardA: "#fbf4e4", boardB: "#eadcc0",
    tileTop: "#fffdf6", tileBot: "#ece0c8",
    tileHi: "rgba(255,255,255,0.95)", tileLo: "rgba(120,85,40,0.32)", tileDrop: "rgba(90,60,25,0.30)",
    nestA: "#e6d8bc", nestB: "#f5ebd6",
    nestDark: "rgba(90,60,25,0.38)", nestLight: "rgba(255,255,255,0.9)",
    socketA: "#d3c2a0", socketB: "#eee2cb",
    star: "rgba(160,115,45,0.55)", grain: "rgba(110,75,30,", grainAlpha: 0.07,
    hubA: "#fff4cc", hubB: "#e3b04a", hubC: "#9d6a18"
  },
  dark: {
    boardA: "#3b332b", boardB: "#292320",
    tileTop: "#4b4137", tileBot: "#382f27",
    tileHi: "rgba(255,240,215,0.16)", tileLo: "rgba(0,0,0,0.6)", tileDrop: "rgba(0,0,0,0.55)",
    nestA: "#171310", nestB: "#2b2420",
    nestDark: "rgba(0,0,0,0.7)", nestLight: "rgba(255,240,215,0.09)",
    socketA: "#120e0c", socketB: "#2e2723",
    star: "rgba(255,226,160,0.5)", grain: "rgba(255,235,200,", grainAlpha: 0.05,
    hubA: "#ffe9a8", hubB: "#d9a23a", hubC: "#8a5a10"
  }
};

let currentRoom = null, currentPlayer = null, allPlayers = [], animatingPawn = null;
let gameState = { pawns: {}, finished: {}, turnOrder: [], currentTurnIndex: 0, lastDice: null };
let pendingRoomState = null; // QUEUE FOR SERVER SYNC
let diceRolling = false;
let boardLayer = null, boardLayerKey = ""; // cached, pre-rendered board

// ============================================================================
// 4. THEME (light / dark)
// ============================================================================
const THEME_KEY = "ludo-theme";

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute("aria-checked", String(theme === "dark"));
  if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) {} }
  boardLayer = null; // force the board to be redrawn in the new palette
  renderAll();
}

themeToggle.addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));

// Follow the system setting until the player picks a theme themselves
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (err) {}
  if (!saved) applyTheme(e.matches ? "dark" : "light", false);
});

// ============================================================================
// 5. UI EVENT LISTENERS
// ============================================================================
document.body.addEventListener("click", () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Player";
  const roomCode = roomInput.value.trim() || "LUDO1";
  currentRoom = roomCode.toUpperCase();
  socket.emit("join_room", { roomCode: currentRoom, name });
});
[nameInput, roomInput].forEach(el => el.addEventListener("keydown", (e) => { if (e.key === "Enter") joinBtn.click(); }));

rollBtn.addEventListener("click", () => { if (currentRoom) socket.emit("roll_dice", { roomCode: currentRoom }); });

sendBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
emojiBtns.forEach(btn => { btn.addEventListener("click", () => { chatInput.value += btn.textContent; chatInput.focus(); }); });

roomBadge.addEventListener("click", async () => {
  if (!currentRoom) return;
  try {
    await navigator.clipboard.writeText(currentRoom);
    roomHint.textContent = "Copied!";
    setTimeout(() => { roomHint.textContent = "Copy"; }, 1400);
  } catch (e) {}
});

// Which pawn (if any) is under the pointer?
function pawnIndexAt(e) {
  const pawns = gameState.pawns?.[currentPlayer?.id];
  if (!Array.isArray(pawns)) return -1;
  const rect = canvas.getBoundingClientRect(), scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX, clickY = (e.clientY - rect.top) * scaleY;
  const pawnRadius = (canvas.width / 15) * 0.4;
  for (let i = 0; i < pawns.length; i++) {
    const coords = getPawnCoordinates(currentPlayer.color, pawns[i], i);
    if (Math.hypot(clickX - coords.x, clickY - coords.y) <= pawnRadius) return i;
  }
  return -1;
}

canvas.addEventListener("click", (e) => {
  if (!currentRoom || !currentPlayer || animatingPawn) return;
  const pawns = gameState.pawns?.[currentPlayer.id];
  if (!Array.isArray(pawns) || !gameState.lastDice) return;

  const clickedPawnIndex = pawnIndexAt(e);
  if (clickedPawnIndex !== -1) {
    socket.emit("move_pawn", { roomCode: currentRoom, pawnIndex: clickedPawnIndex });
  }
});

canvas.addEventListener("mousemove", (e) => {
  let pointer = false;
  if (currentPlayer && isMyMoveTime()) {
    const i = pawnIndexAt(e);
    pointer = i !== -1 && canMovePawn(gameState.pawns[currentPlayer.id][i], gameState.lastDice, currentPlayer.color);
  }
  canvas.style.cursor = pointer ? "pointer" : "default";
});

leaveRoomBtn.addEventListener("click", () => { location.reload(); });

// ============================================================================
// 6. SOCKET LISTENERS & QUEUE LOGIC
// ============================================================================
function applyRoomState(state) {
  allPlayers = state.players || allPlayers;
  gameState = state.gameState || gameState;
  ensureGameStateShape();
  if (gameState.lastDice && !diceRolling) setDiceFace(gameState.lastDice, false);
  updateTurnUI();
  renderAll();
}

socket.on("joined_room", (data) => {
  currentRoom = data.roomCode; currentPlayer = data.you;
  joinScreen.classList.remove("active"); joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  roomTitle.textContent = currentRoom;
  applyRoomState(data);
});

socket.on("room_state", (state) => {
  // If animating, queue the update. Otherwise apply immediately.
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
  diceRolling = true;
  diceEl.classList.remove("rolling"); diceTray.classList.remove("rolling");
  void diceEl.offsetWidth; // restart the CSS animation
  diceEl.classList.add("rolling"); diceTray.classList.add("rolling");
  diceCube.classList.remove("settle");
  let rolls = 0;

  const rollInterval = setInterval(() => {
    tumbleDice();
    rolls++;

    if (rolls > 10) {
      clearInterval(rollInterval);
      diceEl.classList.remove("rolling"); diceTray.classList.remove("rolling");
      setDiceFace(value, true); // settle on the real number
      diceRolling = false;

      gameState.lastDice = value;
      addMessage(`System: Dice rolled -> ${value}`, "system");
      updateTurnUI();
      renderAll(); // shows which pawns can move

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

    // 2. Process any queued server syncs to guarantee zero desync
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
  winnerText.textContent = `${winner} wins!`;
  leaderboardList.innerHTML = "";

  leaderboard.forEach((player, index) => {
    const item = document.createElement("div");
    item.className = `leaderboard-item rank-${index + 1}`;
    item.style.setProperty("--c", PIECE[player.color] || PIECE.blue);

    const medal = document.createElement("span");
    medal.className = "medal";
    medal.textContent = index + 1;

    const nameSpan = document.createElement("span");
    nameSpan.className = "lb-name";
    nameSpan.textContent = player.name;

    const statSpan = document.createElement("span");
    statSpan.className = "lb-stat";
    statSpan.textContent = `${player.finished} / 4 home`;

    item.append(medal, nameSpan, statSpan);
    leaderboardList.appendChild(item);
  });

  leaderboardOverlay.classList.remove("hidden");
});

socket.on("not_your_turn", () => { sounds.error(); addMessage("System: Not your turn.", "system"); });
socket.on("must_roll_first", () => { sounds.error(); addMessage("System: Roll dice first.", "system"); });
socket.on("must_roll_6_to_leave_home", () => { sounds.error(); addMessage("System: Need a 6 to leave home.", "system"); });

// ============================================================================
// 7. HELPERS
// ============================================================================
// Same rules as before, split per pawn so the board can highlight movable pawns.
function canMovePawn(pos, dice, color) {
  if (pos === -1) return dice === 6;
  if (pos >= 0 && pos < 52) {
    const rel = (pos - START_INDEX[color] + 52) % 52;
    return rel + dice < 51 || rel + dice - 51 <= 6;
  }
  if (pos >= 52 && pos < 58) return pos - 52 + dice <= 6;
  return false;
}
function hasAnyValidMove(pawns, dice, color) {
  if (!pawns || !Array.isArray(pawns)) return false;
  return pawns.some(pos => canMovePawn(pos, dice, color));
}
function isMyMoveTime() {
  return !!currentPlayer && !diceRolling && !animatingPawn && gameState.lastDice !== null &&
    gameState.turnOrder[gameState.currentTurnIndex] === currentPlayer.id;
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
  const div = document.createElement("div");
  div.className = "message " + type;

  if (type === "user") {
    const i = text.indexOf(": ");
    const name = i > -1 ? text.slice(0, i) : "";
    const body = i > -1 ? text.slice(i + 2) : text;
    const who = allPlayers.find(p => p.name === name);
    if (who) div.style.setProperty("--c", PIECE[who.color]);
    if (currentPlayer && name === currentPlayer.name) div.classList.add("mine");

    const n = document.createElement("span"); n.className = "msg-name"; n.textContent = name;
    const b = document.createElement("span"); b.className = "msg-text"; b.textContent = body;
    div.append(n, b);
  } else {
    div.textContent = text.replace(/^System:\s*/, "");
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function setTurnColor(color) {
  const root = document.documentElement.style;
  root.setProperty("--turn-color", PIECE[color] || PIECE.blue);
  root.setProperty("--turn-ink", color === "yellow" ? "#4a3200" : "#ffffff");
}
function updateTurnUI() {
  if (!gameState.turnOrder.length || !currentPlayer) return;
  const currentTurnId = gameState.turnOrder[gameState.currentTurnIndex];
  const isMyTurn = currentTurnId === currentPlayer.id;
  const turnPlayer = allPlayers.find(p => p.id === currentTurnId);

  rollBtn.disabled = !isMyTurn || gameState.lastDice !== null;
  rollBtn.textContent = !isMyTurn ? "Waiting..." : (gameState.lastDice !== null ? "Pick a pawn" : "Roll dice");
  if (turnPlayer) setTurnColor(turnPlayer.color);

  playersDiv.innerHTML = "";
  allPlayers.forEach(p => {
    const row = document.createElement("div");
    row.className = "player-row" + (p.id === currentTurnId ? " active" : "");
    row.dataset.color = p.color;
    row.style.setProperty("--c", PIECE[p.color]);

    const dot = document.createElement("span"); dot.className = "pawn-dot";
    const name = document.createElement("span"); name.className = "player-name"; name.textContent = p.name;
    row.append(dot, name);

    if (p.id === currentPlayer.id) {
      const you = document.createElement("span"); you.className = "you-tag"; you.textContent = "(you)";
      row.appendChild(you);
    }
    if (p.id === currentTurnId) {
      const tag = document.createElement("span"); tag.className = "turn-tag"; tag.textContent = "Turn";
      row.appendChild(tag);
    }
    playersDiv.appendChild(row);
  });
}

// ============================================================================
// 8. 3D DICE
// ============================================================================
const PIP_LAYOUT = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
};
// cube rotation [x, y] that brings each face to the front
const DICE_FACE = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const DICE_TILT = [-14, 18]; // resting angle so it reads as a real cube

(function buildDice() {
  for (let v = 1; v <= 6; v++) {
    const face = document.createElement("div");
    face.className = `face face-${v}`;
    PIP_LAYOUT[v].forEach(([row, col]) => {
      const pip = document.createElement("span");
      pip.className = "pip";
      pip.style.gridRow = row; pip.style.gridColumn = col;
      face.appendChild(pip);
    });
    diceCube.appendChild(face);
  }
})();

function setCube(a, b, c, d) {
  diceCube.style.transform = `rotateX(${a}deg) rotateY(${b}deg) rotateX(${c}deg) rotateY(${d}deg)`;
}
function tumbleDice() {
  const r = () => (Math.floor(Math.random() * 9) - 4) * 90 + (Math.random() * 40 - 20);
  setCube(DICE_TILT[0] + r(), DICE_TILT[1] + r(), r(), r());
}
function setDiceFace(v, animate) {
  if (!DICE_FACE[v]) return;
  diceCube.classList.toggle("settle", !!animate);
  const [fx, fy] = DICE_FACE[v];
  setCube(DICE_TILT[0], DICE_TILT[1], fx, fy);
  diceEl.setAttribute("aria-label", `Dice shows ${v}`);
}

// ============================================================================
// 9. CANVAS RENDERING
// ============================================================================
function animatePawnMove(color, index, oldPos, newPos, onComplete) {
  const start = getPawnCoordinates(color, oldPos, index), end = getPawnCoordinates(color, newPos, index);
  const cell = canvas.width / 15;
  const dist = Math.hypot(end.x - start.x, end.y - start.y) / cell;
  const speed = 0.075 / Math.max(1, dist / 3.5); // longer hops take a little longer
  sounds.hop();
  animatingPawn = { color, index, startX: start.x, startY: start.y, endX: end.x, endY: end.y, progress: 0 };
  function step() {
    animatingPawn.progress += speed;
    if (animatingPawn.progress >= 1) { animatingPawn = null; onComplete(); }
    else { renderAll(); requestAnimationFrame(step); }
  }
  requestAnimationFrame(step);
}

function renderAll() {
  const size = 15, cell = canvas.width / size;
  const pal = PALETTES[currentTheme()];

  // The board never changes between moves, so it is drawn once and cached.
  const key = currentTheme() + canvas.width;
  if (!boardLayer || boardLayerKey !== key) {
    boardLayer = buildBoardLayer(pal, cell);
    boardLayerKey = key;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(boardLayer, 0, 0);

  drawPawns();

  if (animatingPawn) {
    const t = animatingPawn.progress;
    const p = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
    const groundY = animatingPawn.startY + (animatingPawn.endY - animatingPawn.startY) * p;
    const currentX = animatingPawn.startX + (animatingPawn.endX - animatingPawn.startX) * p;
    const currentY = groundY - (Math.sin(t * Math.PI) * (cell * 0.8));
    drawSinglePawn(currentX, currentY, animatingPawn.color, cell, true, 1, groundY, false);
  }
}

// ---------- colour + shape helpers ----------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
// amt > 0 lightens toward white, amt < 0 darkens toward black
function shade(hex, amt) {
  const target = amt >= 0 ? 255 : 0, a = Math.abs(amt);
  return rgbToHex(hexToRgb(hex).map(v => v + (target - v) * a));
}
function blend(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
}
function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function roundRectPath(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function starPath(g, cx, cy, outer, inner) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? outer : inner, ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
    i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  g.closePath();
}

// A raised, bevelled plate
function drawRaised(g, x, y, w, h, r, top, bot, pal, lift) {
  g.save();
  g.shadowColor = pal.tileDrop; g.shadowBlur = lift * 2.4; g.shadowOffsetY = lift;
  const fill = g.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, top); fill.addColorStop(1, bot);
  g.fillStyle = fill; roundRectPath(g, x, y, w, h, r); g.fill();
  g.restore();

  const lw = Math.max(1, lift * 0.9);
  const edge = g.createLinearGradient(x, y, x + w, y + h);
  edge.addColorStop(0, pal.tileHi); edge.addColorStop(0.5, "rgba(255,255,255,0)"); edge.addColorStop(1, pal.tileLo);
  g.lineWidth = lw; g.strokeStyle = edge;
  roundRectPath(g, x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2));
  g.stroke();
}

// A pressed-in, bevelled dish
function drawRecessed(g, x, y, w, h, r, a, b, pal, depth) {
  const fill = g.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, a); fill.addColorStop(1, b);
  g.fillStyle = fill; roundRectPath(g, x, y, w, h, r); g.fill();

  g.save();
  roundRectPath(g, x, y, w, h, r); g.clip();
  const edge = g.createLinearGradient(x, y, x + w, y + h);
  edge.addColorStop(0, pal.nestDark); edge.addColorStop(0.55, "rgba(0,0,0,0)"); edge.addColorStop(1, pal.nestLight);
  g.lineWidth = depth * 2; g.strokeStyle = edge;
  roundRectPath(g, x, y, w, h, r); g.stroke();
  g.restore();
}

// ---------- the cached board ----------
function buildBoardLayer(pal, cell) {
  const W = canvas.width;
  const layer = document.createElement("canvas");
  layer.width = W; layer.height = canvas.height;
  const g = layer.getContext("2d");

  // surface
  const bg = g.createLinearGradient(0, 0, W, W);
  bg.addColorStop(0, pal.boardA); bg.addColorStop(1, pal.boardB);
  g.fillStyle = bg; g.fillRect(0, 0, W, W);

  // yards
  drawZone(g, 0, 0, "red", cell, pal); drawZone(g, 0, 9, "green", cell, pal);
  drawZone(g, 9, 9, "yellow", cell, pal); drawZone(g, 9, 0, "blue", cell, pal);

  drawTrack(g, cell, pal);
  drawCenter(g, cell, pal);

  // fine paper grain on top of everything
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < (W * W) / 70; i++) {
    g.fillStyle = `${pal.grain}${(rnd() * pal.grainAlpha).toFixed(3)})`;
    g.fillRect(rnd() * W, rnd() * W, 1.3, 1.3);
  }
  return layer;
}

function drawZone(g, rowStart, colStart, colorName, cell, pal) {
  const color = PIECE[colorName];
  const x = colStart * cell, y = rowStart * cell, s = 6 * cell, inset = cell * 0.12;

  drawRaised(g, x + inset, y + inset, s - inset * 2, s - inset * 2, cell * 0.55,
    shade(color, 0.24), shade(color, -0.1), pal, cell * 0.1);

  drawRecessed(g, x + cell, y + cell, 4 * cell, 4 * cell, cell * 0.42, pal.nestA, pal.nestB, pal, cell * 0.09);

  // four pawn sockets
  HOME_SLOTS.forEach(([ox, oy]) => {
    const cx = x + ox * cell, cy = y + oy * cell, r = cell * 0.48;
    const dish = g.createLinearGradient(0, cy - r, 0, cy + r);
    dish.addColorStop(0, pal.socketA); dish.addColorStop(1, pal.socketB);
    g.fillStyle = dish; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();

    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    const lip = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    lip.addColorStop(0, pal.nestDark); lip.addColorStop(0.55, "rgba(0,0,0,0)"); lip.addColorStop(1, pal.nestLight);
    g.lineWidth = cell * 0.14; g.strokeStyle = lip;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.restore();

    g.lineWidth = cell * 0.05; g.strokeStyle = alpha(color, 0.65);
    g.beginPath(); g.arc(cx, cy, r * 0.62, 0, Math.PI * 2); g.stroke();
  });
}

function drawTrack(g, cell, pal) {
  const gap = cell * 0.05, size = cell - gap * 2, radius = cell * 0.17, lift = cell * 0.04;
  const startColors = { 1: PIECE.red, 14: PIECE.blue, 27: PIECE.yellow, 40: PIECE.green };

  TRACK.forEach(([r, c], index) => {
    const x = c * cell + gap, y = r * cell + gap;
    const col = startColors[index];
    if (col) drawRaised(g, x, y, size, size, radius, shade(col, 0.26), shade(col, -0.08), pal, lift);
    else drawRaised(g, x, y, size, size, radius, pal.tileTop, pal.tileBot, pal, lift);

    if (SAFE_SQUARES.has(index)) {
      starPath(g, c * cell + cell / 2, r * cell + cell / 2, cell * 0.27, cell * 0.12);
      g.fillStyle = col ? "rgba(255,255,255,0.9)" : pal.star;
      g.fill();
    }
  });

  // home columns (the 6th cell of each is the triangle in the centre)
  Object.entries(HOME_CELLS).forEach(([colorName, cells]) => {
    const col = PIECE[colorName];
    cells.slice(0, 5).forEach(([r, c]) => {
      const x = c * cell + gap, y = r * cell + gap;
      drawRaised(g, x, y, size, size, radius,
        blend(pal.tileTop, col, 0.5), blend(pal.tileBot, col, 0.62), pal, lift);
    });
  });
}

function drawCenter(g, cell, pal) {
  const gap = cell * 0.05, x0 = 6 * cell + gap, y0 = 6 * cell + gap, S = 3 * cell - gap * 2;
  const cx = x0 + S / 2, cy = y0 + S / 2;

  g.save();
  g.shadowColor = pal.tileDrop; g.shadowBlur = cell * 0.3; g.shadowOffsetY = cell * 0.08;
  g.fillStyle = pal.tileBot; roundRectPath(g, x0, y0, S, S, cell * 0.2); g.fill();
  g.restore();

  g.save();
  roundRectPath(g, x0, y0, S, S, cell * 0.2); g.clip();
  const tri = (colorName, ax, ay, bx, by, from) => {
    const col = PIECE[colorName];
    const grad = g.createLinearGradient(from[0], from[1], cx, cy);
    grad.addColorStop(0, shade(col, 0.28)); grad.addColorStop(1, shade(col, -0.12));
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.fill();
    g.lineWidth = Math.max(1, cell * 0.035); g.strokeStyle = "rgba(0,0,0,0.22)"; g.stroke();
  };
  tri("red",    x0,     y0,     x0 + S, y0,     [cx, y0]);
  tri("green",  x0 + S, y0,     x0 + S, y0 + S, [x0 + S, cy]);
  tri("yellow", x0 + S, y0 + S, x0,     y0 + S, [cx, y0 + S]);
  tri("blue",   x0,     y0 + S, x0,     y0,     [x0, cy]);
  g.restore();

  // bevel around the whole centre
  const edge = g.createLinearGradient(x0, y0, x0 + S, y0 + S);
  edge.addColorStop(0, pal.tileHi); edge.addColorStop(0.5, "rgba(255,255,255,0)"); edge.addColorStop(1, pal.tileLo);
  g.lineWidth = cell * 0.05; g.strokeStyle = edge;
  roundRectPath(g, x0 + cell * 0.025, y0 + cell * 0.025, S - cell * 0.05, S - cell * 0.05, cell * 0.18); g.stroke();

  // brass hub
  g.save();
  g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = cell * 0.2; g.shadowOffsetY = cell * 0.07;
  const hub = g.createRadialGradient(cx - cell * 0.15, cy - cell * 0.18, cell * 0.04, cx, cy, cell * 0.44);
  hub.addColorStop(0, pal.hubA); hub.addColorStop(0.55, pal.hubB); hub.addColorStop(1, pal.hubC);
  g.fillStyle = hub; g.beginPath(); g.arc(cx, cy, cell * 0.4, 0, Math.PI * 2); g.fill();
  g.restore();
  g.lineWidth = cell * 0.04; g.strokeStyle = "rgba(255,255,255,0.45)";
  g.beginPath(); g.arc(cx, cy, cell * 0.27, 0, Math.PI * 2); g.stroke();
}

// ---------- pawns ----------
function getPawnCoordinates(playerColor, pos, pawnIndex) {
  const cell = canvas.width / 15; let x, y;
  if (pos === -1) {
    const [ox, oy] = HOME_SLOTS[pawnIndex];
    const [dx, dy] = ZONE_ORIGIN[playerColor] || [0, 0];
    x = (ox + dx) * cell; y = (oy + dy) * cell;
  } else if (pos >= 0 && pos < 52) {
    const [r, c] = TRACK[pos]; x = c * cell + cell / 2; y = r * cell + cell / 2;
  } else if (pos >= 52 && pos < 58) {
    const [r, c] = (HOME_CELLS[playerColor] || [])[pos - 52] || [7, 7]; x = c * cell + cell / 2; y = r * cell + cell / 2;
  } else if (pos >= 100) {
    // finished: parked in the player's own triangle of the centre
    const n = pos - 100, spread = (n - 1.5) * 0.3;
    const spots = {
      red:    [7.5 + spread, 6.62], green: [8.38, 7.5 + spread],
      yellow: [7.5 - spread, 8.38], blue:  [6.62, 7.5 - spread]
    };
    const [sx, sy] = spots[playerColor] || [7.5, 7.5];
    x = sx * cell; y = sy * cell;
  } else { x = 7.5 * cell; y = 7.5 * cell; }
  return { x, y };
}

// A glossy, classic board-game pawn
function drawSinglePawn(x, y, color, cell, isFlying = false, scale = 1, groundY = y, highlight = false) {
  const base = PIECE[color];
  const r = cell * (isFlying ? 0.37 : 0.33) * scale;
  const yy = y - r * 0.1;           // optical centring
  const by = yy + r * 0.85;         // centre of the base
  const headY = yy - r * 0.46;

  // soft ground shadow (stays on the board while the pawn is in the air)
  const air = Math.max(0, Math.min(1, (groundY - y) / (cell * 0.8)));
  ctx.save();
  ctx.translate(x, groundY + r * 0.95 - r * 0.1);
  ctx.scale(1, 0.4);
  const sr = r * 1.2 * (1 - air * 0.3);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
  sh.addColorStop(0, `rgba(0,0,0,${0.42 * (1 - air * 0.5)})`); sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // "you can move this one" ring
  if (highlight) {
    ctx.save();
    ctx.shadowColor = "rgba(255,214,90,0.95)"; ctx.shadowBlur = cell * 0.35;
    ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = "#ffd65a";
    ctx.beginPath(); ctx.ellipse(x, by + r * 0.08, r * 1.2, r * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  const outline = Math.max(1, r * 0.07);

  // base plate
  ctx.fillStyle = shade(base, -0.42);
  ctx.beginPath(); ctx.ellipse(x, by + r * 0.07, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();

  // body
  const body = ctx.createLinearGradient(x - r * 0.85, 0, x + r * 0.85, 0);
  body.addColorStop(0, shade(base, 0.3)); body.addColorStop(0.42, base); body.addColorStop(1, shade(base, -0.36));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.82, by);
  ctx.bezierCurveTo(x - r * 0.55, by - r * 0.38, x - r * 0.36, yy - r * 0.02, x - r * 0.3, yy - r * 0.2);
  ctx.lineTo(x + r * 0.3, yy - r * 0.2);
  ctx.bezierCurveTo(x + r * 0.36, yy - r * 0.02, x + r * 0.55, by - r * 0.38, x + r * 0.82, by);
  ctx.ellipse(x, by, r * 0.82, r * 0.26, 0, 0, Math.PI, false);
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = outline; ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.stroke();

  // collar
  ctx.fillStyle = shade(base, -0.12);
  ctx.beginPath(); ctx.ellipse(x, yy - r * 0.16, r * 0.4, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = outline; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.stroke();

  // head
  const head = ctx.createRadialGradient(x - r * 0.18, headY - r * 0.2, r * 0.04, x, headY, r * 0.58);
  head.addColorStop(0, "rgba(255,255,255,0.95)");
  head.addColorStop(0.22, shade(base, 0.38));
  head.addColorStop(0.68, base);
  head.addColorStop(1, shade(base, -0.4));
  ctx.fillStyle = head;
  ctx.beginPath(); ctx.arc(x, headY, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = outline; ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.stroke();

  // specular glint
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath(); ctx.ellipse(x - r * 0.2, headY - r * 0.22, r * 0.12, r * 0.08, -0.6, 0, Math.PI * 2); ctx.fill();
}

function drawPawns() {
  if (!gameState?.pawns) return;
  const cell = canvas.width / 15;
  const pawnsToDraw = [];
  const canHighlight = isMyMoveTime();

  allPlayers.forEach(player => {
    if (!Array.isArray(gameState.pawns[player.id])) return;
    gameState.pawns[player.id].forEach((pos, index) => {
      if (animatingPawn && animatingPawn.color === player.color && animatingPawn.index === index) return;
      const { x, y } = getPawnCoordinates(player.color, pos, index);
      const movable = canHighlight && currentPlayer && player.id === currentPlayer.id &&
        canMovePawn(pos, gameState.lastDice, player.color);
      pawnsToDraw.push({ color: player.color, index, pos, x, y, movable });
    });
  });

  const groups = {};
  pawnsToDraw.forEach(p => {
    if (p.pos === -1) {
      p.renderX = p.x; p.renderY = p.y; p.scale = 1;
    } else if (p.pos >= 100) {
      p.renderX = p.x; p.renderY = p.y; p.scale = 0.62;
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

  // back-to-front so lower pawns overlap the ones behind them
  pawnsToDraw.sort((a, b) => a.renderY - b.renderY);
  pawnsToDraw.forEach(p => drawSinglePawn(p.renderX, p.renderY, p.color, cell, false, p.scale, p.renderY, p.movable));
}

// ============================================================================
// 10. START-UP
// ============================================================================
setDiceFace(1, false);
applyTheme(currentTheme(), false); // syncs the toggle and draws the empty board
nameInput.focus();
