"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SITE = path.join(__dirname, "..", "..", "..", "..", "site");

// The rows are the requirement: an old address, and where it now answers.
// verify() resolves each row through the published redirect rules, and checks
// the destination is a page the site actually serves.
const TABLE = {
  columns: ["Old address", "Moves to", "Status"],
  rows: [
    ["/planJerusalem", "/planNG/", "301"],
    ["/planJerusalem/", "/planNG/", "301"],
    ["/planJerusalem/he/", "/planNG/he/", "301"],
    ["/planJerusalem/ru/", "/planNG/ru/", "301"],
    ["/planJerusalem/ja/", "/planNG/ja/", "301"],
  ],
};

// Cloudflare's `_redirects` rules as the host applies them: first match wins,
// `*` matches the rest of the path, `:splat` puts it back.
function resolve(rules, url) {
  for (const { from, to, status } of rules) {
    if (from.endsWith("*")) {
      const prefix = from.slice(0, -1);
      if (url.startsWith(prefix)) return { to: to.replace(":splat", url.slice(prefix.length)), status };
    } else if (from === url) {
      return { to, status };
    }
  }
  return null;
}

module.exports = {
  description: "every /planJerusalem/ address, in every language, moves permanently to the same place under /planNG/",
  table: TABLE,
  async verify(assert) {
    const rules = fs
      .readFileSync(path.join(SITE, "_redirects"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [from, to, status] = line.split(/\s+/);
        return { from, to, status };
      });

    for (const [from, to, status] of TABLE.rows) {
      const hit = resolve(rules, from);
      assert.ok(hit, `${from}: no rule moves it`);
      assert.equal(hit.to, to, `${from}: where it moves`);
      assert.equal(hit.status, status, `${from}: permanently`);
      assert.ok(fs.existsSync(path.join(SITE, to, "index.html")), `${to}: is a page the site serves`);
    }
    assert.ok(!fs.existsSync(path.join(SITE, "planJerusalem")), "nothing is served at the old address itself");
  },
};
