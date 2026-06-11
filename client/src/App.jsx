import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Grid from './components/Grid';
import UserControls from './components/UserControls';
import Leaderboard from './components/Leaderboard';
import ActiveUsers from './components/ActiveUsers';
import ActivityLog from './components/ActivityLog';
import { getPlayerIdentity, savePlayerIdentity } from './utils/nameGenerator';
import {
  playClaimSound,
  playErrorSound,
  playLockSound,
  playJoinSound,
  getMuteState,
  setMuteState
} from './utils/audio';

// Fallback logic for production / local host ports
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:5050' : window.location.origin);

export default function App() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [grid, setGrid] = useState([]);
  const [players, setPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [logs, setLogs] = useState([]);
  const [ping, setPing] = useState(null);
  const [isMuted, setIsMuted] = useState(getMuteState());

  // Local identity state
  const [identity, setIdentity] = useState({ name: '', color: '' });
  
  // Cooldown states
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Throttling for cursor movement updates
  const lastCursorSentRef = useRef(0);

  // Initialize profile on mount
  useEffect(() => {
    const localIdentity = getPlayerIdentity();
    setIdentity(localIdentity);
  }, []);

  // Sync client-side cooldown display
  useEffect(() => {
    if (cooldownEnd === 0) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, cooldownEnd - Date.now());
      setCooldownRemaining(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setCooldownEnd(0);
        setCooldownRemaining(0);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [cooldownEnd]);

  // Connect to backend WebSocket server
  useEffect(() => {
    if (!identity.name) return; // Wait until identity is loaded

    console.log(`Connecting to real-time server at: ${BACKEND_URL}`);
    const socket = io(BACKEND_URL, {
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('Successfully connected to server, socket ID:', socket.id);
      // Join game room with current profile
      socket.emit('join', identity);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setPing(null);
      console.log('Disconnected from server');
    });

    // Real-time synchronization events
    socket.on('init', ({ grid: initialGrid, players: activePlayers, leaderboard: initialLeaderboard }) => {
      setGrid(initialGrid);
      setPlayers(activePlayers);
      setLeaderboard(initialLeaderboard);
    });

    socket.on('players_list', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('leaderboard_update', (updatedLeaderboard) => {
      setLeaderboard(updatedLeaderboard);
    });

    socket.on('player_joined', (newPlayer) => {
      playJoinSound();
      setLogs((prev) => [
        ...prev.slice(-49),
        {
          timestamp: Date.now(),
          playerName: newPlayer.name,
          playerColor: newPlayer.color,
          action: 'entered the battlefield',
          isSystem: true
        }
      ]);
    });

    socket.on('player_left', (playerId) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    });

    socket.on('player_style_updated', ({ playerId, name, color }) => {
      // Update cell owner details for currently active display elements
      setGrid((prevGrid) =>
        prevGrid.map((cell) => {
          if (cell.ownerId === playerId) {
            return { ...cell, ownerName: name, color };
          }
          return cell;
        })
      );
    });

    socket.on('cell_updated', (updatedCell) => {
      setGrid((prevGrid) =>
        prevGrid.map((cell) => (cell.id === updatedCell.cellId ? { ...cell, ...updatedCell } : cell))
      );

      // Trigger particle burst on grid canvas by dispatching custom event
      window.dispatchEvent(
        new CustomEvent('cell-capture-burst', {
          detail: {
            x: updatedCell.cellId % 32,
            y: Math.floor(updatedCell.cellId / 32),
            color: updatedCell.color,
            cellId: updatedCell.cellId
          }
        })
      );
    });

    socket.on('activity_log', (logEntry) => {
      setLogs((prev) => [...prev.slice(-49), logEntry]);
    });

    socket.on('cursor_updated', ({ playerId, cursor }) => {
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) => (p.id === playerId ? { ...p, cursor } : p))
      );
    });

    socket.on('claim_success', ({ cellId, nextAllowedTime }) => {
      playClaimSound();
      setCooldownEnd(nextAllowedTime);
    });

    socket.on('claim_failed', ({ reason, message, remainingMs }) => {
      console.warn(`Claim failed: ${reason} - ${message}`);
      if (reason === 'cooldown') {
        playErrorSound();
        if (remainingMs) {
          setCooldownEnd(Date.now() + remainingMs);
        }
      } else if (reason === 'locked') {
        playLockSound();
      } else {
        playErrorSound();
      }
    });

    // Latency testing loop
    const pingInterval = setInterval(() => {
      const start = Date.now();
      socket.emit('ping_server', () => {
        // Since we didn't define handler on backend, we can just acknowledge with simple callback
      });
      // Standard socket.io ping measurement using packet delay
      // To keep it simple, we listen to pong event if supported, or calculate with custom roundtrip
      socket.volatile.emit('ping_heartbeat', start);
    }, 4000);

    socket.on('ping_response', (clientSentTime) => {
      setPing(Date.now() - clientSentTime);
    });

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, [identity.name]);

  // Handle cell capture action
  const handleClaimCell = (cellId) => {
    if (!connected || !socketRef.current) return;
    
    // Check client-side cooldown prediction
    if (Date.now() < cooldownEnd) {
      playErrorSound();
      return;
    }

    socketRef.current.emit('claim_cell', { cellId });
  };

  // Profile Identity Changes
  const handleUpdateIdentity = (newIdentity) => {
    setIdentity(newIdentity);
    savePlayerIdentity(newIdentity.name, newIdentity.color);
    if (socketRef.current && connected) {
      socketRef.current.emit('update_profile', newIdentity);
    }
  };

  // Track and synchronize local player cursor movement (throttled)
  const handleCursorMove = (cursorData) => {
    if (!socketRef.current || !connected) return;

    const now = Date.now();
    // Throttle cursor updates to 60ms (roughly 16 packets/sec) to optimize bandwidth
    if (now - lastCursorSentRef.current > 60) {
      socketRef.current.emit('cursor_move', cursorData);
      lastCursorSentRef.current = now;
    }
  };

  // Toggle Audio Mute
  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    setMuteState(nextMute);
  };

  // Count owned cells for session stats
  const activeCount = grid.filter((c) => c.ownerId === socketRef.current?.id).length;
  const totalCaptured = logs.filter((l) => l.playerId === socketRef.current?.id && !l.isSystem).length;

  return (
    <div className="app-container">
      {/* Dynamic Star background and grid visualizer */}
      <div className="space-background" />

      {/* Main Interactive Zoomable Panning viewport grid */}
      <Grid
        grid={grid}
        players={players}
        currentPlayerId={socketRef.current?.id}
        cooldownActive={Date.now() < cooldownEnd}
        onClaimCell={handleClaimCell}
        onCursorMove={handleCursorMove}
      />

      {/* Immersive HUD Overlay layer */}
      <div className="hud-layer">
        {/* Top Header */}
        <header className="hud-header glass-panel">
          <div className="brand-section">
            <h1 className="brand-logo">Pixel Conquest</h1>
            <span className="brand-badge">BETA v1.0</span>
          </div>

          <div className="status-bar">
            <div className="status-item">
              <span className={`status-dot ${connected ? 'online' : 'connecting'}`} />
              <span>{connected ? 'ONLINE' : 'CONNECTING'}</span>
            </div>
          </div>
        </header>

        {/* Left Side: Profile Setup, Option controls & Session Stats */}
        <UserControls
          player={identity}
          onUpdateIdentity={handleUpdateIdentity}
          stats={{ activeCount, totalCaptured }}
          ping={ping}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />

        {/* Right Side: High Scores Leaderboard & Online Player List */}
        <div className="hud-right">
          <Leaderboard leaderboard={leaderboard} currentPlayerId={socketRef.current?.id} />
          <ActiveUsers players={players} currentPlayerId={socketRef.current?.id} />
        </div>

        {/* Bottom Panel: Activity Log */}
        <ActivityLog logs={logs} />
      </div>

      {/* HUD Player Cooldown warning */}
      {cooldownRemaining > 0 && (
        <div className="cooldown-overlay-hud">
          <div className="cooldown-spinner" />
          <span>COOLDOWN: {cooldownRemaining}s</span>
        </div>
      )}
    </div>
  );
}
