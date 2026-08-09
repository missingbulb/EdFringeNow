// The registry of requirement KINDS — the framework's single extension point.
// A "kind" is one way a requirement leaf can be asserted (a rendered screen, a
// driven gesture, a pure rule). Kinds are AUTO-DISCOVERED: every
// product/requirements/<kind>/ directory containing a `kind.js` descriptor is a
// kind, named for its folder. The folder IS the classifier — a case's kind is
// the directory it lives in, never a field inside the case.
//
// Adding a kind is a self-contained folder drop:
//   1. mkdir product/requirements/<kind>/cases
//   2. add product/requirements/<kind>/kind.js  ({ image: <bool> })
//   3. add the kind's runner (wired into the right test lane)
//   4. add the leaf(s) to product/requirements.md and a case under cases/
// Nothing here, in the loader, or in the coverage gate needs editing — they all
// iterate this registry.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIREMENTS_DIR = path.join(__dirname, "..");

function loadKinds() {
  return fs
    .readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(REQUIREMENTS_DIR, d.name, "kind.js")))
    .map((d) => {
      const descriptor = require(path.join(REQUIREMENTS_DIR, d.name, "kind.js"));
      return {
        name: d.name,
        // image = the kind's owner-approved expected is a committed PNG golden;
        // a non-image kind's expected is a coded assertion and its folder must
        // carry no PNG (enforced by the coverage gate).
        image: Boolean(descriptor.image),
        dir: path.join(REQUIREMENTS_DIR, d.name),
        casesDir: path.join(REQUIREMENTS_DIR, d.name, "cases"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const KINDS = loadKinds();
const KIND_NAMES = KINDS.map((k) => k.name);
const IMAGE_KINDS = KINDS.filter((k) => k.image).map((k) => k.name);

module.exports = { KINDS, KIND_NAMES, IMAGE_KINDS };
