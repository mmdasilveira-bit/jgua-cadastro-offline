const CACHE_NAME = 'jgua-v3';
const assets = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Instala e armazena os arquivos no cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(assets))
  );
  // Força o novo SW a assumir imediatamente (sem esperar fechar o app)
  self.skipWaiting();
});

// Quando este SW assume o controle, apaga os caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: tenta buscar da rede primeiro; se falhar, usa o cache
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Atualiza o cache com a resposta mais recente
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
