# Ludo Online: Retro-Futuristic Multiplayer

An online multiplayer Ludo game built with Node.js, Socket.io, HTML, and CSS. This project transforms the classic board game into a modern web experience featuring a sleek retro-futuristic UI, 3D animations, sound effects, and real-time network synchronization.

### Live Demo
**[Play the Game Live Here]( https://ludos-online.onrender.com )**  
---

## Features

* **Real-Time Multiplayer:** Instant, zero-latency gameplay synced across multiple clients using WebSockets (Socket.io).
* **Retro-Futuristic UI:** A custom dark-mode aesthetic with neon accents, glassmorphic panels, and a fully responsive layout that locks perfectly to the viewport.
* **Advanced Canvas Rendering:** 3D-styled tokens with dynamic radial shadows, smooth canvas interpolation for movement, and an automated micro-clustering system to prevent pieces from overlapping on shared squares.
* **In-Game Chat Engine:** A real-time chat room integrated directly into the gameplay dashboard, featuring a custom quick-emoji panel.
* **Desync Protection:** A custom asynchronous state-queueing system that caches incoming server packets during active pawn animations to guarantee zero visual glitches or screen desynchronization.
* **Smart Turn Logic:** Auto-skip functionality that detects if a player rolls a number with zero possible legal moves, safely yielding the turn to the next player.
* **Audio Synthesis:** Native 8-bit sound effects using the browser's Web Audio API for rolling, capturing, and turn notifications.

---

## Technology Stack

* **Backend:** Node.js, Express.js
* **Real-Time Engine:** Socket.io
* **Frontend:** HTML5 Canvas, Vanilla JavaScript
* **Styling:** CSS3 (Grid, Flexbox, Custom Variables)
* **Hosting/Deployment:** Render

---

## Project Structure

```text
ludo-online/
├── public/
│   ├── index.html       # Main game dashboard and UI structure
│   ├── style.css        # Retro-futuristic styling and animations
│   └── client.js        # Frontend canvas rendering and socket listeners
├── server.js            # Node.js backend, room management, and game logic
├── package.json         # Project dependencies and start scripts
└── README.md            # Project documentation
