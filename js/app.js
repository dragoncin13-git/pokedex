import { CONFIG } from './config.js';
import { obtenerPokemon, obtenerNombres, listar, obtenerTipos, onEstadoRed, despertar, spriteDe } from './api.js';
import { NOMBRE_TIPO } from './tipos.js';
import * as voz from './voz.js';
import * as imgs from './imagenes.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

const estado = { id: 1, poke: null, shiny: false, hd: false, galeria: [], urls: [], visor: null, pedido: 0 };

const STAT = { hp: 'PS', attack: 'ATQ', defense: 'DEF', 'special-attack': 'AT.E', 'special-defense': 'DF.E', speed: 'VEL' };

// ---------------------------------------------------------------
//  Navegación
// ---------------------------------------------------------------
function idValido(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 1;
  if (n < 1) return CONFIG.TOTAL;          // del 1 hacia atrás → 150
  if (n > CONFIG.TOTAL) return 1;          // del 150 hacia adelante → 1
  return Math.trunc(n);
}

function ir(n) {
  const id = idValido(n);
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  cargar(id);
}

async function cargar(id) {
  voz.detener();
  estado.id = id;
  const miPedido = ++estado.pedido;
  $('numero').textContent = `#${String(id).padStart(3, '0')}`;
  $('pantalla').classList.add('cargando');
  $('pantallaError').hidden = true;
  $('cargando').textContent = 'CARGANDO…';
  $('ledActividad').classList.add('parpadea');

  try {
    const p = await obtenerPokemon(id);
    if (miPedido !== estado.pedido) return; // el usuario ya pasó a otro
    estado.poke = p;
    await pintar(p);
    // Precarga vecinos para que la navegación se sienta instantánea
    [idValido(id + 1), idValido(id - 1)].forEach((v) => obtenerPokemon(v).catch(() => {}));
  } catch (e) {
    console.error(e);
    if (miPedido === estado.pedido) mostrarError(e);
  } finally {
    if (miPedido === estado.pedido) {
      $('pantalla').classList.remove('cargando');
      $('ledActividad').classList.remove('parpadea');
    }
  }
}

// ---------------------------------------------------------------
//  Render
// ---------------------------------------------------------------
async function pintar(p) {
  $('nombre').textContent = p.nombre;
  document.title = `#${String(p.id).padStart(3, '0')} ${p.nombre} · Pokédex`;
  $('categoria').textContent = p.categoria;

  pintarTipos($('tipos'), p.tipos.map((t) => ({ tipo: t })));
  pintarTipos($('debilidades'), p.debilidades);
  pintarTipos($('resistencias'), p.resistencias);

  $('altura').textContent = `${p.altura.toFixed(1)} m`;
  $('peso').textContent = `${p.peso.toFixed(1)} kg`;
  const st = $('stats'); st.replaceChildren();
  p.stats.forEach((s) => {
    const fila = el('div', 'stat');
    fila.append(el('span', '', STAT[s.clave] ?? s.clave), el('span', '', s.valor));
    const barra = el('div', 'stat__barra'); const i = el('i');
    i.style.width = `${Math.min(100, (s.valor / 180) * 100)}%`;
    barra.append(i); fila.append(barra); st.append(fila);
  });

  const hab = $('habilidades'); hab.replaceChildren();
  (p.habilidades ?? []).forEach((h) => {
    const s = el('span', h.oculta ? 'oculta' : '', h.nombre + (h.oculta ? ' (oculta)' : ''));
    hab.append(s);
  });
  if (!hab.children.length) hab.append(el('span', '', '—'));

  $('descripcion').textContent = p.descripcion || 'Sin descripción.';
  $('descripcion').lang = p.idiomaDescripcion ?? 'es';
  pintarEvolucion(p);
  pintarVariantes(p);
  await pintarGaleria();
  pintarSprite();
}

function pintarTipos(cont, lista) {
  cont.replaceChildren();
  if (!lista.length) { cont.append(el('span', 'texto-chico', 'Ninguna')); return; }
  lista.forEach(({ tipo, mult }) => {
    const chip = el('span', `tipo t-${tipo}`, (NOMBRE_TIPO[tipo] ?? tipo).toUpperCase());
    if (mult != null && mult !== 2 && mult !== 0.5) chip.append(el('b', '', mult === 0 ? '×0' : `×${mult}`));
    cont.append(chip);
  });
}

function pintarEvolucion(p) {
  const cont = $('cadena'); cont.replaceChildren();
  const { etapas, anterior, siguientes } = p.evolucion;

  // Ordena por "profundidad" para mostrar 1 → 2 → 3 (ramas en la misma columna)
  const prof = (e) => (e.desde == null ? 0 : 1 + prof(etapas.find((x) => x.id === e.desde) ?? { desde: null }));
  const niveles = [];
  etapas.forEach((e) => { (niveles[prof(e)] ??= []).push(e); });

  niveles.forEach((grupo, i) => {
    if (i) cont.append(el('span', 'evo-flecha', '▶'));
    const col = el('div'); col.style.display = 'grid'; col.style.gap = '6px';
    grupo.forEach((e) => {
      const b = el('button', 'evo' + (e.id === p.id ? ' actual' : ''));
      const img = el('img'); img.src = spriteDe(e.id); img.alt = ''; img.loading = 'lazy';
      b.append(img, el('span', '', e.nombre));
      if (e.metodo) b.title = e.metodo;
      if (e.id > CONFIG.TOTAL) { b.disabled = true; b.title = `${e.metodo} · fuera de los ${CONFIG.TOTAL} originales`; }
      else b.onclick = () => ir(e.id);
      col.append(b);
    });
    cont.append(col);
  });

  const t = [];
  if (anterior) t.push(`Evoluciona de ${anterior.nombre}${anterior.metodo ? ' ' + anterior.metodo : ''}.`);
  if (siguientes.length) siguientes.forEach((s) => t.push(`→ ${s.nombre}${s.metodo ? ': ' + s.metodo : ''}.`));
  else t.push(etapas.length > 1 ? 'Forma final: no evoluciona más.' : 'No evoluciona.');
  $('evolucionTexto').textContent = t.join(' ');
}

function pintarVariantes(p) {
  const cont = $('variantes'); cont.replaceChildren();
  if (!p.variantes.length) { cont.append(el('span', 'texto-chico', 'Sin variantes.')); return; }
  p.variantes.forEach((v) => {
    const c = el('div', 'variante');
    const img = el('img'); img.src = v.imagen; img.alt = v.nombre; img.loading = 'lazy';
    c.append(img, el('span', '', v.nombre));
    if (v.tipos?.length) c.append(el('span', '', v.tipos.map((t) => NOMBRE_TIPO[t] ?? t).join('/')));
    cont.append(c);
  });
}

function pintarSprite() {
  const img = $('sprite');
  const principal = estado.galeria.find((g) => g.principal);
  const s = estado.poke.sprites;
  let src;
  if (principal) src = estado.urls[estado.galeria.indexOf(principal)];
  else if (estado.hd) src = estado.shiny ? s.hdShiny : s.hd;
  else src = estado.shiny ? s.shiny : s.normal;
  img.classList.toggle('hd', estado.hd || !!principal);
  img.alt = estado.poke.nombre;
  img.src = src;
  img.classList.remove('entra'); void img.offsetWidth; img.classList.add('entra');
}

// ---------------------------------------------------------------
//  Galería de imágenes propias
// ---------------------------------------------------------------
async function pintarGaleria() {
  estado.urls.forEach(URL.revokeObjectURL);
  try { estado.galeria = await imgs.listar(estado.id); } catch { estado.galeria = []; }
  estado.urls = estado.galeria.map((g) => URL.createObjectURL(g.blob));
  const cont = $('galeria'); cont.replaceChildren();
  estado.galeria.forEach((g, i) => {
    const b = el('button', g.principal ? 'principal' : '');
    b.setAttribute('aria-label', 'Ver imagen');
    const img = el('img'); img.src = estado.urls[i]; img.alt = '';
    b.append(img);
    b.onclick = () => abrirVisor(i);
    cont.append(b);
  });
}

async function anadirImagenes(files) {
  const id = estado.id;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const blob = await imgs.reducir(f);
    await imgs.guardar(id, blob); // el back del curso no recibe imágenes: se guardan en el dispositivo
  }
  if (id === estado.id) { await pintarGaleria(); pintarSprite(); }
  toast('Imagen añadida ✔');
}

function abrirVisor(i) {
  estado.visor = estado.galeria[i];
  $('visorImg').src = estado.urls[i];
  $('visorPrincipal').textContent = estado.visor.principal ? '☆ QUITAR PRINCIPAL' : '★ PRINCIPAL';
  $('visor').showModal();
}

// ---------------------------------------------------------------
//  Toast
// ---------------------------------------------------------------
let tToast;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('ver');
  clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove('ver'), 2600);
}

// ---------------------------------------------------------------
//  Eventos
// ---------------------------------------------------------------
$('btnSiguiente').onclick = () => ir(estado.id + 1);
$('btnAnterior').onclick = () => ir(estado.id - 1);
$('btnPrimero').onclick = () => ir(1);
$('btnUltimo').onclick = () => ir(CONFIG.TOTAL);

$('btnVoz').onclick = () => {
  if (!voz.soportada()) return toast('Este dispositivo no tiene voz disponible.');
  if (!estado.poke) return;
  voz.alternar(voz.guion(estado.poke));
};
voz.onCambio((activo) => {
  $('btnVoz').classList.toggle('activo', activo);
  $('btnVoz').textContent = activo ? '🔇' : '🔊';
  $('btnVoz').setAttribute('aria-label', activo ? 'Detener voz' : 'Escuchar información');
  $('lente').classList.toggle('hablando', activo);
});

function toggle(btn, clave) {
  estado[clave] = !estado[clave];
  btn.setAttribute('aria-pressed', estado[clave]);
  if (estado.poke) pintarSprite();
}
$('btnShiny').onclick = (e) => toggle(e.currentTarget, 'shiny');
$('btnHD').onclick = (e) => toggle(e.currentTarget, 'hd');

$('formBuscar').onsubmit = (e) => {
  e.preventDefault();
  const v = $('inputBuscar').value.trim().toLowerCase().replace(/^#/, '');
  if (!v) return;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (n < 1 || n > CONFIG.TOTAL) return toast(`Solo del 1 al ${CONFIG.TOTAL}`);
    ir(n);
  } else {
    const hit = listaNombres.find((p) => p.nombre.toLowerCase() === v) ?? listaNombres.find((p) => p.nombre.toLowerCase().startsWith(v));
    if (hit) ir(hit.id); else toast('No encontrado');
  }
  $('inputBuscar').value = '';
  $('inputBuscar').blur();
};

$('inputImagen').onchange = async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  try { await anadirImagenes(files); } catch (err) { console.error(err); toast('No se pudo guardar la imagen'); }
};

$('visorCerrar').onclick = () => $('visor').close();
$('visorBorrar').onclick = async () => {
  await imgs.borrar(estado.visor.clave);
  $('visor').close(); await pintarGaleria(); pintarSprite();
};
$('visorPrincipal').onclick = async () => {
  await imgs.marcarPrincipal(estado.id, estado.visor.clave);
  $('visor').close(); await pintarGaleria(); pintarSprite();
};

// Teclado (PC)
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input') || $('visor').open || $('lista').open) return;
  if (e.key === 'ArrowRight') ir(estado.id + 1);
  if (e.key === 'ArrowLeft') ir(estado.id - 1);
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('btnVoz').click(); }
});

// Deslizar sobre la pantalla (cel)
let x0 = null;
$('pantalla').addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
$('pantalla').addEventListener('touchend', (e) => {
  if (x0 == null) return;
  const dx = e.changedTouches[0].clientX - x0; x0 = null;
  if (Math.abs(dx) > 50) ir(estado.id + (dx < 0 ? 1 : -1));
});

window.addEventListener('hashchange', () => {
  const n = idValido(location.hash.slice(1));
  if (n !== estado.id) cargar(n);
});

// ---------------------------------------------------------------
//  Arranque
// ---------------------------------------------------------------
// ---------------------------------------------------------------
//  Errores, cold start y conexión
// ---------------------------------------------------------------
function mostrarError(e) {
  const msj = {
    no_encontrado: 'POKÉMON NO ENCONTRADO',
    servidor: 'ERROR DEL SERVIDOR',
    red: navigator.onLine ? 'EL SERVIDOR NO RESPONDE' : 'SIN CONEXIÓN',
  }[e.tipo] ?? 'ERROR';
  $('nombre').textContent = '???';
  $('pantallaErrorTxt').textContent = msj;
  $('pantallaError').hidden = false;
}
$('btnReintentar').onclick = () => cargar(estado.id);

onEstadoRed((ev, n) => {
  if (ev === 'lento') $('cargando').textContent = 'DESPERTANDO SERVIDOR… (hasta 50 s)';
  if (ev === 'reintentando') $('cargando').textContent = `REINTENTANDO (${n})…`;
});

const pintarConexion = () => { $('offline').hidden = navigator.onLine; };
window.addEventListener('online', () => { pintarConexion(); if (!estado.poke) cargar(estado.id); });
window.addEventListener('offline', pintarConexion);
pintarConexion();

// ---------------------------------------------------------------
//  Listado con búsqueda, filtro por tipo y paginación
// ---------------------------------------------------------------
const L = { search: '', type: '', offset: 0, total: 0, pedido: 0, PAG: 30 };

async function cargarLista(reiniciar) {
  const grid = $('listaGrid');
  if (reiniciar) {
    L.offset = 0; grid.replaceChildren();
    for (let i = 0; i < 6; i++) grid.append(el('div', 'tarjeta tarjeta--skel'));
  }
  const miPedido = ++L.pedido;
  $('listaMas').hidden = true;
  $('listaInfo').textContent = 'Cargando…';
  try {
    const r = await listar({ limit: L.PAG, offset: L.offset, search: L.search, type: L.type });
    if (miPedido !== L.pedido) return;
    if (reiniciar) grid.replaceChildren();
    L.total = r.total; L.offset += r.data.length;
    r.data.forEach((p) => {
      const b = el('button', 'tarjeta');
      const img = el('img'); img.src = p.sprite; img.alt = ''; img.loading = 'lazy';
      const mini = el('div', 'mini');
      p.tipos.forEach((t) => mini.append(el('span', `t-${t}`, (NOMBRE_TIPO[t] ?? t).toUpperCase())));
      b.append(img, el('span', 'num', `#${String(p.id).padStart(3, '0')}`), el('span', '', p.nombre), mini);
      b.onclick = () => { $('lista').close(); ir(p.id); };
      grid.append(b);
    });
    $('listaInfo').textContent = L.total ? `${L.offset} de ${L.total}` : 'No hay Pokémon con ese filtro.';
    $('listaMas').hidden = L.offset >= L.total;
  } catch (e) {
    if (miPedido !== L.pedido) return;
    if (reiniciar) grid.replaceChildren();
    $('listaInfo').textContent = e.tipo === 'red' ? 'Sin conexión con el servidor.' : 'Error al cargar la lista.';
    $('listaMas').textContent = 'REINTENTAR'; $('listaMas').hidden = false;
    $('listaMas').onclick = () => { $('listaMas').textContent = 'CARGAR MÁS'; $('listaMas').onclick = () => cargarLista(false); cargarLista(reiniciar); };
  }
}
$('listaMas').onclick = () => cargarLista(false);

let tiposPintados = false;
async function pintarTiposLista() {
  if (tiposPintados) return;
  try {
    const tipos = await obtenerTipos();
    const cont = $('listaTipos');
    tipos.forEach(({ tipo, cantidad }) => {
      const b = el('button', `tipo t-${tipo}`, (NOMBRE_TIPO[tipo] ?? tipo).toUpperCase() + (cantidad != null ? ` ${cantidad}` : ''));
      b.setAttribute('aria-pressed', 'false');
      b.onclick = () => {
        L.type = L.type === tipo ? '' : tipo;
        cont.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b && L.type ? 'true' : 'false'));
        cargarLista(true);
      };
      cont.append(b);
    });
    tiposPintados = true;
  } catch { /* sin tipos: la lista igual funciona */ }
}

$('btnLista').onclick = () => {
  $('lista').showModal();
  pintarTiposLista();
  if (!$('listaGrid').children.length) cargarLista(true);
};
$('listaCerrar').onclick = () => $('lista').close();
let tBuscar;
$('listaBuscar').oninput = (e) => {
  clearTimeout(tBuscar);
  tBuscar = setTimeout(() => { L.search = e.target.value.trim(); cargarLista(true); }, 300); // debounce
};

// ---------------------------------------------------------------
//  Arranque
// ---------------------------------------------------------------
let listaNombres = [];
despertar(); // ping a /health para que Render empiece a despertar ya
obtenerNombres().then((l) => {
  listaNombres = l;
  const dl = $('listaPokemon');
  l.forEach((p) => { const o = el('option'); o.value = p.nombre; o.label = `#${p.id}`; dl.append(o); });
}).catch(() => {});

cargar(idValido(location.hash.slice(1) || 1));

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW no registrado', e));
}
