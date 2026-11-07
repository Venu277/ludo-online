# Ludo Online

A real-time multiplayer Ludo game for up to four players. Create or join a room with a code, roll the dice, and race your pawns to the centre. Built with Node.js, Socket.io and plain HTML, CSS and JavaScript, with a skeuomorphic board-game look and a light and dark theme.

### Live Demo
**[Play the Game Live Here]( https://ludos-online.onrender.com )** 
---

## Features

- **Real-time multiplayer:** Up to 4 players per room, synced over WebSockets (Socket.io).
- **Room codes:** Enter your name and a room code to join. Both are required. Codes are not case-sensitive.
- **Light and dark mode:** A switch on every screen. It follows your system setting until you pick one, then remembers your choice.
- **Skeuomorphic design:** A wooden board frame, raised and pressed-in components, and a 3D dice.
- **Clear move highlights:** When it's your turn, the pawns you can legally move get a glowing ring.
- **Winning square:** A pawn finishes as soon as it lands exactly on the centre square. Overshooting is not allowed.
- **Built-in chat:** Text messages and a quick emoji bar, shown to everyone in the room.
- **Auto-skip:** If you roll a number with no legal move, your turn is skipped automatically.
- **Reconnection:** If your connection drops, the game tries to put you back in your room.
- **Sound effects:** Dice rolls, pawn hops, captures and wins, using the Web Audio API. The game still works if audio is blocked.

---

## How to Play

1. Enter your name and a room code, then click **Enter room**.
2. Share the room code with up to three friends. Click the room code to copy it.
3. Roll the dice on your turn.
4. Click a highlighted pawn to move it.
5. Rolling a 6 brings a pawn out of its yard.
6. Landing on another player's pawn sends it back to its yard.
7. The first player to get all four pawns to the centre wins.

---

## Tech Stack

- **Backend:** Node.js, Express 5, Socket.io 4
- **Frontend:** HTML5 Canvas, vanilla JavaScript, CSS3 (custom properties, Grid, Flexbox)
- **Fonts:** Fredoka and Nunito (Google Fonts)
- **Hosting:** Render

---

## Project Structure

```text
ludo-online/
├── public/
│   ├── index.html       # Login screen, game screen and game-over overlay
│   ├── style.css        # Light and dark themes, board, pawns, dice and layout
│   └── client.js        # Board drawing, dice, chat and socket events
├── server.js            # Express server, room management and game rules
├── package.json         # Dependencies and start script
└── README.md            # This file
```

---

## Getting Started

### Requirements

- Node.js 18 or newer
- npm

### Run locally

```bash
git clone https://github.com/Venu277/ludo-online.git
cd ludo-online
npm install
npm start
```

Then open http://localhost:3000 in your browser. To test multiplayer, open a second browser window or tab, use the same room code, and join with a different name.

The server reads the port from the `PORT` environment variable and defaults to 3000.

---

## Deployment

The app is deployed on Render as a Node.js web service:

- **Build command:** `npm install`
- **Start command:** `npm start`

Each push to the connected branch triggers a new deploy.

---

## Game Rules

- Each player has four pawns, all starting in their yard.
- A pawn leaves its yard only on a roll of **6**.
- Rolling a 6 or capturing a pawn gives an extra turn.
- The coloured start squares and the star-marked squares are safe. Pawns can't be captured there.
- After a full lap, pawns enter their home column, which is only reachable with the exact roll.
- A pawn finishes when it lands exactly on the centre square.
- The first player to finish all four pawns wins. Other players are ranked by finished pawns, then by how far their remaining pawns have travelled.

---

## License

ISC
