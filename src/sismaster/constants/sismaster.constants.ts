export const SISMASTER_CONFIG = {
  BASE_URL: 'https://master.hayllis.com',
  UPLOADS_PATH: '/writable/uploads',
} as const;

/**
 * Convierte una ruta de Sismaster a URL completa
 * Maneja múltiples formatos:
 * - URLs completas: "https://..." → pasa tal cual
 * - Rutas relativas: "unis/logo.png" → "https://master.hayllis.com/writable/uploads/unis/logo.png"
 * - Rutas con prefijo erróneo: "unis/https://..." → "https://..."
 * - Valores vacíos: "" → undefined
 */
export function toSismasterUrl(path?: string | null): string | undefined {
  // Valores vacíos o nulos
  if (!path || path.trim() === '') return undefined;

  // Si ya es una URL completa, retornarla
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Caso especial: "unis/https://..." (error en la DB)
  // Extraer la URL completa que viene después de "unis/"
  const httpIndex = path.indexOf('http://');
  const httpsIndex = path.indexOf('https://');
  
  if (httpIndex > 0) {
    return path.substring(httpIndex); // Extraer desde "http://"
  }
  
  if (httpsIndex > 0) {
    return path.substring(httpsIndex); // Extraer desde "https://"
  }

  // Ruta relativa válida: agregar base URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SISMASTER_CONFIG.BASE_URL}${SISMASTER_CONFIG.UPLOADS_PATH}${cleanPath}`;
}
