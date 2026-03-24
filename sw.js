self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installiert');
});

self.addEventListener('fetch', (e) => {
    // Leitet alle Anfragen einfach normal ans Internet weiter
    e.respondWith(fetch(e.request));
});
