// Where failing comparisons write their <name>.actual.png / <name>.diff.png
// debugging artifacts — one gitignored dir, never beside the committed goldens,
// so a red run can't dirty the expecteds and CI can collect the dir wholesale.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ARTIFACTS_DIR = path.join(__dirname, ".artifacts");

function artifactPath(name) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  return path.join(ARTIFACTS_DIR, name);
}

module.exports = { ARTIFACTS_DIR, artifactPath };
