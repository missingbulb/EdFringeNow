"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SITE = path.join(__dirname, "..", "..", "..", "..", "site");

module.exports = {
  description: "robots.txt admits every crawler and points at the sitemap",
  async verify(assert) {
    const { ORIGIN } = await import("../../../../scripts/published-site.mjs");
    const { buildRobots } = await import("../../../../scripts/build-sitemap.mjs");

    const robots = fs.readFileSync(path.join(SITE, "robots.txt"), "utf8");
    const directives = robots
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    assert.deepEqual(
      directives,
      ["User-agent: *", "Allow: /", `Sitemap: ${ORIGIN}/sitemap.xml`],
      "every crawler, everything, and where the sitemap is"
    );

    // Nothing is disallowed on purpose: a Disallow keeps a crawler out without
    // keeping the URL out of results, so what must not be listed says so on
    // its own page instead (22.2).
    assert.ok(!/^\s*Disallow:/im.test(robots), "nothing is disallowed");

    // The file it names is the file that is served.
    const named = /^Sitemap:\s*(\S+)$/m.exec(robots)[1];
    assert.equal(new URL(named).origin, ORIGIN, "the sitemap is named on the site's own origin");
    assert.ok(
      fs.existsSync(path.join(SITE, new URL(named).pathname.replace(/^\//, ""))),
      `${named}: robots.txt names a sitemap the site does not serve`
    );

    assert.equal(
      robots,
      buildRobots(),
      "site/robots.txt is not what scripts/build-sitemap.mjs writes — run it and commit the result"
    );
  },
};
