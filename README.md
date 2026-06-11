# ⚔️ Pixel Conquest - Real-Time Shared Grid App

Pixel Conquest is a real-time, multiplayer shared grid app where players claim cells, defend areas under lock protection, track statistics, and climb the leaderboard in real time. 

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm (v8+)

### Running Locally
You can run the entire stack (both client and server) with a single command from the project root:

1. Clone the repository and navigate to the directory:
   ```bash
   cd pixel-conquest
   ```
2. Install all dependencies for the root, frontend, and backend:
   ```bash
   npm run install:all
   ```
3. Start the client and server concurrently in development mode:
   ```bash
   npm run dev
   ```
   - **Frontend UI**: available at `http://localhost:5173`
   - **Backend Server**: running at `http://localhost:5050`

---

## 🛠️ Tech Stack & Choices

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React (Vite-based) | Scaffolds rapidly, offers extremely fast HMR, and manages cellular components state cleanly. |
| **Real-time Sync** | Socket.io / Socket.io-client | Handles WebSocket connections, automatically manages heartbeat packets, and provides automatic fallback and reconnection. |
| **Backend API** | Node.js + Express | Lightweight, event-driven runtime perfect for handling concurrent network requests and I/O. |
| **Styling** | Vanilla CSS (CSS Variables) | Avoids library overhead, gives pixel-perfect styling for glassmorphism, dynamic grids, neon borders, and complex mouse cursor positioning. |
| **State Storage** | In-Memory + JSON Persistence | State is stored in RAM for sub-millisecond lookups during concurrent clicks, and serialized to `state.json` on changes to survive server restarts. |
| **Sound Engine** | Web Audio API | Client-side synth oscillators (sine/sawtooth/triangle) generate sounds programmatically, eliminating external audio file assets download lag. |

---

## 🔄 Real-time Update Strategy & Cursors

1. **Cell Capture & Validation**:
   - When a user clicks a cell, the client predicts no local state change. Instead, it emits a `claim_cell` event over WebSockets.
   - The server validates the action against **Player Cooldowns** (3s) and **Cell Shield Protection** (10s lock).
   - If valid, the server commits the state, serializes it, and broadcasts `cell_updated` and `activity_log` events to all clients.
   - The client receives the update, plays a synth chime, and triggers a dynamic CSS particle burst at the tile coordinates.

2. **Throttled Live Cursors**:
   - To make the canvas feel alive, players see other active users' cursors moving on the grid.
   - To prevent network congestion, the client **throttles cursor movements** to 60ms (approx. 16 packets/sec).
   - The server forwards these movements via `cursor_updated` events. Cursors are rendered using absolute sub-pixel positioning inside the zoom-pan container to scale perfectly across zoom levels.

3. **Latency Hearts (Ping)**:
   - A custom heartbeat loop emits volatile ping events every 4 seconds. The roundtrip latency is measured and rendered in the HUD, providing live connection statistics.

---

## ⚖️ Trade-offs & Architecture Decisions

- **DOM vs. Canvas Grid**:
  - *Trade-off*: Rendering a grid in HTML DOM (using a 32x32 CSS grid of divs) increases the DOM node count compared to an HTML5 Canvas.
  - *Decision*: We chose DOM rendering for its flexibility. It allows CSS transitions for smooth color transitions, hover tooltips, lock shield animations, and particle bursts without writing complex canvas state engines and raycast boundary calculations. This easily scales up to 1,600 cells (40x40) at 60fps.
- **In-Memory Store vs. Relational/NoSQL Database**:
  - *Trade-off*: An in-memory store will lose data if the server crashes (solved by appending file-based writes to `state.json`). It is not suitable for horizontally scaled clusters.
  - *Decision*: For a prototype grid, RAM-based memory lookups avoid database queries overhead and solve concurrency locking easily since Javascript runs on a single thread. This handles conflict resolution naturally.
- **Socket.io vs. Native WebSockets**:
  - *Trade-off*: Socket.io adds a small library footprint on the client (approx. 10kb gzipped).
  - *Decision*: The benefits of connection state checking, namespace support, auto-reconnections, and JSON serialization out-of-the-box make it worth the tiny size.

---

## ✨ Implemented Bonus Features

1. **User Identity customization**: Random cyberpunk names (e.g. `QuantumPhantom_412`) and electric colors are generated, with local storage caching and profile change triggers.
2. **Pan & Zoom Container**: Drag the grid canvas using the mouse or trackpad, pinch/scroll to zoom, with custom coordinate tooltips, zoom levels, and double-click perspective reset.
3. **Web Audio Sound Effects**: Fully synthetic sounds (Capture Chime, Error Buzz, Shield Lock warning, Player Join sound) created client-side.
4. **Lock Shields**: Dynamically shrinking visual svg meters on locked cells to warn other players of protection cooldowns.
5. **Interactive Logs**: A terminal log feed at the bottom that announces game operations and identifies "steals" (claims of another player's cell).
6. **Active Cursors**: Live moving pointers with player username badges showing player positions.
7. **Leaderboard**: Real-time scores dynamically calculating cell count and showing active/offline stats.
