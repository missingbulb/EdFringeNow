import test from "node:test";
import assert from "node:assert/strict";

import { showUrl } from "../edfringe.js";

test("builds the canonical show page URL from a slug", () => {
  assert.equal(
    showUrl("exhibition-craigmillar-tapestry"),
    "https://www.edfringe.com/tickets/whats-on/exhibition-craigmillar-tapestry"
  );
});

test("percent-encodes anything unusual in the slug", () => {
  assert.equal(
    showUrl("a show?x=1"),
    "https://www.edfringe.com/tickets/whats-on/a%20show%3Fx%3D1"
  );
});

test("a missing slug yields no link at all, not a link to the listing", () => {
  for (const slug of ["", undefined, null]) {
    assert.equal(showUrl(slug), "");
  }
});
