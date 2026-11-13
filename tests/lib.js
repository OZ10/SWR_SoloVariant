// Shared helpers for the browser tests: a static file server for the repo,
// a headless browser launcher, and a simple PASS/FAIL check recorder.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(__dirname, "output");

const TYPES = {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
};

// Serves the repo over http://localhost (service workers need a real origin).
// `transform(urlPath, buffer)` can rewrite a file's contents before it is sent.
async function startServer({ transform } = {}) {
    const server = http.createServer((req, res) => {
        let p = decodeURIComponent(req.url.split("?")[0]);
        if (p === "/") p = "/index.html";
        const file = path.join(ROOT, p);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404);
            return res.end();
        }
        let body = fs.readFileSync(file);
        if (transform) body = transform(p, body);
        res.writeHead(200, {
            "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "no-cache",
        });
        res.end(body);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return { server, url: `http://localhost:${server.address().port}/index.html` };
}

// Uses an installed browser: Edge on Windows, Chrome elsewhere (as on GitHub's
// Ubuntu runners). Override with BROWSER_CHANNEL=chrome|msedge|chromium.
function launchBrowser() {
    const channel = process.env.BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : "chrome");
    return chromium.launch({ channel, headless: true });
}

// Opens a page with error and dialog tracking. Service workers are blocked unless
// asked for, so each test starts from a clean, uncached page.
async function newPage(browser, url, { viewport = { width: 1280, height: 900 }, serviceWorkers = "block" } = {}) {
    const ctx = await browser.newContext({ viewport, serviceWorkers });
    const page = await ctx.newPage();
    page.errors = [];
    page.dialogs = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
    page.on("dialog", async (d) => { page.dialogs.push(d.message()); await d.accept(); });
    await page.goto(url, { waitUntil: "networkidle" });
    return page;
}

function createChecker() {
    const results = [];
    const check = (name, ok, detail = "") => {
        results.push({ name, ok: !!ok, detail });
        console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
    };
    const finish = () => {
        const failed = results.filter((r) => !r.ok);
        console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
        if (failed.length) {
            console.log("\nFailed:");
            failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? "  — " + f.detail : ""}`));
        }
        return failed.length === 0;
    };
    return { check, finish };
}

// Runs a test body with a server + browser, always cleaning up, and sets the exit code.
async function runTest(body, serverOptions) {
    fs.mkdirSync(OUTPUT, { recursive: true });
    const { server, url } = await startServer(serverOptions);
    const browser = await launchBrowser();
    const checker = createChecker();
    try {
        await body({ browser, url, ...checker });
    } catch (error) {
        console.error(error);
        checker.check("Test run completed without crashing", false, String(error).split("\n")[0]);
    } finally {
        await browser.close();
        server.close();
    }
    process.exitCode = checker.finish() ? 0 : 1;
}

module.exports = { ROOT, OUTPUT, startServer, launchBrowser, newPage, createChecker, runTest };
