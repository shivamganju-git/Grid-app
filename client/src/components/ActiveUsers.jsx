import React from 'react';

export default function ActiveUsers({ players, currentPlayerId }) {
  return (
    <div className="glass-panel players-online-panel">
      <h3 className="panel-title">
        <span>Players Online</span>
        <span className="brand-badge" style={{ fontSize: '9px' }}>
          {players.length} active
        </span>
      </h3>
      <div className="players-grid">
        {players.map((p) => {
          const isSelf = p.id === currentPlayerId;
          return (
            <div
              key={p.id}
              className={`player-chip ${isSelf ? 'self' : ''}`}
            >
              <span
                className="chip-dot"
                style={{ backgroundColor: p.color, color: p.color }}
              />
              <span>{p.name} {isSelf ? '(You)' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
