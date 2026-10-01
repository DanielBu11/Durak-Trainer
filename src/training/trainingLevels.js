// Extend this registry for future levels; capabilities are cumulative.
export const LEVELS = Object.freeze([
  {id: 1, title: 'Hohe Trümpfe', description: 'Verfolge J, Q, K und A auf dem Ablagestapel.', features: ['faces']},
  {id: 2, title: 'Alle Trümpfe', description: 'Merke dir 0–5 Zahlentrümpfe plus J, Q, K, A.', features: ['faces', 'numbers']},
  {id: 3, title: 'Aufgenommene Karten', description: 'Merke dir genau eine sichtbar aufgenommene Karte pro Gegner.', features: ['faces', 'numbers', 'memory']},
  {id: 4, title: 'Farb-Schwächen', description: 'Ergänze eigene Vermutungen über schwache Farben.', features: ['faces', 'numbers', 'memory', 'weakness']},
]);
export const levelDefinition = level => LEVELS.find(l => l.id === Number(level)) ?? LEVELS[0];
export const hasFeature = (level, feature) => levelDefinition(level).features.includes(feature);
