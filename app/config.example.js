/* Copia este fichero a config.js y pon los valores reales.
   config.js está en .gitignore (contiene la contraseña del proxy). */
window.EOCFG = {
  // Proxy HLS para los streams (mediaflow-proxy).
  // Pruebas LAN: http://192.168.1.150:8888 · Producción: https://<nodo>.<tailnet>.ts.net
  PROXY: 'http://NAS_IP:8888',
  // Contraseña del proxy de streams (API_PASSWORD del contenedor mediaflow-proxy).
  API_PASSWORD: 'PON_AQUI_LA_PASSWORD',
  // Proxy CORS para el catálogo (cors-anywhere): relaya el player_api.php completo.
  // Pruebas LAN: http://192.168.1.150:8889
  CORS: 'http://NAS_IP:8889'
};
