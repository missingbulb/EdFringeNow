// The requirement CASES, loaded across every kind. Each case is a per-leaf
// module `<slug>.<leaf-id>.case.js` under `<kind>/cases/`: <slug> is the spec
// section's stable feature name, <leaf-id> the dotted requirement number the
// case pins. The FILENAME names the one leaf (the coverage gate reads the
// trailing id); the KIND is the folder (kinds.js). A case supplies fake-world
// setup plus a drive/verify function fed to its kind's runner — nothing else.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { KINDS } = require("./kinds");

// The leaf id a case name pins: the trailing dotted-number run, or null for a
// malformed name (the coverage gate flags it).
function leafIdOf(name) {
  const m = /(\d+(?:\.\d+)+)$/.exec(name);
  return m ? m[1] : null;
}

function loadCases() {
  const cases = [];
  for (const kind of KINDS) {
    if (!fs.existsSync(kind.casesDir)) continue;
    for (const f of fs.readdirSync(kind.casesDir).filter((n) => n.endsWith(".case.js")).sort()) {
      const name = f.replace(/\.case\.js$/, "");
      const mod = require(path.join(kind.casesDir, f));
      cases.push({ ...mod, name, kind: kind.name, dir: kind.casesDir, image: kind.image });
    }
  }
  return cases.sort((a, b) => a.name.localeCompare(b.name));
}

// Absolute path of a case's committed golden PNG (image kinds only).
function goldenPath(testCase) {
  return path.join(testCase.dir, `${testCase.name}.png`);
}

module.exports = { loadCases, leafIdOf, goldenPath };
