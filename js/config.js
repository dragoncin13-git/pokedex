// ===============================================================
//  CONFIGURACIÓN DE LA POKÉDEX
//  (equivale al VITE_API_URL de la guía, pero sin necesitar Vite)
// ===============================================================
export const CONFIG = {
  // Cuántos Pokémon recorre la Pokédex (1 → TOTAL). El back trae 150.
  TOTAL: 150,

  // 'backend' → el back del curso (fuente principal)
  // 'pokeapi' → solo PokéAPI (por si el back está caído)
  MODO: 'backend',

  // --- Back del curso (Fastify + Prisma en Render) ---
  BACKEND_URL: 'https://pokedex-backend-g1ql.onrender.com', // sin "/" al final
  RUTA_HEALTH: '/health',
  RUTA_POKEMON: '/api/pokemon/{id}',   // acepta número o nombre
  RUTA_LISTA: '/api/pokemon',          // ?limit=&offset=&search=&type=
  RUTA_TIPOS: '/api/types',

  // El plan gratis de Render "se duerme": la 1.ª petición puede tardar 30-50 s.
  TIMEOUT_MS: 20000,   // tiempo máximo por intento
  REINTENTOS: 4,       // intentos con espera creciente (2s, 4s, 8s…)

  // El back solo trae textos en INGLÉS y no dice CÓMO evoluciona ni las variantes.
  // true → completa con PokéAPI: descripción y categoría en español,
  //        método de evolución (nivel, piedra…), Mega/Gigamax/regionales.
  // Si PokéAPI falla, se usa solo lo del back.
  ENRIQUECER_CON_POKEAPI: true,

  POKEAPI: 'https://pokeapi.co/api/v2',
  IDIOMA: 'es',
};
