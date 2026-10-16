export const EFFECTS = {
  lava: { label: 'The floor is lava', icon: 'Flame', color: '#ff755c', duration: 18000, kind: 'floor', side: 'chaos' },
  ice: { label: 'Ice, ice, baby', icon: 'Snowflake', color: '#9ce6ff', duration: 18000, kind: 'floor', side: 'chaos' },
  moon: { label: 'Moon gravity', icon: 'Moon', color: '#c6b9ff', duration: 20000, kind: 'gravity', side: 'chaos' },
  heavy: { label: 'Heavy gravity', icon: 'ArrowDownToLine', color: '#fca6d5', duration: 15000, kind: 'gravity', side: 'chaos' },
  boulders: { label: 'Bouncy boulders', icon: 'CircleDot', color: '#f5cf89', duration: 0, kind: 'spawn', side: 'chaos' },
  ducks: { label: 'Release the ducks', icon: 'Bird', color: '#f5df73', duration: 0, kind: 'spawn', side: 'chaos' },
  meteors: { label: 'Meteor shower', icon: 'Orbit', color: '#ffac7b', duration: 16000, kind: 'weather', side: 'chaos' },
  blackhole: { label: 'Black hole', icon: 'Eclipse', color: '#c2a2ff', duration: 14000, kind: 'force', side: 'chaos' },
  wind: { label: 'Plot twist: wind', icon: 'Wind', color: '#b8e6e2', duration: 15000, kind: 'force', side: 'chaos' },
  disco: { label: 'Disco universe', icon: 'Sparkles', color: '#fba8db', duration: 22000, kind: 'vibe', side: 'chaos' },
  giant: { label: 'Supersize the hero', icon: 'Maximize', color: '#e7bcff', duration: 18000, kind: 'size', side: 'chaos' },
  tiny: { label: 'Tiny astronaut', icon: 'Minimize', color: '#bce5c9', duration: 18000, kind: 'size', side: 'chaos' },
  shield: { label: 'Bubble shield', icon: 'Shield', color: '#a0e5ff', duration: 20000, kind: 'shield', side: 'help' },
  trampoline: { label: 'Trampoline world', icon: 'ArrowUpFromLine', color: '#afe5ba', duration: 18000, kind: 'bounce', side: 'help' },
  bridge: { label: 'Build a bridge', icon: 'MoveHorizontal', color: '#d6df9f', duration: 20000, kind: 'bridge', side: 'help' },
  confetti: { label: 'Confetti cannon', icon: 'PartyPopper', color: '#f9d976', duration: 0, kind: 'spawn', side: 'help' },
  heal: { label: 'Save our astronaut', icon: 'Heart', color: '#ffadc3', duration: 0, kind: 'instant', side: 'help' },
  slow: { label: 'Slow motion', icon: 'Timer', color: '#a9cfff', duration: 14000, kind: 'time', side: 'help' },
  timeplus: { label: 'Buy Nova 15 seconds', icon: 'Timer', color: '#bce8ba', duration: 0, kind: 'clock', side: 'help' },
  timeminus: { label: 'Steal 10 seconds', icon: 'Timer', color: '#ffb4ac', duration: 0, kind: 'clock', side: 'chaos' },
  duckzilla: { label: 'DUCKZILLA', icon: 'Bird', color: '#ffe27a', duration: 0, kind: 'spawn', side: 'chaos' },
  reverse: { label: 'Uno reverse controls', icon: 'MoveHorizontal', color: '#d5b5fb', duration: 12000, kind: 'controls', side: 'chaos' },
  earthquake: { label: 'Earthquake, respectfully', icon: 'Zap', color: '#ffbe92', duration: 9000, kind: 'quake', side: 'chaos' },
};
export const QUICK_CHAOS = ['duckzilla', 'lava', 'moon', 'boulders', 'meteors', 'disco'];
export const QUICK_HELP = ['shield', 'trampoline', 'bridge', 'heal', 'slow', 'confetti'];
export const QUICK_WILD = ['ducks', 'reverse', 'earthquake', 'blackhole', 'giant', 'tiny', 'wind', 'ice', 'heavy'];
export const MAX_HISTORY = 32;
export const MAX_EFFECTS_PER_COMMAND = 4;
export const ROUND_MS = 180000;
export const cleanText = (value, max = 160) => typeof value === 'string' ? value.replace(/[<>\x00-\x1f]/g, '').trim().slice(0, max) : '';
