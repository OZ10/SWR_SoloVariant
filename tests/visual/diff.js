// Compares two sets of screenshots from snap.js and lists how much each view changed.
// Usage: npm run diff -- <before> <after>     (names of folders in tests/output/screens/)
const fs = require("fs");
const path = require("path");
const { OUTPUT, launchBrowser } = require("../lib");

const [beforeName = "before", afterName = "after"] = process.argv.slice(2);
const beforeDir = path.join(OUTPUT, "screens", beforeName);
const afterDir = path.join(OUTPUT, "screens", afterName);

(async () => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const rows = [];
    for (const name of fs.readdirSync(beforeDir).filter((f) => f.endsWith(".png"))) {
        if (!fs.existsSync(path.join(afterDir, name))) {
            rows.push({ name, pct: "100.00", size: "missing in " + afterName });
            continue;
        }
        const a = fs.readFileSync(path.join(beforeDir, name)).toString("base64");
        const b = fs.readFileSync(path.join(afterDir, name)).toString("base64");
        // Compare in the browser's canvas so no image library is needed
        const r = await page.evaluate(async ([a, b]) => {
            const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + s; });
            const [ia, ib] = await Promise.all([load(a), load(b)]);
            const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
            const pixels = (img) => {
                const c = new OffscreenCanvas(w, h).getContext("2d");
                c.fillStyle = "#f0f";
                c.fillRect(0, 0, w, h);
                c.drawImage(img, 0, 0);
                return c.getImageData(0, 0, w, h).data;
            };
            const pa = pixels(ia), pb = pixels(ib);
            let changed = 0;
            for (let i = 0; i < pa.length; i += 4) {
                if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 30) changed++;
            }
            return { pct: (100 * changed / (w * h)).toFixed(2), size: `${ia.width}x${ia.height} → ${ib.width}x${ib.height}` };
        }, [a, b]);
        rows.push({ name, ...r });
    }
    rows.sort((x, y) => y.pct - x.pct).forEach((r) => console.log(`${r.pct.padStart(6)}%  ${r.name.padEnd(30)} ${r.size}`));
    await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
