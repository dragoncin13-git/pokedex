// ===============================================================
//  IMÁGENES AÑADIDAS POR EL USUARIO
//  Se guardan en IndexedDB del dispositivo (funcionan offline).
//  (el back del curso no tiene endpoint para recibirlas)
// ===============================================================
const DB = 'pokedex', STORE = 'imagenes';

function abrir() {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'clave', autoIncrement: true });
      s.createIndex('pokemon', 'pokemon');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(STORE, modo);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => mal(t.error);
  });
}

export const listar = (pokemon) =>
  tx('readonly', (s) => s.index('pokemon').getAll(pokemon));

export const guardar = (pokemon, blob) =>
  tx('readwrite', (s) => s.add({ pokemon, blob, principal: false, fecha: Date.now() }));

export const borrar = (clave) => tx('readwrite', (s) => s.delete(clave));

export async function marcarPrincipal(pokemon, clave) {
  const todas = await listar(pokemon);
  await tx('readwrite', (s) => {
    todas.forEach((img) => s.put({ ...img, principal: img.clave === clave ? !img.principal : false }));
  });
}

/** Reduce la foto (máx 800 px) para no llenar el almacenamiento del cel. */
export async function reducir(file, max = 800) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  // webp conserva la transparencia (jpeg la vuelve negra)
  return new Promise((ok) => c.toBlob(ok, 'image/webp', 0.85));
}
