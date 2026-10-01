export const AUDIO_DEFAULTS = Object.freeze({sfxEnabled:true,musicEnabled:true,sfxVolume:0.65,musicVolume:0.15});
export const AUDIO_SETTINGS_KEY='durak.audio.v1';
// Long source recordings are played as short, faded cues, not in full.
export const SOUNDS=Object.freeze({
  cardPlay:{file:'sfx/card-play.mp3',duration:0.25},
  cardDefend:{file:'sfx/card-defend.mp3',duration:0.35},
  cardDraw:{file:'sfx/card-draw.mp3',duration:0.22},
  cardsPickup:{file:'sfx/cards-pickup.mp3',duration:0.65},
  discard:{file:'sfx/discard.mp3',duration:0.45},
  shuffle:{file:'sfx/shuffle.mp3',duration:1.3},
  win:{file:'sfx/win.mp3',duration:3},
  lose:{file:'sfx/lose.mp3',duration:3},
});
export function sanitizeSettings(value={}) {
  return Object.fromEntries(Object.entries(AUDIO_DEFAULTS).map(([key,fallback])=>[key,
    typeof fallback==='boolean' ? (typeof value?.[key]==='boolean'?value[key]:fallback)
    : (Number.isFinite(value?.[key])?Math.max(0,Math.min(1,value[key])):fallback)]));
}
