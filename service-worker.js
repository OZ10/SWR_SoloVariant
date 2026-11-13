// Offline support for the Solo Variant app.
//
// - On install, every file the app needs is stored in a cache, so the app
//   works with no connection from the second visit onwards.
// - Our own files are fetched network-first: when online you always get the
//   latest version (no need to bump anything on deploy). If the network fails,
//   or takes longer than NETWORK_TIMEOUT_MS (bad signal), the cached copy is used.
// - The Google Material Icons font is cached on install and served cache-first.
//
// Bump CACHE_VERSION when files are added to/removed from PRECACHE_URLS.
const CACHE_VERSION = "v2";
const CACHE_NAME = "swr-solo-" + CACHE_VERSION;
const NETWORK_TIMEOUT_MS = 3000;

const MATERIAL_ICONS_CSS = "https://fonts.googleapis.com/icon?family=Material+Icons";

const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./favicon.ico",
    "./resources/css/index.css",
    "./resources/js/main.js",
    "./resources/bootstrap-5.3.8/js/bootstrap.bundle.min.js",
    "./resources/icons/starwars-glyphicons/css/starwars-glyphicons.css",
    "./resources/icons/starwars-glyphicons/fonts/starwars-glyphicons-webfont.ttf",
    "./resources/font/Goldman-Regular.ttf",
    "./resources/font/Goldman-Bold.ttf",
    "./resources/images/Round_Marker_sm.png",
    "./resources/images/Round_Rebel_sm.png",
    "./resources/images/manifest/icon-192x192.png",
    "./resources/images/manifest/icon-512x512.png",
    ...[1, 2, 3, 4, 5, 6].map((n) => `./resources/images/D6_${n}.png`),
    ...["Dagobah", "Dantooine", "Dathomir", "Endor", "Hoth", "Ilum", "Tatooine", "Yavin"].flatMap(
        (p) => [`./resources/images/SWR_${p}.png`, `./resources/images/SWR_${p}_bw.png`]
    ),
];

const isGoogleFont = (url) =>
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

// Best effort: store the icon font's CSS and the font files it points to.
// The app still works without it (icons just show as text), so never fail install.
async function precacheMaterialIcons(cache) {
    try {
        const cssResponse = await fetch(MATERIAL_ICONS_CSS);
        if (!cssResponse.ok) return;
        await cache.put(MATERIAL_ICONS_CSS, cssResponse.clone());
        const css = await cssResponse.text();
        const fontUrls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map((m) => m[1]);
        await Promise.all(
            fontUrls.map(async (url) => {
                const res = await fetch(url);
                if (res.ok) await cache.put(url, res);
            })
        );
    } catch (error) {
        console.warn("Could not cache Material Icons for offline use", error);
    }
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(PRECACHE_URLS);
            await precacheMaterialIcons(cache);
            await self.skipWaiting();
        })()
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys();
            await Promise.all(
                names
                    .filter((name) => name.startsWith("swr-solo-") && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
            await self.clients.claim();
        })()
    );
});

async function networkFirst(event) {
    const request = event.request;
    const cache = await caches.open(CACHE_NAME);
    const cached =
        (await cache.match(request, { ignoreSearch: true })) ||
        (request.mode === "navigate" ? await cache.match("./index.html") : undefined);

    const network = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    });
    // Let the cache update finish even if the cached copy is returned first
    event.waitUntil(network.catch(() => {}));

    if (!cached) {
        return network;
    }

    const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
    return Promise.race([network.catch(() => cached), timeout]);
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
        cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(event));
    } else if (isGoogleFont(url)) {
        event.respondWith(cacheFirst(event.request));
    }
    // Anything else (e.g. links to BoardGameGeek) goes straight to the network.
});
