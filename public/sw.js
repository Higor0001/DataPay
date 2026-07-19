const CACHE_NAME = 'datapay-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg'
];

// Evento de Instalação: armazena os recursos estáticos essenciais no cache local
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Evento de Ativação: limpa caches antigos para evitar conflitos de versão
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Evento de Fetch: intercepta requisições, priorizando a rede e caindo para o cache offline em caso de falha
self.addEventListener('fetch', (event) => {
  // Apenas faz cache de requisições do tipo GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Armazena a resposta bem-sucedida no cache dinâmico
        if (response && response.status === 200) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // Caso a rede falhe (offline), entrega o recurso armazenado no cache local
        return caches.match(event.request);
      })
  );
});
