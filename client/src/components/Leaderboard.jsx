import React from 'react';

export default function Leaderboard({ leaderboard, currentPlayerId }) {
  return (
    <div className="glass-panel leaderboard-panel">
      <h3 className="panel-title">Leaderboard</h3>
      <div className="leaderboard-list">
        {leaderboard.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No active claims yet
          </div>
        ) : (
          leaderboard.map((player, idx) => {
            const rank = idx + 1;
            const isSelf = player.id === currentPlayerId;
            
            let rankClass = '';
            if (rank === 1) rankClass = 'leader-rank-1';
            else if (rank === 2) rankClass = 'leader-rank-2';
            else if (rank === 3) rankClass = 'leader-rank-3';

            return (
              <div
                key={player.id}
                className={`leader-item ${isSelf ? 'self' : ''}`}
              >
                <div className={`leader-rank ${rankClass}`}>
                  {rank === 1 ? '👑' : rank}
                </div>
                
                <div className="leader-name-wrap">
                  <span
                    className="leader-player-badge"
                    style={{ backgroundColor: player.color, color: player.color }}
                  />
                  <span style={{ color: isSelf ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                    {player.name}
                  </span>
                </div>
                
                <div className="leader-score">
                  {player.score} {player.score === 1 ? 'cell' : 'cells'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
