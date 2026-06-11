import React, { useState, useEffect, useRef } from 'react';

const GRID_SIZE = 32;
const CELL_SIZE = 40; // in pixels (matches CSS --cell-size)
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;

export default function Grid({
  grid,
  players,
  currentPlayerId,
  cooldownActive,
  onClaimCell,
  onCursorMove
}) {
  const containerRef = useRef(null);
  const gridRef = useRef(null);

  // Viewport zoom and pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMoved, setDragMoved] = useState(false);

  // Particles for capture explosion
  const [particles, setParticles] = useState([]);

  // Force tick for real-time shield countdown animations
  const [, setTick] = useState(0);

  useEffect(() => {
    // Tick every 100ms to update lock timer animations/percentages smoothly
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Center the grid in the viewport on mount
  useEffect(() => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const initialX = (containerRect.width - CANVAS_SIZE) / 2;
      const initialY = (containerRect.height - CANVAS_SIZE) / 2;
      setPosition({ x: initialX, y: initialY });
    }
  }, []);

  // Trigger particle burst on capture
  const spawnParticles = (x, y, color) => {
    const newParticles = [];
    const count = 12;
    const centerX = x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = y * CELL_SIZE + CELL_SIZE / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 20 + Math.random() * 40;
      newParticles.push({
        id: Math.random(),
        x: centerX,
        y: centerY,
        color,
        tx: `${Math.cos(angle) * distance}px`,
        ty: `${Math.sin(angle) * distance}px`
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);

    // Cleanup particles after animation completes
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.includes(p)));
    }, 600);
  };

  const [pulsingCells, setPulsingCells] = useState(new Set());

  // Listen for grid update events to show bursts and pulses
  useEffect(() => {
    const handleCaptureBurst = (e) => {
      const { x, y, color, cellId } = e.detail;
      spawnParticles(x, y, color);
      
      if (cellId !== undefined) {
        setPulsingCells((prev) => {
          const next = new Set(prev);
          next.add(cellId);
          return next;
        });
        
        setTimeout(() => {
          setPulsingCells((prev) => {
            const next = new Set(prev);
            next.delete(cellId);
            return next;
          });
        }, 500);
      }
    };
    window.addEventListener('cell-capture-burst', handleCaptureBurst);
    return () => window.removeEventListener('cell-capture-burst', handleCaptureBurst);
  }, []);

  // Pan (Drag) Handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return; // Only left/middle click
    setIsDragging(true);
    setDragMoved(false);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    // 1. Update dragging position
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Check if mouse actually moved enough to count as dragging
      if (Math.abs(newX - position.x) > 3 || Math.abs(newY - position.y) > 3) {
        setDragMoved(true);
      }
      setPosition({ x: newX, y: newY });
    }

    // 2. Track cursor position and notify parent (throttled)
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      // Calculate local coordinates inside the grid canvas space
      const localX = (e.clientX - rect.left) / scale;
      const localY = (e.clientY - rect.top) / scale;
      
      // Only emit if cursor is within grid bounds
      if (localX >= 0 && localX <= CANVAS_SIZE && localY >= 0 && localY <= CANVAS_SIZE) {
        onCursorMove({ x: localX, y: localY });
      } else {
        onCursorMove(null); // cursor went off grid
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    onCursorMove(null);
  };

  // Zoom-on-mouse Handler
  const handleWheel = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom multiplier
    const zoomFactor = 0.08;
    const direction = e.deltaY < 0 ? 1 : -1;
    const nextScale = Math.min(Math.max(scale + direction * zoomFactor, 0.4), 3.0);

    // Math to zoom into cursor position
    const dx = mouseX - position.x;
    const dy = mouseY - position.y;
    const nextX = mouseX - dx * (nextScale / scale);
    const nextY = mouseY - dy * (nextScale / scale);

    setScale(nextScale);
    setPosition({ x: nextX, y: nextY });
  };

  // Double click resets translation & scale
  const handleDoubleClick = () => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const initialX = (containerRect.width - CANVAS_SIZE) / 2;
      const initialY = (containerRect.height - CANVAS_SIZE) / 2;
      setScale(1);
      setPosition({ x: initialX, y: initialY });
    }
  };

  const handleCellClick = (cell, e) => {
    e.stopPropagation();
    if (dragMoved) return; // Prevent clicks while panning
    onClaimCell(cell.id);
  };

  // Zoom buttons helper
  const adjustZoom = (zoomIn) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextScale = Math.min(Math.max(scale + (zoomIn ? 0.3 : -0.3), 0.4), 3.0);

    const dx = centerX - position.x;
    const dy = centerY - position.y;
    const nextX = centerX - dx * (nextScale / scale);
    const nextY = centerY - dy * (nextScale / scale);

    setScale(nextScale);
    setPosition({ x: nextX, y: nextY });
  };

  const now = Date.now();

  return (
    <div
      ref={containerRef}
      className="viewport-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      {/* Zoom and translate wrapper */}
      <div
        ref={gridRef}
        className="zoom-content"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE
        }}
      >
        <div className={`grid-container ${cooldownActive ? 'cooldown-active' : ''}`}>
          {grid.map((cell) => {
            const isClaimed = !!cell.ownerId;
            const isShielded = cell.lockedUntil > now;
            
            // Calculate shield percentage
            let dashOffset = 0;
            let remainingSec = 0;
            if (isShielded) {
              const totalLockTime = 10000; // 10s
              const elapsed = totalLockTime - (cell.lockedUntil - now);
              const pct = Math.max(0, Math.min(1, elapsed / totalLockTime));
              dashOffset = 63 * pct; // 63 is the total stroke-dasharray (circumference)
              remainingSec = Math.ceil((cell.lockedUntil - now) / 1000);
            }

            return (
              <div
                key={cell.id}
                className={`grid-cell ${isClaimed ? 'claimed' : ''} ${pulsingCells.has(cell.id) ? 'pulse' : ''}`}
                style={{
                  backgroundColor: cell.color || 'transparent',
                }}
                onClick={(e) => handleCellClick(cell, e)}
              >
                {/* Shield animation lock overlay */}
                {isShielded && (
                  <div className="shield-overlay">
                    <svg className="shield-timer-svg" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" className="shield-timer-circle" style={{ strokeDashoffset: dashOffset }} />
                    </svg>
                    <svg
                      className="shield-icon"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      style={{ fontSize: '10px' }}
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                  </div>
                )}

                {/* Grid Hover tooltip */}
                <div className="cell-tooltip">
                  <div>Cell: ({cell.x}, {cell.y})</div>
                  {isClaimed ? (
                    <>
                      <div style={{ fontWeight: 'bold', color: cell.color }}>Owner: {cell.ownerName}</div>
                      {isShielded && <div style={{ color: 'var(--accent-gold)' }}>Shielded: {remainingSec}s</div>}
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>Unclaimed - Click to claim</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time other players' cursors layer */}
        <div className="cursors-layer">
          {players
            .filter((p) => p.id !== currentPlayerId && p.cursor)
            .map((player) => (
              <div
                key={player.id}
                className="player-cursor"
                style={{
                  left: player.cursor.x,
                  top: player.cursor.y,
                  color: player.color
                }}
              >
                <div className="cursor-pointer-dot" />
                <span className="cursor-label" style={{ borderColor: player.color }}>
                  {player.name}
                </span>
              </div>
            ))}
        </div>

        {/* Particle explosion elements */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.x,
              top: p.y,
              backgroundColor: p.color,
              boxShadow: `0 0 6px ${p.color}`,
              '--tx': p.tx,
              '--ty': p.ty
            }}
          />
        ))}
      </div>

      {/* Floating Zoom Controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={() => adjustZoom(true)} title="Zoom In">+</button>
        <button className="zoom-btn" onClick={() => adjustZoom(false)} title="Zoom Out">-</button>
        <button className="zoom-btn" onClick={handleDoubleClick} title="Reset viewport perspective" style={{ fontSize: '13px' }}>🎯</button>
      </div>
    </div>
  );
}
