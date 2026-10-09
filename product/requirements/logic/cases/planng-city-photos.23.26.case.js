"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SITE = path.join(__dirname, "..", "..", "..", "..", "site");

/* Read against the live registry on purpose: a festival added there is what
 * this proof exists to catch. */
module.exports = {
  description: "every festival in the live registry has a stored, credited photograph of its city",
  async verify(assert) {
    const { cityPhotoOf } = await import("../../../../site/planNG/festivals.js");
    const { festivals } = JSON.parse(fs.readFileSync(path.join(SITE, "data", "festivals", "index.json"), "utf8"));
    assert.ok(festivals.length > 0, "the registry lists festivals");
    for (const festival of festivals) {
      const photo = cityPhotoOf(festival);
      assert.ok(photo, `${festival.id} (${festival.city}) has a photograph`);
      assert.ok(fs.existsSync(path.join(SITE, photo.src)), `${festival.id}'s photograph ${photo.src} is stored with the site`);
      for (const field of ["title", "author", "licence", "licenceUrl", "source"]) {
        assert.ok(photo[field], `${festival.id}'s photograph names its ${field}`);
      }
    }
  },
};
