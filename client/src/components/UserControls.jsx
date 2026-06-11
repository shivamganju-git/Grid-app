import React, { useState } from 'react';
import { generateRandomName, generateRandomColor } from '../utils/nameGenerator';

const PRESETS = [
  '#ff0055', // Neon Red
  '#00ff66', // Neon Green
  '#00ffff', // Cyan
  '#ff00ff', // Magenta
  '#ffff00', // Yellow
  '#ff6600', // Orange
  '#9900ff', // Violet
  '#3388ff', // Electric Blue
  '#ff00aa', // Hot Pink
  '#00ffcc', // Mint Cyan
  '#ccff00', // Lime
  '#ff9900'  // Gold
];

export default function UserControls({
  player,
  onUpdateIdentity,
  stats,
  ping,
  isMuted,
  onToggleMute
}) {
  const [name, setName] = useState(player?.name || '');
  const [color, setColor] = useState(player?.color || '#ff0055');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpdateIdentity({ name: name.trim(), color });
  };

  const handleRandomize = () => {
    const newName = generateRandomName();
    const newColor = generateRandomColor();
    setName(newName);
    setColor(newColor);
    onUpdateIdentity({ name: newName, color: newColor });
  };

  return (
    <div className="hud-left">
      {/* Profile Panel */}
      <div className="glass-panel profile-panel">
        <h3 className="panel-title">Your Identity</h3>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <span className="input-label">Player Name</span>
            <input
              type="text"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter username"
              maxLength={16}
            />
          </div>

          <div className="input-group" style={{ marginBottom: '8px' }}>
            <span className="input-label">Select Color</span>
            <div className="color-picker-grid">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-option ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c, color: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              className="icon-btn active"
              style={{ flex: 2, padding: '10px' }}
            >
              Save Profile
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={handleRandomize}
              style={{ padding: '10px' }}
              title="Generate random username & color"
            >
              🎲 Random
            </button>
          </div>
        </form>

        <div className="options-bar">
          <button
            type="button"
            className={`icon-btn ${isMuted ? 'active' : ''}`}
            onClick={onToggleMute}
          >
            {isMuted ? '🔇 Muted' : '🔊 Audio'}
          </button>
          <div className="icon-btn" style={{ cursor: 'default' }}>
            ⚡️ {ping !== null ? `${ping}ms` : '--'}
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="glass-panel stats-panel">
        <h3 className="panel-title">Session Stats</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.activeCount}</div>
            <div className="stat-label">Active Cells</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalCaptured}</div>
            <div className="stat-label">Total Claims</div>
          </div>
        </div>

        <div className="instructions-panel">
          <strong>How to Play:</strong>
          <ul>
            <li>Drag canvas to pan, scroll to zoom.</li>
            <li>Double-click grid to reset view.</li>
            <li>Click unclaimed or unshielded tiles to claim them.</li>
            <li>Claims lock tiles for 10s (shield).</li>
            <li>Claiming incurs a 3s cooldown.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
