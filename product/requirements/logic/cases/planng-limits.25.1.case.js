"use strict";

// The rows are the requirement: how many rows a list draws for how many items
// it holds, with and without a query. verify() runs each row through the
// shipped rule and its constants.
const TABLE = {
  columns: ["Items", "Query", "Pages asked for", "Rows drawn", "Held back", "Asks for a search"],
  rows: [
    ["34", "none", "1", "34", "0", "no"],
    ["100", "none", "1", "100", "0", "no"],
    ["101", "none", "1", "0", "101", "yes"],
    ["3000", "none", "1", "0", "3000", "yes"],
    ["3000", "typed", "1", "200", "2800", "no"],
    ["3000", "typed", "2", "400", "2600", "no"],
    ["150", "typed", "1", "150", "0", "no"],
  ],
};

module.exports = {
  description: "a list draws at most a page of rows, and above a threshold asks for a search first",
  table: TABLE,
  async verify(assert) {
    const { listPage, LIST_PAGE_ROWS, SEARCH_FIRST_ABOVE } = await import("../../../../site/shared/limits.js");
    assert.equal(LIST_PAGE_ROWS, 200, "a page is 200 rows");
    assert.equal(SEARCH_FIRST_ABOVE, 100, "more than 100 items asks for a search");
    for (const [items, query, pages, rows, more, searchFirst] of TABLE.rows) {
      const all = Array.from({ length: Number(items) }, (_, i) => i);
      const page = listPage(all, { query: query === "none" ? "" : "x", pages: Number(pages) });
      const row = `${items} items, query ${query}, ${pages} page(s)`;
      assert.equal(page.rows.length, Number(rows), `${row}: rows drawn`);
      assert.equal(page.more, Number(more), `${row}: held back`);
      assert.equal(page.searchFirst, searchFirst === "yes", `${row}: asks for a search`);
    }
  },
};
