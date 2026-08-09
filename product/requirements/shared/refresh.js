// The refresh lane: regenerates EVERY screen golden and the requirements-doc
// gallery together, so they cannot skew. Running it is how an intended UI
// change lands — the refreshed PNGs ride the diff for the owner to approve.
// It is NEVER how a red case gets fixed: on an unexpected mismatch the
// re-baselining procedure applies (surface actual/expected/diff, ask the
// owner, refresh only on approval).
//
//   node product/requirements/shared/refresh.js [name-filter]
"use strict";

const fs = require("node:fs");
const { loadCases, goldenPath } = require("./cases");
const { renderScreenCase } = require("./render-case");
const { closeBrowser } = require("./harness/browser");
const { buildGallery, DOC_PATH } = require("./gallery");

(async () => {
  const filter = process.argv[2] || "";
  const cases = loadCases().filter((c) => c.kind === "screen" && c.name.includes(filter));
  for (const testCase of cases) {
    const out = goldenPath(testCase);
    fs.writeFileSync(out, await renderScreenCase(testCase));
    console.log(`wrote ${out}`);
  }
  await closeBrowser();
  fs.writeFileSync(DOC_PATH, buildGallery());
  console.log(`refreshed gallery in ${DOC_PATH}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
