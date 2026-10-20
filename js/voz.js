// ===============================================================
//  VOZ
//  - En navegador / PWA: Web Speech API (speechSynthesis).
//  - En la app de Android Studio (WebView): el WebView NO trae
//    speechSynthesis, así que se usa un puente nativo `AndroidTTS`
//    (ver README → "Android Studio"). Se detecta solo.
// ===============================================================
import { NOMBRE_TIPO } from './tipos.js';

const puente = () => window.AndroidTTS;
let hablando = false;
let alCambiar = () => {};
let turno = 0; // invalida colas viejas al detener

export const soportada = () => !!puente() || 'speechSynthesis' in window;
export const estaHablando = () => hablando;
export const onCambio = (fn) => { alCambiar = fn; };

function estado(v) { hablando = v; alCambiar(v); }

// El nativo avisa cuando termina
window.onTTSFin = () => estado(false);

function vozPara(lang) {
  const voces = speechSynthesis.getVoices();
  if (lang === 'en') return voces.find((v) => /^en/i.test(v.lang)) ?? null;
  return voces.find((v) => /es[-_](MX|US|419|CO)/i.test(v.lang))
      ?? voces.find((v) => /^es/i.test(v.lang))
      ?? null;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

export function detener() {
  turno++;
  if (puente()) puente().stop();
  else if ('speechSynthesis' in window) speechSynthesis.cancel();
  estado(false);
}

/** Botón de voz: si está hablando lo calla; si no, habla. */
export function alternar(texto) {
  if (hablando) { detener(); return; }
  hablar(texto);
}

/**
 * texto: string, o lista de segmentos [{ texto, lang:'es'|'en' }]
 * (el back trae la descripción en inglés: se lee con voz en inglés).
 */
export function hablar(texto) {
  detener();
  const miTurno = turno;
  const segmentos = typeof texto === 'string' ? [{ texto, lang: 'es' }] : texto;

  if (puente()) {
    estado(true);
    puente().speak(segmentos.map((s) => s.texto).join(' '));
    return;
  }
  if (!('speechSynthesis' in window)) return;

  // Chrome corta frases largas (~15 s): se parte en frases y se encolan.
  const cola = segmentos.flatMap(({ texto: t, lang }) =>
    (t.match(/[^.!?]+[.!?]*/g) ?? [t]).map((f) => ({ f: f.trim(), lang })).filter((x) => x.f));
  estado(true);
  cola.forEach(({ f, lang }, i) => {
    const u = new SpeechSynthesisUtterance(f);
    const voz = vozPara(lang);
    u.lang = voz?.lang ?? (lang === 'en' ? 'en-US' : 'es-ES');
    if (voz) u.voice = voz;
    u.rate = 1.05;
    u.pitch = 0.9; // un poco más "robot de Pokédex"
    if (i === cola.length - 1) u.onend = () => { if (miTurno === turno) estado(false); };
    u.onerror = () => { if (miTurno === turno) estado(false); };
    speechSynthesis.speak(u);
  });
}

// ---------------------------------------------------------------
//  Guion que lee la Pokédex (estilo anime: "Pikachu, el Pokémon ratón…")
// ---------------------------------------------------------------
const lista = (arr) => arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} y ${arr.at(-1)}`;
const tipoEs = (t) => (NOMBRE_TIPO[t] ?? t).toLowerCase();

export function guion(p) {
  const partes = [];
  const segmentos = [];
  const cortar = () => { if (partes.length) segmentos.push({ texto: partes.splice(0).join(' '), lang: 'es' }); };
  const cat = p.categoria && p.idiomaDescripcion !== 'en' ? `, el ${p.categoria}` : ''; // la categoría del back viene en inglés
  partes.push(`${p.nombre}${cat}. Número ${p.id}.`);
  partes.push(`Es de tipo ${lista(p.tipos.map(tipoEs))}.`);

  if (p.debilidades.length) {
    const x4 = p.debilidades.filter((d) => d.mult >= 4).map((d) => tipoEs(d.tipo));
    const x2 = p.debilidades.filter((d) => d.mult === 2).map((d) => tipoEs(d.tipo));
    let t = `Es débil contra ${lista(x2.length ? x2 : x4)}.`;
    if (x4.length && x2.length) t += ` Y muy débil contra ${lista(x4)}.`;
    else if (x4.length) t = `Es muy débil contra ${lista(x4)}.`;
    partes.push(t);
  }
  const inmune = p.resistencias.filter((r) => r.mult === 0).map((r) => tipoEs(r.tipo));
  if (inmune.length) partes.push(`Es inmune a ${lista(inmune)}.`);

  if (p.descripcion) {
    if (p.idiomaDescripcion === 'en') { cortar(); segmentos.push({ texto: p.descripcion, lang: 'en' }); }
    else partes.push(p.descripcion);
  }

  const ev = p.evolucion;
  if (ev.anterior) partes.push(`Evoluciona de ${ev.anterior.nombre}${ev.anterior.metodo ? ' ' + ev.anterior.metodo : ''}.`);
  if (ev.siguientes.length) {
    const opciones = ev.siguientes.map((s) => `${s.nombre}${s.metodo ? ' ' + s.metodo : ''}`);
    partes.push(ev.siguientes.length > 1
      ? `Puede evolucionar de ${ev.siguientes.length} formas: ${lista(opciones)}.`
      : `Puede evolucionar a ${opciones[0]}.`);
  } else {
    partes.push(ev.anterior || ev.etapas.length > 1 ? 'Es su forma final, no evoluciona más.' : 'No tiene evoluciones conocidas.');
  }

  const vars = p.variantes.map((v) => v.nombre);
  if (vars.length) partes.push(`Variantes: ${lista(vars)}.`);
  const habs = (p.habilidades ?? []).filter((h) => !h.oculta).map((h) => h.nombre);
  if (habs.length) partes.push(`Habilidades: ${lista(habs)}.`);
  cortar();
  return segmentos;
}
