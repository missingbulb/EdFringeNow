import { test } from "node:test";
import assert from "node:assert/strict";

import { capOptions, listPage, LIST_PAGE_ROWS, SEARCH_FIRST_ABOVE } from "../limits.js";

const items = (n) => Array.from({ length: n }, (_, i) => i);

test("a short list draws whole", () => {
  const page = listPage(items(30));
  assert.equal(page.rows.length, 30);
  assert.equal(page.more, 0);
  assert.equal(page.searchFirst, false);
});

test("a long list with no query asks for a search instead of drawing", () => {
  const page = listPage(items(SEARCH_FIRST_ABOVE + 1));
  assert.deepEqual(page.rows, []);
  assert.equal(page.searchFirst, true);
});

test("a query draws at most a page, and each page asked for adds one", () => {
  const all = items(LIST_PAGE_ROWS * 3 + 5);
  const one = listPage(all, { query: "a" });
  assert.equal(one.rows.length, LIST_PAGE_ROWS);
  assert.equal(one.more, all.length - LIST_PAGE_ROWS);
  const two = listPage(all, { query: "a", pages: 2 });
  assert.equal(two.rows.length, LIST_PAGE_ROWS * 2);
});

test("options past the cap wait unlisted, except one already chosen", () => {
  const { rows, more } = capOptions(items(300), (i) => i === 250, 30);
  assert.deepEqual(rows, [...items(30), 250]);
  assert.equal(more, 269);
  assert.deepEqual(capOptions(items(6), () => false, 30), { rows: items(6), more: 0 });
});
