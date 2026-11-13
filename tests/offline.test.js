// Checks the service worker: everything is cached on the first visit, the app works
// with the network switched off, and a new deploy is picked up when back online.
// Run with: npm run test:offline
const fs = require("fs");
const path = require("path");
const { ROOT, OUTPUT, runTest } = require("./lib");

const swSource = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const expectedCache = "swr-solo-" + swSource.match(/CACHE_VERSION\s*=\s*"([^"]+)"/)[1];

// Simulates a deploy: main.js gets a marker line saying which "version" is live.
let deployedVersion = 1;
const transform = (urlPath, body) =>
    urlPath.endsWith("/main.js") ? Buffer.concat([body, Buffer.from(`\nwindow.__deployedVersion = ${deployedVersion};\n`)]) : body;

runTest(async ({ browser, url, check }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    const loaded = new Set();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("dialog", (d) => d.accept());
    page.on("requestfinished", (r) => {
        const u = new URL(r.url());
        if (u.hostname === "localhost" && !u.pathname.endsWith("service-worker.js")) loaded.add(u.origin + u.pathname);
    });

    // ---------- First visit (online) ----------
    await page.goto(url, { waitUntil: "networkidle" });
    // Open every tab so all images the CSS uses get requested too
    for (const tab of ["setup", "command", "refresh", "build", "remotesystems", "assignment"]) await page.click(`#list-${tab}-list`);
    check("Bootstrap loaded from the local copy, not a CDN", await page.evaluate(() =>
        typeof bootstrap !== "undefined" && [...document.scripts].every((s) => !s.src || s.src.startsWith(location.origin))));

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
    check("Service worker installed and controlling the page", true);

    const cached = await page.evaluate(async () => {
        const names = await caches.keys();
        const cache = await caches.open(names.find((n) => n.startsWith("swr-solo-")));
        return { names, urls: (await cache.keys()).map((r) => r.url.split("?")[0]) };
    });
    check(`Cache created (${expectedCache})`, cached.names.length === 1 && cached.names[0] === expectedCache, JSON.stringify(cached.names));
    const missing = [...loaded].filter((u) => !cached.urls.includes(u) && !u.endsWith("/"));
    check("Every file the page loaded is precached", missing.length === 0, missing.length ? "missing: " + missing.join(", ") : `${loaded.size} files`);
    const iconCss = cached.urls.some((u) => u.startsWith("https://fonts.googleapis.com/icon"));
    const iconFont = cached.urls.some((u) => u.startsWith("https://fonts.gstatic.com/"));
    check("Material Icons CSS + font cached", iconCss && iconFont, `css=${iconCss} font=${iconFont}`);

    // ---------- Offline ----------
    await ctx.setOffline(true);
    errors.length = 0;
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(500);
    const offline = await page.evaluate(async () => {
        await document.fonts.ready;
        return {
            title: document.title,
            online: navigator.onLine,
            bootstrap: typeof bootstrap !== "undefined",
            mainJs: typeof changeRound === "function",
            buildRows: document.querySelectorAll("#buildqueue [data-planet]").length,
            iconFont: document.fonts.check('24px "Material Icons"'),
            goldman: [...document.fonts].some((f) => /Goldman/i.test(f.family) && f.status === "loaded"),
        };
    });
    check("Offline: page loads", offline.title.includes("Solo Variant") && !offline.online, JSON.stringify(offline));
    check("Offline: Bootstrap + main.js run", offline.bootstrap && offline.mainJs && offline.buildRows === 25, JSON.stringify(offline));
    check("Offline: fonts available (Material Icons, Goldman)", offline.iconFont && offline.goldman, JSON.stringify(offline));

    await page.click("#list-remotesystems-list");
    await page.waitForTimeout(300);
    const planetImageLoads = () => page.evaluate(async () => {
        const m = getComputedStyle(document.getElementById("hoth"), "::before").content.match(/url\("?(.*?)"?\)/);
        if (!m) return { ok: false, u: "none" };
        const img = new Image();
        img.src = m[1];
        try { await img.decode(); return { ok: img.naturalWidth > 0, u: m[1].split("/").pop() }; } catch { return { ok: false, u: m[1] }; }
    });
    let img = await planetImageLoads();
    check("Offline: planet card image loads (unscanned, grey)", img.ok && img.u.endsWith("_bw.png"), img.u);
    await page.click("label[for='planet-check-hoth']");
    img = await planetImageLoads();
    check("Offline: planet card image loads (scanned, colour)", img.ok && !img.u.endsWith("_bw.png"), img.u);
    check("Offline: Remote Systems tracking works", (await page.innerText("#numselectedsystems")).trim() === "1");

    await page.evaluate(() => document.querySelector("header .d6button").click());
    await page.waitForSelector("#d6modal.show");
    await page.waitForTimeout(400);
    const face = await page.evaluate(async () => { const i = document.getElementById("d6"); await i.decode().catch(() => {}); return { src: i.src.slice(-8), w: i.naturalWidth }; });
    check("Offline: D6 roll shows a face image", face.w > 0, JSON.stringify(face));
    await page.screenshot({ path: path.join(OUTPUT, "offline-d6.png") });
    await page.click("#d6modal .btn-close");
    await page.waitForSelector("#d6modal", { state: "hidden" });
    await page.evaluate(() => changeRound());
    check("Offline: round tracker works", (await page.innerText("#roundnumber")).trim() === "2");
    check("Offline: no JS errors", errors.length === 0, errors.join(" | "));

    // ---------- Back online: a new deploy is picked up ----------
    await ctx.setOffline(false);
    check("Before deploy: version 1 running", (await page.evaluate(() => window.__deployedVersion)) === 1);
    deployedVersion = 2;
    await page.reload({ waitUntil: "networkidle" });
    check("Online after deploy: new main.js used straight away", (await page.evaluate(() => window.__deployedVersion)) === 2);
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "load" });
    check("Offline after deploy: cache holds the new version", (await page.evaluate(() => window.__deployedVersion)) === 2);
    check("Game state survived all reloads",
        (await page.innerText("#roundnumber")).trim() === "2" && (await page.innerText("#numselectedsystems")).trim() === "1");
    await ctx.close();
}, { transform });
