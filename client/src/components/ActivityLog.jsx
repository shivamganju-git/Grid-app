import React, { useEffect, useRef } from 'react';

export default function ActivityLog({ logs }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="hud-bottom">
      <div className="glass-panel activity-panel">
        <h3 className="panel-title">Activity Stream</h3>
        <div ref={containerRef} className="activity-feed">
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Waiting for grid captures...
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`feed-item ${log.isSteal ? 'steal' : ''}`}
              >
                <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>
                  [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                </span>
                <span
                  className="player-name"
                  style={{ borderLeft: `3px solid ${log.playerColor}`, paddingLeft: '4px' }}
                >
                  {log.playerName}
                </span>{' '}
                <span>{log.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
