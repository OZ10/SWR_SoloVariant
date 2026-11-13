// Screenshots every view of the app (desktop + phone) for before/after comparison.
// Usage: npm run snap -- <name>     → tests/output/screens/<name>/*.png
// Typical use: `npm run snap -- before`, make a change, `npm run snap -- after`,
// then `npm run diff -- before after` to see which views changed.
const fs = require("fs");
const path = require("path");
const { OUTPUT, startServer, launchBrowser } = require("../lib");

const name = process.argv[2] || "current";
const out = path.join(OUTPUT, "screens", name);
fs.mkdirSync(out, { recursive: true });

(async () => {
    const { server, url } = await startServer();
    const browser = await launchBrowser();
    const runs = [];
    for (const colorScheme of ["light", "dark"]) {
        for (const [device, viewport] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
            // Light keeps the plain names (desktop-setup.png) so older snapshots still compare
            runs.push({ label: colorScheme === "light" ? device : `${device}-dark`, viewport, colorScheme });
        }
    }
    for (const { label, viewport, colorScheme } of runs) {
        const ctx = await browser.newContext({ viewport, serviceWorkers: "block", colorScheme });
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
        await page.goto(url, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const shot = async (view, fullPage = true) => {
            await page.waitForTimeout(450); // let transitions finish
            await page.screenshot({ path: path.join(out, `${label}-${view}.png`), fullPage });
        };
        const closeModal = async (id) => {
            await page.click(`#${id} .btn-close`);
            await page.waitForSelector(`#${id}`, { state: "hidden" });
        };

        for (const tab of ["setup", "assignment", "command", "refresh", "build", "remotesystems"]) {
            await page.click(`#list-${tab}-list`);
            await shot(tab);
        }
        await page.click("#list-setup-list");
        await page.click("[data-bs-target='.advancedsetup']");
        await shot("setup-advanced");
        await page.click("#list-command-list");
        await page.click("[data-bs-target='#movementrules']");
        await shot("command-movement");

        await page.click("button[data-bs-target='#roundtracker']");
        await shot("roundtracker", false);
        await page.evaluate(() => bootstrap.Offcanvas.getInstance(document.getElementById("roundtracker")).hide());
        await page.waitForSelector("#roundtracker", { state: "hidden" });
        await page.click("button[data-bs-target='#options']");
        await shot("settings", false);
        await page.click("#options .btn-close");
        await page.waitForSelector("#options", { state: "hidden" });
        await page.click("#list-build-list");
        await page.click("#buildbutton button");
        await shot("buildmodal", false);
        await closeModal("buildqueuelist");
        await page.click("#list-command-list");
        await page.click("a[data-bs-target='#carddecisionlist']");
        await shot("decisionlist", false);
        await closeModal("carddecisionlist");
        await page.evaluate(() => document.querySelector("header .d6button").click());
        await shot("d6", false);

        console.log(`${label}: ${errors.length ? "ERRORS: " + errors.join(" | ") : "no errors"}`);
        await ctx.close();
    }
    await browser.close();
    server.close();
    console.log(`Saved to ${path.relative(process.cwd(), out)}`);
})().catch((e) => { console.error(e); process.exit(1); });
