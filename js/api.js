// ===============================================================
//  CAPA DE DATOS
//  Toda la app consume UN solo formato ("Pokémon normalizado"),
//  venga del back del curso o de PokéAPI.
//
//  Pokémon normalizado:
//  {
//    id, nombre, categoria, tipos:['fire','flying'], altura (m), peso (kg),
//    stats:[{clave:'hp', valor}], habilidades:[{nombre, oculta}],
//    descripcion, idiomaDescripcion:'es'|'en',
//    sprites:{ normal, shiny, hd, hdShiny },
//    debilidades:[{tipo, mult}], resistencias:[{tipo, mult}],
//    evolucion:{ etapas:[{id,nombre,desde,metodo}], anterior, siguientes:[] },
//    variantes:[{ nombre, imagen, tipos }]
//  }
// ===============================================================
import { CONFIG } from './config.js';
import { calcularEfectividad, claveTipo, NOMBRE_TIPO } from './tipos.js';

const SPR = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
export const spriteDe = (id) => `${SPR}/${id}.png`;
const spritesDe = (id) => ({
  normal: `${SPR}/${id}.png`,
  shiny: `${SPR}/shiny/${id}.png`,
  hd: `${SPR}/other/official-artwork/${id}.png`,
  hdShiny: `${SPR}/other/official-artwork/shiny/${id}.png`,
});

// ---------------------------------------------------------------
//  HTTP con timeout + reintentos (cold start de Render)
// ---------------------------------------------------------------
export class ErrorApi extends Error {
  constructor(tipo, mensaje, status) { super(mensaje); this.tipo = tipo; this.status = status; }
}
// tipo: 'no_encontrado' (404) | 'servidor' (5xx/400) | 'red' (offline/timeout)

let avisarRed = () => {};
/** La app se suscribe para mostrar "despertando el servidor…". */
export const onEstadoRed = (fn) => { avisarRed = fn; };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(url, { reintentos = CONFIG.REINTENTOS, timeout = CONFIG.TIMEOUT_MS } = {}) {
  let ultimo;
  for (let intento = 0; intento <= reintentos; intento++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const lento = setTimeout(() => avisarRed('lento'), 3000); // si tarda, probablemente está despertando
    try {
      const r = await fetch(new URL(url, CONFIG.POKEAPI), { signal: ctrl.signal });
      if (r.status === 404) throw new ErrorApi('no_encontrado', 'Pokémon no encontrado', 404);
      if (r.status === 400) throw new ErrorApi('servidor', 'Petición inválida', 400);
      if (!r.ok) throw new ErrorApi('servidor', `Error del servidor (${r.status})`, r.status);
      const datos = await r.json();
      avisarRed('ok');
      return datos;
    } catch (e) {
      ultimo = e instanceof ErrorApi ? e : new ErrorApi('red', navigator.onLine ? 'El servidor no responde' : 'Sin conexión');
      if (ultimo.tipo === 'no_encontrado' || ultimo.status === 400) throw ultimo; // no tiene sentido reintentar
      if (intento < reintentos) { avisarRed('reintentando', intento + 1); await esperar(2000 * 2 ** intento); }
    } finally {
      clearTimeout(t); clearTimeout(lento);
    }
  }
  avisarRed('error');
  throw ultimo;
}

const urlBack = (ruta, params) => {
  const u = new URL(CONFIG.BACKEND_URL + ruta);
  Object.entries(params ?? {}).forEach(([k, v]) => v != null && v !== '' && u.searchParams.set(k, v));
  return u.toString();
};

/** Ping al /health para despertar el back apenas abre la app. */
export const despertar = () =>
  CONFIG.MODO === 'backend' ? http(urlBack(CONFIG.RUTA_HEALTH), { reintentos: 2, timeout: 60000 }).catch(() => {}) : Promise.resolve();

// ---------------------------------------------------------------
//  API pública
// ---------------------------------------------------------------
const cache = new Map();
function memo(clave, fn) {
  if (!cache.has(clave)) cache.set(clave, fn().catch((e) => { cache.delete(clave); throw e; }));
  return cache.get(clave);
}

export const obtenerPokemon = (id) =>
  memo(`p${id}`, () => (CONFIG.MODO === 'backend' ? desdeBackend(id) : desdePokeApi(id)));

/** Listado paginado con búsqueda y filtro por tipo → { data:[{id,nombre,tipos,sprite}], total } */
export async function listar({ limit = 30, offset = 0, search = '', type = '' } = {}) {
  if (CONFIG.MODO === 'backend') {
    const r = await http(urlBack(CONFIG.RUTA_LISTA, { limit, offset, search: search.toLowerCase(), type }));
    return { data: r.data.map(resumenBack), total: r.meta.total };
  }
  // Modo PokéAPI: se filtra en el cliente
  let todos = await todosPokeApi();
  if (search) todos = todos.filter((p) => p.nombre.toLowerCase().includes(search.toLowerCase()));
  if (type) {
    const t = await memo(`t${type}`, () => http(`${CONFIG.POKEAPI}/type/${type}`));
    const ids = new Set(t.pokemon.map((x) => idDeUrl(x.pokemon.url)));
    todos = todos.filter((p) => ids.has(p.id));
  }
  return { data: todos.slice(offset, offset + limit), total: todos.length };
}

/** Todos los nombres (para autocompletar el buscador). */
export async function obtenerNombres() {
  if (CONFIG.MODO === 'backend') {
    const paginas = await Promise.all([0, 100].map((offset) => http(urlBack(CONFIG.RUTA_LISTA, { limit: 100, offset }))));
    return paginas.flatMap((p) => p.data.map(resumenBack));
  }
  return todosPokeApi();
}

/** Tipos con conteo → [{ tipo:'fire', cantidad: 12 }] */
export async function obtenerTipos() {
  if (CONFIG.MODO === 'backend') {
    const r = await memo('tipos', () => http(urlBack(CONFIG.RUTA_TIPOS)));
    return r.data.map((t) => ({ tipo: t.name, cantidad: t.pokemonCount }));
  }
  return Object.keys(NOMBRE_TIPO).map((tipo) => ({ tipo, cantidad: null }));
}

// ---------------------------------------------------------------
//  BACK DEL CURSO
//  GET /api/pokemon/:id → { id, name, genus, flavorText, height(dm), weight(hg),
//    types[], abilities[{name,isHidden}], stats{hp,attack,...}, sprites{front,back,frontShiny,artworkOfficial},
//    evolvesFrom:{id,name}|null, evolvesTo:[{id,name}] }
// ---------------------------------------------------------------
const STAT_BACK = { hp: 'hp', attack: 'attack', defense: 'defense', specialAttack: 'special-attack', specialDefense: 'special-defense', speed: 'speed' };

const resumenBack = (p) => ({ id: p.id, nombre: nombreBonito(p.name), tipos: p.types ?? [], sprite: p.sprite ?? spriteDe(p.id) });

const detalleBack = (id) => memo(`b${id}`, () => http(urlBack(CONFIG.RUTA_POKEMON.replace('{id}', encodeURIComponent(id)))));

async function desdeBackend(id) {
  const p = await detalleBack(id);
  const tipos = p.types.map(claveTipo);
  const efect = calcularEfectividad(tipos);
  const base = spritesDe(p.id);

  const poke = {
    id: p.id,
    nombre: nombreBonito(p.name),
    categoria: p.genus ?? '',
    tipos,
    altura: p.height / 10,
    peso: p.weight / 10,
    stats: Object.entries(p.stats ?? {}).map(([k, v]) => ({ clave: STAT_BACK[k] ?? k, valor: v })),
    habilidades: (p.abilities ?? []).map((a) => ({ nombre: titulo(a.name), oculta: a.isHidden })),
    descripcion: p.flavorText ?? '',
    idiomaDescripcion: 'en',
    sprites: {
      normal: p.sprites?.front ?? base.normal,
      shiny: p.sprites?.frontShiny ?? base.shiny,
      hd: p.sprites?.artworkOfficial ?? base.hd,
      hdShiny: base.hdShiny,
    },
    debilidades: efect.debilidades,
    resistencias: efect.resistencias,
    evolucion: null,
    variantes: p.sprites?.frontShiny ? [{ nombre: 'Variocolor (shiny)', imagen: p.sprites.frontShiny, tipos: [] }] : [],
  };

  // Complemento opcional con PokéAPI (español, métodos de evolución, variantes)
  if (CONFIG.ENRIQUECER_CON_POKEAPI) {
    try {
      const extra = await extrasPokeApi(p.id);
      Object.assign(poke, {
        categoria: extra.categoria || poke.categoria,
        descripcion: extra.descripcion || poke.descripcion,
        idiomaDescripcion: extra.descripcion ? 'es' : 'en',
        evolucion: extra.evolucion,
        variantes: extra.variantes.length ? extra.variantes : poke.variantes,
      });
    } catch { /* PokéAPI no disponible → nos quedamos con el back */ }
  }
  poke.evolucion ??= await cadenaDesdeBack(p);
  return poke;
}

/** Arma la cadena completa usando solo evolvesFrom / evolvesTo del back. */
async function cadenaDesdeBack(p) {
  let raiz = p;
  while (raiz.evolvesFrom) raiz = await detalleBack(raiz.evolvesFrom.id);
  const etapas = [];
  const cola = [[raiz, null]];
  while (cola.length) {
    const [n, desde] = cola.shift();
    etapas.push({ id: n.id, nombre: nombreBonito(n.name), desde, metodo: '' });
    const hijos = await Promise.all(n.evolvesTo.map((h) => detalleBack(h.id)));
    hijos.forEach((h) => cola.push([h, n.id]));
  }
  return armarRelaciones(etapas, p.id);
}

// ---------------------------------------------------------------
//  POKÉAPI
// ---------------------------------------------------------------
const pa = (ruta) => {
  // Acepta '/pokemon/1', '/api/v2/…' (relativa) o URL completa
  const url = /^https?:|^\/api\//.test(ruta) ? ruta : CONFIG.POKEAPI + ruta;
  return memo(`pa${url}`, () => http(url, { reintentos: 1, timeout: 10000 }));
};
const todosPokeApi = () => memo('todos', async () => {
  const d = await pa(`/pokemon-species?limit=${CONFIG.TOTAL}`);
  return d.results.map((r) => ({ id: idDeUrl(r.url), nombre: nombreBonito(r.name), tipos: [], sprite: spriteDe(idDeUrl(r.url)) }));
});

async function extrasPokeApi(id) {
  const [poke, especie] = await Promise.all([pa(`/pokemon/${id}`), pa(`/pokemon-species/${id}`)]);
  const cadena = await pa(especie.evolution_chain.url);
  const es = (arr) => arr.filter((x) => x.language.name === CONFIG.IDIOMA);

  const etapas = [];
  (function recorrer(nodo, desde) {
    const idN = idDeUrl(nodo.species.url);
    etapas.push({ id: idN, nombre: nombreBonito(nodo.species.name), desde, metodo: describirMetodo(nodo.evolution_details) });
    nodo.evolves_to.forEach((h) => recorrer(h, idN));
  })(cadena.chain, null);

  return {
    poke, especie,
    categoria: es(especie.genera)[0]?.genus ?? '',
    descripcion: limpiar(es(especie.flavor_text_entries)[0]?.flavor_text ?? ''),
    evolucion: armarRelaciones(etapas, id),
    variantes: await variantes(poke, especie),
  };
}

async function desdePokeApi(id) {
  const x = await extrasPokeApi(id);
  const { poke, especie } = x;
  const tipos = poke.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
  const efect = calcularEfectividad(tipos);
  const descEn = limpiar(especie.flavor_text_entries.find((f) => f.language.name === 'en')?.flavor_text ?? '');
  return {
    id,
    nombre: nombreBonito(poke.name),
    categoria: x.categoria,
    tipos,
    altura: poke.height / 10,
    peso: poke.weight / 10,
    stats: poke.stats.map((s) => ({ clave: s.stat.name, valor: s.base_stat })),
    habilidades: poke.abilities.map((a) => ({ nombre: titulo(a.ability.name), oculta: a.is_hidden })),
    descripcion: x.descripcion || descEn,
    idiomaDescripcion: x.descripcion ? 'es' : 'en',
    sprites: spritesDe(id),
    debilidades: efect.debilidades,
    resistencias: efect.resistencias,
    evolucion: x.evolucion,
    variantes: x.variantes,
  };
}

async function variantes(poke, especie) {
  const lista = [];
  if (especie.has_gender_differences && poke.sprites.front_female) {
    lista.push({ nombre: 'Hembra', imagen: poke.sprites.front_female, tipos: [] });
  }
  const otras = especie.varieties.filter((v) => !v.is_default).slice(0, 10);
  const res = await Promise.allSettled(otras.map((v) => pa(v.pokemon.url)));
  res.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const p = r.value;
    const img = p.sprites.front_default ?? p.sprites.other?.['official-artwork']?.front_default;
    if (!img) return;
    lista.push({ nombre: nombreForma(otras[i].pokemon.name, especie.name), imagen: img, tipos: p.types.map((t) => t.type.name) });
  });
  if (poke.sprites.front_shiny) lista.push({ nombre: 'Variocolor (shiny)', imagen: poke.sprites.front_shiny, tipos: [] });
  return lista;
}

// ---------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------
function armarRelaciones(etapas, id) {
  const yo = etapas.find((e) => e.id === id);
  const padre = yo?.desde != null ? etapas.find((e) => e.id === yo.desde) : null;
  return {
    etapas,
    anterior: padre ? { id: padre.id, nombre: padre.nombre, metodo: yo.metodo } : null,
    siguientes: etapas.filter((e) => e.desde === id),
  };
}

const idDeUrl = (url) => Number(url.split('/').filter(Boolean).pop());
const limpiar = (t) => t.replace(/[\f\n\r­]+/g, ' ').replace(/\s+/g, ' ').trim();
const titulo = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const NOMBRES_ESPECIALES = {
  'nidoran-f': 'Nidoran♀', 'nidoran-m': 'Nidoran♂', 'mr-mime': 'Mr. Mime', 'mr-rime': 'Mr. Rime',
  'mime-jr': 'Mime Jr.', farfetchd: "Farfetch'd", sirfetchd: "Sirfetch'd", 'porygon-z': 'Porygon-Z',
};
export const nombreBonito = (n) => NOMBRES_ESPECIALES[n] ?? titulo(n);

function nombreForma(forma, especie) {
  const base = nombreBonito(especie);
  const resto = forma.replace(especie, '').replace(/^-/, '');
  const reglas = [
    [/^mega-(x|y)$/, (m) => `Mega ${base} ${m[1].toUpperCase()}`],
    [/^mega$/, () => `Mega ${base}`],
    [/^gmax$/, () => `${base} Gigamax`],
    [/^alola/, () => `${base} de Alola`],
    [/^galar/, () => `${base} de Galar`],
    [/^hisui/, () => `${base} de Hisui`],
    [/^paldea/, () => `${base} de Paldea`],
  ];
  for (const [re, f] of reglas) { const m = resto.match(re); if (m) return f(m); }
  return `${base} (${titulo(resto)})`;
}

const OBJETOS = {
  'fire-stone': 'Piedra Fuego', 'water-stone': 'Piedra Agua', 'thunder-stone': 'Piedra Trueno',
  'leaf-stone': 'Piedra Hoja', 'moon-stone': 'Piedra Lunar', 'sun-stone': 'Piedra Solar',
  'shiny-stone': 'Piedra Día', 'dusk-stone': 'Piedra Noche', 'dawn-stone': 'Piedra Alba',
  'ice-stone': 'Piedra Hielo', 'kings-rock': 'Roca del Rey', 'metal-coat': 'Revestimiento Metálico',
  'dragon-scale': 'Escama Dragón', upgrade: 'Mejora', 'dubious-disc': 'Disco Extraño',
  protector: 'Protector', electirizer: 'Electrizador', magmarizer: 'Magmatizador',
  'razor-claw': 'Garra Afilada', 'razor-fang': 'Colmillo Agudo', 'oval-stone': 'Piedra Oval',
  'reaper-cloth': 'Tela Terrible', 'black-augurite': 'Mineral Negro', 'galarica-cuff': 'Brazal Galanuez',
  'galarica-wreath': 'Corona Galanuez',
};
const MOVIMIENTOS = { 'ancient-power': 'Poder Pasado', rollout: 'Desenrollar', mimic: 'Mimético', 'rage-fist': 'Puño Furia' };

function describirMetodo(detalles) {
  if (!detalles?.length) return '';
  const textos = detalles.map((d) => {
    const p = [];
    const t = d.trigger?.name;
    if (t === 'use-item') p.push(`usando ${OBJETOS[d.item?.name] ?? titulo(d.item?.name ?? 'objeto')}`);
    else if (t === 'trade') p.push('por intercambio');
    else if (t === 'level-up') p.push(d.min_level ? `al nivel ${d.min_level}` : 'al subir de nivel');
    else p.push('de forma especial');
    if (d.held_item) p.push(`llevando ${OBJETOS[d.held_item.name] ?? titulo(d.held_item.name)}`);
    if (d.min_happiness) p.push('con mucha amistad');
    if (d.min_affection) p.push('con mucho cariño');
    if (d.known_move) p.push(`conociendo ${MOVIMIENTOS[d.known_move.name] ?? titulo(d.known_move.name)}`);
    if (d.known_move_type) p.push(`conociendo un movimiento tipo ${NOMBRE_TIPO[d.known_move_type.name] ?? titulo(d.known_move_type.name)}`);
    if (d.location) p.push('en un lugar especial');
    if (d.time_of_day === 'day') p.push('de día');
    if (d.time_of_day === 'night') p.push('de noche');
    return p.join(' ');
  });
  return [...new Set(textos)].slice(0, 2).join(' o ');
}
