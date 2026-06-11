// Audio utility using Web Audio API to synthesize sound effects without asset dependencies.
let audioCtx = null;
let isMuted = localStorage.getItem('pc_muted') === 'true';

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setMuteState(muted) {
  isMuted = muted;
  localStorage.setItem('pc_muted', muted ? 'true' : 'false');
}

export function getMuteState() {
  return isMuted;
}

export function playClaimSound() {
  if (isMuted) return;
  try {
    const ctx = initAudio();
    const now = ctx.currentTime;
    
    // Create oscillator and gain node
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Frequency sweep: start low, glide high
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    
    // Envelope
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

export function playLockSound() {
  if (isMuted) return;
  try {
    const ctx = initAudio();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.setValueAtTime(0.12, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

export function playErrorSound() {
  if (isMuted) return;
  try {
    const ctx = initAudio();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.25);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

export function playJoinSound() {
  if (isMuted) return;
  try {
    const ctx = initAudio();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.08); // C#
    osc.frequency.setValueAtTime(659.25, now + 0.16); // E
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.setValueAtTime(0.12, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}
