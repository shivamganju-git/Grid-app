const ADJECTIVES = [
  'Neon', 'Cosmic', 'Quantum', 'Cyber', 'Solar', 'Lunar', 'Glitch', 'Crypto', 
  'Alpha', 'Omega', 'Vortex', 'Hyper', 'Shadow', 'Prizm', 'Vector', 'Pixel', 
  'Techno', 'Aero', 'Friction', 'Static', 'Sonic', 'Astro', 'Retro', 'Binary'
];

const NOUNS = [
  'Knight', 'Ranger', 'Hacker', 'Shaman', 'Glitch', 'Spark', 'Pulse', 'Shield', 
  'Grid', 'Pixel', 'Saber', 'Nova', 'Matrix', 'Warden', 'Tracker', 'Phantom', 
  'Breaker', 'Rider', 'Runner', 'Glow', 'Blip', 'Echo', 'Drifter', 'Helix'
];

// Curated selection of highly vibrant/neon hex colors for dark mode styling
const COLOR_PALETTE = [
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

export function generateRandomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100-999
  return `${adj}${noun}_${num}`;
}

export function generateRandomColor() {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

export function getPlayerIdentity() {
  let name = localStorage.getItem('pc_player_name');
  let color = localStorage.getItem('pc_player_color');
  
  if (!name) {
    name = generateRandomName();
    localStorage.setItem('pc_player_name', name);
  }
  
  if (!color) {
    color = generateRandomColor();
    localStorage.setItem('pc_player_color', color);
  }
  
  return { name, color };
}

export function savePlayerIdentity(name, color) {
  localStorage.setItem('pc_player_name', name);
  localStorage.setItem('pc_player_color', color);
}
