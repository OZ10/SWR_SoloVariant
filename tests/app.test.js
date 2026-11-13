// Drives the app in a headless browser and checks its behaviour end to end.
// Run with: npm run test:app   (screenshots are saved to tests/output/)
const path = require("path");
const { OUTPUT, newPage, runTest } = require("./lib");

const shot = (page, name) => page.screenshot({ path: path.join(OUTPUT, name) });

// Round tracker state: the time marker is the checked + disabled round,
// the reputation marker is the checked + enabled one.
const state = (page) => page.evaluate(() => {
    const r = [...document.querySelectorAll("input[id^='round_']")];
    return {
        time: r.filter((x) => x.checked && x.disabled).map((x) => x.id),
        rep: r.filter((x) => x.checked && !x.disabled).map((x) => x.id),
        label: document.getElementById("roundnumber").innerText.trim(),
        ls: { round: localStorage.getItem("round"), rebelrep: localStorage.getItem("rebelrep") },
    };
});
const clickRound = (page, id) => page.evaluate((id) => document.getElementById(id).click(), id);
const plus = (page) => page.evaluate(() => changeRound());
const messageBoxShown = (page) => page.evaluate(() => document.getElementById("messageBox").classList.contains("show"));
const messageTitle = (page) => page.evaluate(() => document.getElementById("messageBoxTitle").textContent.trim());
const messageBody = (page) => page.evaluate(() => document.getElementById("messageBoxBody").textContent.trim());
const closeMessageBox = async (page) => {
    if (await messageBoxShown(page)) {
        await page.waitForTimeout(400); // Bootstrap ignores hide() while the fade-in is running
        await page.click("#messageBox .btn-primary");
        await page.waitForSelector("#messageBox", { state: "hidden" });
    }
};
const row = (planet) => `[data-planet="${planet}"]`;

runTest(async ({ browser, url, check }) => {
    // ---------- Load + tabs ----------
    let page = await newPage(browser, url);
    await shot(page, "01-load.png");
    check("Page loads with no JS errors", page.errors.length === 0, page.errors.join(" | "));
    check("Bootstrap 5.3.8 loaded", (await page.evaluate(() => typeof bootstrap !== "undefined" && bootstrap.Modal.VERSION)) === "5.3.8");

    const tabs = [
        ["#list-setup-list", "#list-setup-steps"],
        ["#list-command-list", "#list-command-steps"],
        ["#list-refresh-list", "#list-refresh-steps"],
        ["#list-build-list", "#list-build-steps"],
        ["#list-remotesystems-list", "#list-remotesystems-steps"],
        ["#list-assignment-list", "#list-assigment-steps"],
    ];
    for (const [tab, pane] of tabs) {
        await page.click(tab);
        await page.waitForTimeout(250);
        check(`Tab ${tab} shows ${pane}`, await page.isVisible(pane));
    }
    const activeTabBg = await page.evaluate(() => getComputedStyle(document.querySelector(".roundselector .active")).backgroundColor);
    check("Active tab is highlighted in the primary colour", activeTabBg === "rgb(102, 5, 31)", activeTabBg);

    // ---------- D6 ----------
    await page.click("#list-command-list");
    await page.click("[data-bs-target='#opposingrebelmissions']");
    await page.waitForSelector("#opposingrebelmissions.show");
    const d6 = page.locator("#opposingrebelmissions a.d6button");
    await d6.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    const before = await page.evaluate(() => window.scrollY);
    await d6.click();
    await page.waitForSelector("#d6modal.show");
    const after = await page.evaluate(() => window.scrollY);
    const src = await page.getAttribute("#d6", "src");
    await shot(page, "02-d6.png");
    await page.waitForTimeout(400);
    check("D6 link (href='#') keeps scroll position", before > 0 && before === after, `scrollY before=${before} after=${after}`);
    check("D6 link doesn't add '#' to URL", !page.url().includes("#"), page.url());
    check("D6 shows a face image 1-6", /D6_[1-6]\.png$/.test(src), src);
    await page.click("#d6modal .btn-close");
    await page.waitForSelector("#d6modal", { state: "hidden" });

    const faces = new Set();
    let sameInstance = true;
    for (let i = 0; i < 20; i++) {
        await page.evaluate(() => document.querySelector("header .d6button").click());
        await page.waitForSelector("#d6modal.show");
        faces.add(await page.getAttribute("#d6", "src"));
        sameInstance = sameInstance && (await page.evaluate(() => {
            const inst = bootstrap.Modal.getInstance(document.getElementById("d6modal"));
            window.__firstD6 = window.__firstD6 || inst;
            return inst === window.__firstD6;
        }));
        await page.waitForTimeout(400);
        await page.click("#d6modal .btn-close");
        await page.waitForSelector("#d6modal", { state: "hidden" });
    }
    check("Header D6 rolls only valid faces", [...faces].every((f) => /D6_[1-6]\.png$/.test(f)), [...faces].map((f) => f.slice(-8)).join(","));
    check("D6 modal reuses one Bootstrap instance", sameInstance);
    check("No JS errors after dice/tabs", page.errors.length === 0, page.errors.join(" | "));
    await page.context().close();

    // ---------- Round tracker ----------
    page = await newPage(browser, url);
    let s = await state(page);
    check("Initial: time on round 1, rep on 14", s.time.join() === "round_1" && s.rep.join() === "round_14" && s.label === "1", JSON.stringify(s));

    await clickRound(page, "round_14");
    s = await state(page);
    check("Clicking the ticked rep marker keeps it ticked", s.rep.join() === "round_14", JSON.stringify(s));
    await plus(page);
    await page.waitForTimeout(400);
    s = await state(page);
    check("Advance to round 2 works", s.time.join() === "round_2" && s.label === "2" && s.ls.round === "round_2", JSON.stringify(s));
    check("No false 'within FIVE rounds' message (14-2=12)", !(await messageBoxShown(page)));

    await clickRound(page, "round_6");
    await page.waitForTimeout(400);
    s = await state(page);
    check("Moving rep to 6 unticks 14 and saves", s.rep.join() === "round_6" && s.ls.rebelrep === "round_6", JSON.stringify(s));
    check("'Within FIVE rounds' message shown when rep - time ≤ 5", (await messageBoxShown(page)) && (await messageTitle(page)) === "Crossing The Finish Line");
    await shot(page, "03-within5.png");
    await closeMessageBox(page);

    for (let i = 0; i < 3; i++) { await plus(page); await page.waitForTimeout(150); await closeMessageBox(page); }
    s = await state(page);
    check("Advance to round 5", s.time.join() === "round_5" && s.label === "5", JSON.stringify(s));
    await plus(page);
    await page.waitForSelector("#messageBox.show");
    s = await state(page);
    check("Time reaching rep shows 'Rebels Win!' in the message box", (await messageTitle(page)) === "Rebels Win!", await messageTitle(page));
    await shot(page, "03-rebels-win.png");
    check("Time marker stays visible after the win", s.time.join() === "round_5" && s.rep.join() === "round_6" && s.label === "5", JSON.stringify(s));
    await closeMessageBox(page);
    await plus(page);
    await page.waitForSelector("#messageBox.show");
    s = await state(page);
    check("Pressing + after the win repeats the message and changes nothing",
        (await messageTitle(page)) === "Rebels Win!" && s.time.join() === "round_5" && s.rep.join() === "round_6", JSON.stringify(s));
    await closeMessageBox(page);

    await page.reload({ waitUntil: "networkidle" });
    s = await state(page);
    check("Round + rep restored after reload", s.time.join() === "round_5" && s.rep.join() === "round_6" && s.label === "5", JSON.stringify(s));
    check("Past rounds stay disabled after reload", await page.evaluate(() => [1, 2, 3, 4].every((n) => document.getElementById("round_" + n).disabled)));
    check("No browser alert() used by the round tracker", page.dialogs.length === 0, JSON.stringify(page.dialogs));
    check("No JS errors in round tracker", page.errors.length === 0, page.errors.join(" | "));

    // Round tracker panel itself
    await page.evaluate(() => document.getElementById("reset") && localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.click("button[data-bs-target='#roundtracker']");
    await page.waitForSelector("#roundtracker.show");
    await page.waitForTimeout(400);
    const rtWidth = await page.evaluate(() => document.getElementById("roundtracker").getBoundingClientRect().width);
    check("Round tracker panel opens, 120px wide", Math.round(rtWidth) === 120, `width=${rtWidth}`);
    await shot(page, "03-roundtracker.png");
    await page.click("label[for='round_10']");
    s = await state(page);
    check("Clicking a round label in the panel sets reputation", s.rep.join() === "round_10", JSON.stringify(s));
    await page.click("#roundtracker button[onclick='changeRound()']");
    s = await state(page);
    check("+ button in the panel advances the round", s.time.join() === "round_2" && s.label === "2", JSON.stringify(s));
    await page.context().close();

    // ---------- Build queue ----------
    page = await newPage(browser, url);
    await page.click("#list-build-list");
    const rowCount = await page.evaluate(() => document.querySelectorAll("#buildqueue [data-planet]").length);
    check("Build queue has 25 planet rows", rowCount === 25, `rows=${rowCount}`);
    await page.click(`${row("Kashyyyk")} [data-choice=radioempire]`);
    await page.click(`${row("Mustafar")} [data-choice=radiorebel]`);
    await page.click(`${row("Ryloth")} [data-choice=radiorebel]`);
    await page.click(`${row("Ryloth")} [data-choice=subjugate]`);
    await page.click(`${row("Utapau")} [data-choice=radioempire]`);
    await page.click(`${row("Utapau")} [data-choice=blockade]`);
    await page.click("#buildbutton button");
    await page.waitForSelector("#buildqueuelist.show");
    await page.waitForTimeout(300);
    await shot(page, "04-buildqueue.png");
    const counts = await page.evaluate(() => {
        const out = {};
        document.querySelectorAll("#buildqueuelist [id^='build-']").forEach((e) => {
            if (!e.classList.contains("d-none")) out[e.id] = e.textContent.trim();
        });
        return out;
    });
    // Coruscant: emp ground tri 1; Kashyyyk: 2x emp ground tri 1; Ryloth subjugated: emp ground tri 1 (first icon only)
    // Rebel Base: rebel space tri 1 + ground tri 1; Mustafar: rebel space tri 2 + space cir 2; Utapau blockaded: nothing
    const expected = {
        "build-emp-ground-tri-1": "4",
        "build-rebel-space-tri-1": "1",
        "build-rebel-ground-tri-1": "1",
        "build-rebel-space-tri-2": "1",
        "build-rebel-space-cir-2": "1",
    };
    const sorted = (o) => JSON.stringify(o, Object.keys(o).sort());
    check("Build queue counts are correct", sorted(counts) === sorted(expected), JSON.stringify(counts));
    await page.click("#buildqueuelist .btn-close");
    await page.waitForSelector("#buildqueuelist", { state: "hidden" });
    await page.reload({ waitUntil: "networkidle" });
    const isChecked = (planet, choice) => page.isChecked(`${row(planet)} [data-choice=${choice}]`);
    check("Build queue choices restored after reload",
        (await isChecked("Kashyyyk", "radioempire")) && (await isChecked("Mustafar", "radiorebel")) &&
        (await isChecked("Ryloth", "subjugate")) && (await isChecked("Ryloth", "radiorebel")) && (await isChecked("Utapau", "blockade")));

    // Saved as you go, without pressing Build!
    await page.click("#list-build-list");
    await page.click(`${row("Naboo")} [data-choice=radiorebel]`);
    await page.click(`${row("Utapau")} [data-choice=blockade]`); // untick
    await page.click(`${row("Kashyyyk")} [data-choice=radioneutral]`);
    await page.reload({ waitUntil: "networkidle" });
    const savedKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => localStorage.getItem(k) === "buildchk").sort());
    check("Choices saved as they change (incl. unticking / back to neutral)",
        JSON.stringify(savedKeys) === JSON.stringify(["Mustafar,radiorebel", "Naboo,radiorebel", "Ryloth,radiorebel", "Ryloth,subjugate", "Utapau,radioempire"]),
        JSON.stringify(savedKeys));

    const unlabeled = await page.evaluate(() =>
        [...document.querySelectorAll("#buildqueue [data-planet] .form-check-input")].filter((i) => !i.getAttribute("aria-label")).length);
    const sampleLabel = await page.getAttribute(`${row("Mon Calamari")} [data-choice=radiorebel]`, "aria-label");
    check("Build queue inputs have accessible names", unlabeled === 0 && sampleLabel === "Mon Calamari: Rebel-Loyal", `unlabeled=${unlabeled} sample=${sampleLabel}`);
    check("No JS errors in build queue", page.errors.length === 0, page.errors.join(" | "));

    // ---------- Remote systems ----------
    await page.click("#list-remotesystems-list");
    for (const p of ["dagobah", "dantooine", "dathomir", "endor", "hoth", "ilum", "tatooine"]) {
        await page.click(`label[for='planet-check-${p}']`);
    }
    await page.waitForSelector("#messageBox.show");
    await shot(page, "05-remotesystems.png");
    check("7 probed: message box names the base (Yavin)",
        (await messageTitle(page)) === "Rebel Base Located" && (await messageBody(page)) === "The Rebel Base is on Yavin!", await messageBody(page));
    check("Scanned counter shows 7", (await page.innerText("#numselectedsystems")).trim() === "7");
    await closeMessageBox(page);
    await page.click("label[for='planet-check-hoth']");
    check("Unticking a system drops the count to 6", (await page.innerText("#numselectedsystems")).trim() === "6");
    await page.reload({ waitUntil: "networkidle" });
    check("Scanned count restored after reload", (await page.innerText("#numselectedsystems")).trim() === "6");
    check("No browser alert() used by remote systems", page.dialogs.length === 0, JSON.stringify(page.dialogs));

    // ---------- Settings switches ----------
    const ids = ["chkROTE-Units", "chkROTE-TacticCards", "chkvar-Movement", "chkvar-Deployment", "chkvar-UnPlayableMissions", "chkvar-ActionCardExecution"];
    const variantState = () => page.evaluate((ids) => {
        const sections = {
            "chkROTE-Units": ["ROTE-Setup", "Base-Setup"], "chkROTE-TacticCards": ["ROTE-Battles", "Base-Battles"],
            "chkvar-Movement": ["var-movement", "Base-movement"], "chkvar-Deployment": ["var-Empiredeploy", "Base-Empiredeploy"],
            "chkvar-UnPlayableMissions": ["var-Unplayablemissions", "Base-Unplayablemissions"],
            "chkvar-ActionCardExecution": ["var-ActionCardExecution", "Base-ActionCardExecution"],
        };
        const shown = (cls) => [...document.querySelectorAll("." + cls)].map((e) => !e.classList.contains("d-none"));
        return ids.map((id) => {
            const on = document.getElementById(id).checked;
            const v = shown(sections[id][0]), b = shown(sections[id][1]);
            return { id, on, ok: v.length > 0 && b.length > 0 && v.every((x) => x === on) && b.every((x) => x === !on) };
        });
    }, ids);
    await page.click("button[data-bs-target='#options']");
    await page.waitForSelector("#options.show");
    check("Dynamic Rules switch hidden", !(await page.isVisible("#chkdynamicInstructions")));
    for (let i = 0; i < 3; i++) for (const id of ids) await page.click("#" + id); // ends ON
    await page.click("#chkvar-Deployment"); // OFF
    await shot(page, "06-settings.png");
    let vs = await variantState();
    check("All 6 switches match their rule text after rapid toggling", vs.every((x) => x.ok) && vs.filter((x) => x.on).length === 5, JSON.stringify(vs.filter((x) => !x.ok)));
    await page.reload({ waitUntil: "networkidle" });
    vs = await variantState();
    check("Switch states + rule text restored after reload", vs.every((x) => x.ok) && vs.filter((x) => x.on).length === 5, JSON.stringify(vs.filter((x) => !x.ok)));

    // ---------- Reset ----------
    await page.click("#reset");
    await page.waitForSelector("#yesNo.show");
    await page.waitForTimeout(400);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.click("#yesNo .btn-primary")]);
    s = await state(page);
    check("Reset clears game state", s.time.join() === "round_1" && s.rep.join() === "round_14" && (await page.innerText("#numselectedsystems")).trim() === "0", JSON.stringify(s));
    check("Reset clears build queue choices", (await isChecked("Naboo", "radioneutral")) && !(await isChecked("Ryloth", "subjugate")));
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    vs = await variantState();
    check("Reset keeps variant settings", keys.every((k) => k.startsWith("chk")) && keys.length === 6 && vs.filter((x) => x.on).length === 5 && vs.every((x) => x.ok), `keys=${JSON.stringify(keys)}`);
    check("No JS errors in settings/reset", page.errors.length === 0, page.errors.join(" | "));
    await page.context().close();

    // ---------- Page structure, modals, footer ----------
    page = await newPage(browser, url);
    const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll("[id]").forEach((e) => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.entries(seen).filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
    });
    check("No duplicate ids on the page", dupes.length === 0, dupes.join(", "));
    const badIds = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id).filter((id) => /\s/.test(id)));
    check("No ids containing spaces", badIds.length === 0, badIds.join(", "));
    const brokenRefs = await page.evaluate(() =>
        [...document.querySelectorAll("[aria-labelledby]")].map((e) => e.getAttribute("aria-labelledby")).filter((id) => !document.getElementById(id)));
    check("Every aria-labelledby points at a real element", brokenRefs.length === 0, brokenRefs.join(", "));
    const tooltips = await page.evaluate(() => {
        const all = [...document.querySelectorAll('[data-bs-toggle="tooltip"]')];
        return { all: all.length, ready: all.filter((e) => bootstrap.Tooltip.getInstance(e)).length };
    });
    check("Every tooltip initialised", tooltips.all > 0 && tooltips.ready === tooltips.all, JSON.stringify(tooltips));
    const text = await page.evaluate(() => document.documentElement.outerHTML);
    const typos = ["Assigmnent", "Base ist", "or active systems", "that their remain"].filter((t) => text.includes(t));
    check("Known typos are fixed", typos.length === 0, typos.join(", "));

    await page.click("#list-setup-list");
    await page.click("[data-bs-target='.advancedsetup']");
    await page.waitForTimeout(600);
    check("Advanced Set-up opens all 11 sections",
        (await page.evaluate(() => document.querySelectorAll(".advancedsetup.show").length)) === 11);
    await page.click("[data-bs-target='.advancedsetup']");
    await page.waitForTimeout(600);
    check("…and closes them again", (await page.evaluate(() => document.querySelectorAll(".advancedsetup.show").length)) === 0);

    await page.evaluate(() => getModal("strengthguide").show());
    await page.waitForSelector("#strengthguide.show");
    await page.waitForTimeout(400);
    const bbox = await page.evaluate(() => {
        const b = document.querySelector("#strengthguide .bi-patch-minus-fill path").getBBox();
        return { w: Math.round(b.width), h: Math.round(b.height) };
    });
    check("Strength Guide 4-strength icon renders", bbox.w > 10 && bbox.h > 10, JSON.stringify(bbox));
    await page.click("#strengthguide .btn-close");
    await page.waitForSelector("#strengthguide", { state: "hidden" });

    page.errors.length = 0;
    await page.click("button[data-bs-target='#options']");
    await page.waitForSelector("#options.show");
    await page.evaluate(() => getModal("strengthguide").show());
    await page.waitForSelector("#strengthguide.show");
    await page.waitForTimeout(500);
    check("Modal over the Settings panel doesn't crash", !page.errors.some((e) => /call stack/i.test(e)), page.errors.join(" | "));
    await page.context().close();

    // Footer: sits after the content, not pinned over it
    for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
        page = await newPage(browser, url, { viewport });
        const footer = async () => page.evaluate(() => {
            const f = document.getElementById("footer").getBoundingClientRect();
            return { top: Math.round(f.top), bottom: Math.round(f.bottom), position: getComputedStyle(document.getElementById("footer")).position,
                     viewport: innerHeight, page: document.documentElement.scrollHeight,
                     clipped: document.getElementById("footer").scrollHeight > document.getElementById("footer").clientHeight + 1 };
        });
        await page.click("#list-assignment-list"); // short page
        await page.waitForTimeout(300);
        let f = await footer();
        check(`${label}: footer is not fixed and nothing in it is cut off`, f.position !== "fixed" && !f.clipped, JSON.stringify(f));
        check(`${label}: on a short page the footer sits at the bottom of the window`, Math.abs(f.bottom - f.viewport) <= 1, JSON.stringify(f));
        await page.click("#list-command-list"); // long page
        await page.waitForTimeout(300);
        f = await footer();
        check(`${label}: on a long page the footer is below the fold, not over the content`, f.top >= f.viewport, JSON.stringify(f));
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(200);
        await shot(page, `08-footer-${label}.png`);
        await page.context().close();
    }
});
