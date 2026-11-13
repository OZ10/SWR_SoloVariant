// Runs every *.test.js file in this folder one after another; fails if any fail.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort();
const failed = [];
for (const file of files) {
    console.log(`\n=== ${file} ===\n`);
    const { status } = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: "inherit" });
    if (status !== 0) failed.push(file);
}
console.log(failed.length ? `\n${failed.length} test file(s) failed: ${failed.join(", ")}` : `\nAll ${files.length} test files passed`);
process.exit(failed.length ? 1 : 0);
