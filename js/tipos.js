// Tabla de tipos (generación 6 en adelante, la que usa PokéAPI hoy).
// Clave = tipo DEFENSOR. Se usa para calcular debilidades aunque el back no las mande.

export const NOMBRE_TIPO = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

const DEFENSA = {
  normal:   { x2: ['fighting'], x05: [], x0: ['ghost'] },
  fire:     { x2: ['water', 'ground', 'rock'], x05: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], x0: [] },
  water:    { x2: ['electric', 'grass'], x05: ['fire', 'water', 'ice', 'steel'], x0: [] },
  electric: { x2: ['ground'], x05: ['electric', 'flying', 'steel'], x0: [] },
  grass:    { x2: ['fire', 'ice', 'poison', 'flying', 'bug'], x05: ['water', 'electric', 'grass', 'ground'], x0: [] },
  ice:      { x2: ['fire', 'fighting', 'rock', 'steel'], x05: ['ice'], x0: [] },
  fighting: { x2: ['flying', 'psychic', 'fairy'], x05: ['bug', 'rock', 'dark'], x0: [] },
  poison:   { x2: ['ground', 'psychic'], x05: ['grass', 'fighting', 'poison', 'bug', 'fairy'], x0: [] },
  ground:   { x2: ['water', 'grass', 'ice'], x05: ['poison', 'rock'], x0: ['electric'] },
  flying:   { x2: ['electric', 'ice', 'rock'], x05: ['grass', 'fighting', 'bug'], x0: ['ground'] },
  psychic:  { x2: ['bug', 'ghost', 'dark'], x05: ['fighting', 'psychic'], x0: [] },
  bug:      { x2: ['fire', 'flying', 'rock'], x05: ['grass', 'fighting', 'ground'], x0: [] },
  rock:     { x2: ['water', 'grass', 'fighting', 'ground', 'steel'], x05: ['normal', 'fire', 'poison', 'flying'], x0: [] },
  ghost:    { x2: ['ghost', 'dark'], x05: ['poison', 'bug'], x0: ['normal', 'fighting'] },
  dragon:   { x2: ['ice', 'dragon', 'fairy'], x05: ['fire', 'water', 'electric', 'grass'], x0: [] },
  dark:     { x2: ['fighting', 'bug', 'fairy'], x05: ['ghost', 'dark'], x0: ['psychic'] },
  steel:    { x2: ['fire', 'fighting', 'ground'], x05: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], x0: ['poison'] },
  fairy:    { x2: ['poison', 'steel'], x05: ['fighting', 'bug', 'dark'], x0: ['dragon'] },
};

/** Acepta 'fire', 'Fuego', 'FUEGO', 'eléctrico'… y devuelve la clave en inglés. */
const sinTilde = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const INVERSO = Object.fromEntries(
  Object.entries(NOMBRE_TIPO).flatMap(([k, v]) => [[sinTilde(k), k], [sinTilde(v), k]])
);
export const claveTipo = (t) => INVERSO[sinTilde(String(t))] ?? sinTilde(String(t));

/** Devuelve { debilidades:[{tipo,mult}], resistencias:[{tipo,mult}] } para 1 o 2 tipos. */
export function calcularEfectividad(tipos) {
  const mult = Object.fromEntries(Object.keys(NOMBRE_TIPO).map((t) => [t, 1]));
  for (const t of tipos.map(claveTipo)) {
    const d = DEFENSA[t];
    if (!d) continue;
    d.x2.forEach((a) => (mult[a] *= 2));
    d.x05.forEach((a) => (mult[a] *= 0.5));
    d.x0.forEach((a) => (mult[a] *= 0));
  }
  const lista = Object.entries(mult).map(([tipo, m]) => ({ tipo, mult: m }));
  return {
    debilidades: lista.filter((x) => x.mult > 1).sort((a, b) => b.mult - a.mult),
    resistencias: lista.filter((x) => x.mult < 1).sort((a, b) => a.mult - b.mult),
  };
}
