const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5050;
const GRID_SIZE = 32; // 32x32 = 1024 cells
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const COOLDOWN_MS = 3000; // 3 seconds player cooldown
const SHIELD_MS = 10000; // 10 seconds protection shield

const STATE_FILE = path.join(__dirname, 'state.json');

const app = express();
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', playersCount: io.engine.clientsCount });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for dev simplicity
    methods: ['GET', 'POST'],
  }
});

// Load or Initialize Grid State
let grid = [];
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    grid = JSON.parse(raw);
    console.log(`Loaded existing grid state with ${grid.length} cells.`);
    
    // Safety check for size mismatch
    if (grid.length !== TOTAL_CELLS) {
      console.warn(`Grid size mismatch (loaded ${grid.length}, expected ${TOTAL_CELLS}). Reinitializing.`);
      initializeGrid();
    }
  } else {
    initializeGrid();
  }
} catch (err) {
  console.error('Error reading state file, initializing fresh grid:', err);
  initializeGrid();
}

function initializeGrid() {
  grid = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    grid.push({
      id: i,
      x: i % GRID_SIZE,
      y: Math.floor(i / GRID_SIZE),
      ownerId: null,
      ownerName: null,
      color: null,
      lockedUntil: 0, // timestamp
    });
  }
  saveState();
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(grid, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving state file:', err);
  }
}

// Active players store: socketId -> player details
const activePlayers = new Map();

// Calculate leaderboard scores
function getLeaderboard() {
  const scores = {};
  
  // Count current cells for active players
  grid.forEach(cell => {
    if (cell.ownerId) {
      scores[cell.ownerId] = (scores[cell.ownerId] || 0) + 1;
    }
  });

  // Format into leaderboard array
  const leaderboard = [];
  activePlayers.forEach((player, socketId) => {
    leaderboard.push({
      id: socketId,
      name: player.name,
      color: player.color,
      score: scores[socketId] || 0,
    });
  });

  // Add historical players that might have cells but are offline
  // Group cells owned by offline players
  const ownedByOffline = {};
  grid.forEach(cell => {
    if (cell.ownerId && !activePlayers.has(cell.ownerId)) {
      ownedByOffline[cell.ownerId] = {
        name: cell.ownerName || 'Offline Player',
        color: cell.color || '#cccccc',
        score: (ownedByOffline[cell.ownerId]?.score || 0) + 1,
      };
    }
  });

  Object.entries(ownedByOffline).forEach(([id, info]) => {
    leaderboard.push({
      id,
      name: info.name + ' (Offline)',
      color: info.color,
      score: info.score,
      isOffline: true,
    });
  });

  // Sort descending
  return leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
}

// Helper to broadcast state changes
function broadcastLeaderboard() {
  io.emit('leaderboard_update', getLeaderboard());
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send initial load to the connecting client
  socket.emit('init', {
    grid,
    players: Array.from(activePlayers.values()),
    settings: {
      gridSize: GRID_SIZE,
      cooldownMs: COOLDOWN_MS,
      lockMs: SHIELD_MS,
    },
    leaderboard: getLeaderboard(),
  });

  // Player joins with credentials (name, color)
  socket.on('join', ({ name, color }) => {
    const playerInfo = {
      id: socket.id,
      name: name || `Guest_${socket.id.slice(0, 4)}`,
      color: color || '#ff5555',
      lastActionTime: 0,
      cursor: null,
    };
    
    activePlayers.set(socket.id, playerInfo);
    console.log(`Player registered: ${playerInfo.name} (${socket.id})`);

    // Broadcast connection to other players
    socket.broadcast.emit('player_joined', playerInfo);
    
    // Broadcast updated player list and leaderboard
    io.emit('players_list', Array.from(activePlayers.values()));
    broadcastLeaderboard();
  });

  // Client updates profile (name, color)
  socket.on('update_profile', ({ name, color }) => {
    const player = activePlayers.get(socket.id);
    if (!player) return;

    const oldColor = player.color;
    player.name = name || player.name;
    player.color = color || player.color;

    activePlayers.set(socket.id, player);

    // Update cells owned by this player to match new style
    let updatedCount = 0;
    grid.forEach(cell => {
      if (cell.ownerId === socket.id) {
        cell.ownerName = player.name;
        cell.color = player.color;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      saveState();
      // Broadcast entire grid or let clients update local cell owner representations?
      // For efficiency, tell everyone this player's visual style changed
      io.emit('player_style_updated', {
        playerId: socket.id,
        name: player.name,
        color: player.color,
      });
    }

    io.emit('players_list', Array.from(activePlayers.values()));
    broadcastLeaderboard();
  });

  // Client cursor movement
  socket.on('cursor_move', (cursorData) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      player.cursor = cursorData; // { x, y } coordinates in grid relative coordinates
      // Broadcast cursor update to other players, throttled on client side
      socket.broadcast.emit('cursor_updated', {
        playerId: socket.id,
        cursor: cursorData,
      });
    }
  });

  // Heartbeat ping event
  socket.on('ping_heartbeat', (clientSentTime) => {
    socket.emit('ping_response', clientSentTime);
  });

  // Client attempts to claim a cell
  socket.on('claim_cell', ({ cellId }) => {
    const player = activePlayers.get(socket.id);
    if (!player) {
      socket.emit('claim_failed', { cellId, reason: 'unregistered', message: 'You must join before claiming cells!' });
      return;
    }

    const now = Date.now();

    // 1. Cooldown Check
    const timeSinceLastAction = now - player.lastActionTime;
    if (timeSinceLastAction < COOLDOWN_MS) {
      const remainingCooldown = Math.max(0, COOLDOWN_MS - timeSinceLastAction);
      socket.emit('claim_failed', {
        cellId,
        reason: 'cooldown',
        message: 'Claim request throttled. Slow down!',
        remainingMs: remainingCooldown,
      });
      return;
    }

    // 2. Cell Bounds Check
    if (cellId < 0 || cellId >= TOTAL_CELLS) {
      socket.emit('claim_failed', { cellId, reason: 'out_of_bounds', message: 'Invalid cell ID' });
      return;
    }

    const cell = grid[cellId];

    // 3. Cell Locked Check
    if (cell.lockedUntil > now) {
      const remainingLock = cell.lockedUntil - now;
      socket.emit('claim_failed', {
        cellId,
        reason: 'locked',
        message: 'This cell is currently shielded!',
        remainingMs: remainingLock,
      });
      return;
    }

    // 4. Successful Claim
    // Update player cooldown
    player.lastActionTime = now;

    // Update cell details
    const previousOwnerId = cell.ownerId;
    const previousOwnerName = cell.ownerName;
    
    cell.ownerId = socket.id;
    cell.ownerName = player.name;
    cell.color = player.color;
    cell.lockedUntil = now + SHIELD_MS;

    // Persist Grid State
    saveState();

    // Broadcast Update
    const updatePayload = {
      cellId,
      ownerId: socket.id,
      ownerName: player.name,
      color: player.color,
      lockedUntil: cell.lockedUntil,
    };
    
    io.emit('cell_updated', updatePayload);
    
    // Broadcast text announcement to log
    io.emit('activity_log', {
      timestamp: now,
      playerId: socket.id,
      playerName: player.name,
      playerColor: player.color,
      cellId,
      action: previousOwnerId 
        ? `captured cell #${cellId} from ${previousOwnerName}`
        : `claimed unclaimed cell #${cellId}`,
      isSteal: !!previousOwnerId && previousOwnerId !== socket.id
    });

    broadcastLeaderboard();
    
    // Acknowledge back to sender with success status
    socket.emit('claim_success', {
      cellId,
      lockedUntil: cell.lockedUntil,
      nextAllowedTime: now + COOLDOWN_MS,
    });
  });

  // Client disconnects
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const player = activePlayers.get(socket.id);
    
    if (player) {
      activePlayers.delete(socket.id);
      
      // Notify other players
      socket.broadcast.emit('player_left', socket.id);
      io.emit('players_list', Array.from(activePlayers.values()));
      
      // Update leaderboard (scores are calculated dynamically, we re-broadcast to show offline indicator)
      broadcastLeaderboard();
    }
  });
});

// Serve static frontend files in production
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Pixel Conquest Real-time Server running on port ${PORT}`);
});
