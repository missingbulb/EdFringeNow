// Shape tests for this pack's scheduled-task declarations.
//
// The Claudinite scheduler reads frequency / agent_model / expected_outcome from
// task.json — never from anywhere else — so a typo'd enum or a missing field means
// a task silently never fires. The canon's own `task-declaration-shape` check
// asserts that statically at author time; this asserts it by LOADING each
// declaration, which additionally parse-checks the JSON and its worker wiring.
// The contract's legal values are restated here as literals rather than imported
// from the mount, so this file never couples to the vendored canon.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { terms as ticketTerms } from "./refresh-tickets/preconditions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readDeclaration = (dir) => JSON.parse(readFileSync(path.join(__dirname, dir, "task.json"), "utf8"));
const refreshShows = readDeclaration("refresh-shows");
const refreshTickets = readDeclaration("refresh-tickets");

const FREQUENCIES = ["daily", "weekly", "monthly", "manual"];
const MODELS = ["opus", "sonnet", "haiku", "none"];
const OUTCOMES = ["none", "open-pr", "merged-pr"];

// Both scraping tasks are OFF, and `manual` is what carries that: a manual task
// has no occurrence for the scheduler to instantiate. Pinned here so turning one
// back on is a deliberate edit to this file rather than a token nobody re-reads.
// The declarative precondition is the ONLY gate mechanism — the `precondition`
// function form and its `precondition_signals` companion are retired
// (missingbulb/Claudinite#1617), so both are asserted ABSENT rather than present.
const DECLARED = [
  ["refresh-shows", refreshShows, "manual", ["none"], {}],
  ["refresh-tickets", refreshTickets, "manual", ["in-festival"], ticketTerms],
];

for (const [dir, decl, frequency, preconditions, terms] of DECLARED) {
  test(`${dir} declares the full task contract`, () => {
    assert.equal(decl.id, dir, "the id must match the task's directory name");
    assert.equal(decl.frequency, frequency);
    assert.ok(FREQUENCIES.includes(decl.frequency), `illegal frequency ${decl.frequency}`);
    assert.ok(MODELS.includes(decl.agent_model), `illegal agent_model ${decl.agent_model}`);
    assert.ok(OUTCOMES.includes(decl.expected_outcome), `illegal expected_outcome ${decl.expected_outcome}`);
    assert.deepEqual(decl.preconditions, preconditions);
    assert.equal(typeof decl.agent_instructions, "string");
    // The retired form, asserted gone: a declaration carrying both is a contract
    // violation, and one carrying only the function stops running the moment the
    // mount drops support for it.
    assert.equal(decl.precondition, undefined);
    assert.equal(decl.precondition_signals, undefined);
    // Every named condition resolves — a built-in, or one this task's own
    // preconditions.mjs exports. An unknown term is a run failure, not a decline.
    for (const name of decl.preconditions) {
      assert.ok(name === "none" || name in terms, `${dir} names the unresolvable condition "${name}"`);
    }
  });

  test(`${dir} is agentless and its worker exists`, () => {
    // Both of these tasks are deterministic ports of retired workflows: no agent,
    // so the contract requires the work to be a bounded code-work subprocess.
    assert.equal(decl.agent_model, "none");
    assert.equal(decl.code_work, "bash worker.sh");
    assert.ok(Number.isInteger(decl.code_work_timeout) && decl.code_work_timeout > 0);
    assert.ok(existsSync(path.join(__dirname, dir, "worker.sh")), "the declared worker must exist beside task.json");
  });

  test(`${dir}'s own terms each return a verdict with a reason`, () => {
    for (const [name, term] of Object.entries(terms)) {
      const verdict = term.holds({}, { now: new Date("2026-08-15T11:49:00Z") });
      assert.equal(typeof verdict.holds, "boolean", `${name} answered no verdict`);
      assert.ok(verdict.reason.length > 0, "every verdict explains itself — it lands in the scheduler's job summary");
    }
  });
}

// `none` IS "run whenever it is pulled": the empty precondition, whose trigger is
// the calendar or the work item somebody filed.
test("refresh-shows states no condition, so a pulled run always proceeds", () => {
  assert.deepEqual(refreshShows.preconditions, ["none"]);
});

// The clock reaches the term from the ENGINE rather than the process, which is
// what makes the festival gate assertable at a chosen instant at all.
test("the in-festival term answers about the instant it is handed", () => {
  const at = (iso) => ticketTerms["in-festival"].holds({}, { now: new Date(iso) });
  assert.equal(at("2026-08-15T11:49:00Z").holds, true);
  assert.equal(at("2026-07-31T22:49:00Z").holds, false); // 23:49 BST on 31 July
  assert.equal(at("2026-07-31T23:49:00Z").holds, true);  // 00:49 BST on 1 August
  assert.ok(at("2026-09-15T11:49:00Z").reason.includes("outside the festival"));
});
