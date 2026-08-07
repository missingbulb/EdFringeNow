// Shape tests for this pack's scheduled-task declarations.
//
// The Claudinite scheduler reads frequency / agent_model / expected_outcome from
// task.mjs — never from anywhere else — so a typo'd enum or a missing field means
// a task silently never fires. The canon's own `task-declaration-shape` check
// asserts that statically at author time; this asserts it by IMPORTING each
// declaration, which additionally parse-checks the module and its worker wiring.
// The contract's legal values are restated here as literals rather than imported
// from the mount, so this file never couples to the vendored canon.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import refreshShows from "./refresh-shows/task.mjs";
import refreshTickets from "./refresh-tickets/task.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FREQUENCIES = ["hourly", "daily-2h", "daily-1h", "daily", "daily+1h", "weekly", "monthly"];
const MODELS = ["opus", "sonnet", "haiku", "none"];
const OUTCOMES = ["none", "open-pr", "merged-pr"];

const DECLARED = [
  ["refresh-shows", refreshShows, "daily"],
  ["refresh-tickets", refreshTickets, "hourly"],
];

for (const [dir, decl, frequency] of DECLARED) {
  test(`${dir} declares the full task contract`, () => {
    assert.equal(decl.id, dir, "the id must match the task's directory name");
    assert.equal(decl.frequency, frequency);
    assert.ok(FREQUENCIES.includes(decl.frequency), `illegal frequency ${decl.frequency}`);
    assert.ok(MODELS.includes(decl.agent_model), `illegal agent_model ${decl.agent_model}`);
    assert.ok(OUTCOMES.includes(decl.expected_outcome), `illegal expected_outcome ${decl.expected_outcome}`);
    assert.ok(Array.isArray(decl.precondition_signals));
    assert.equal(typeof decl.agent_instructions, "string");
    assert.equal(typeof decl.precondition, "function");
  });

  test(`${dir} is agentless and its worker exists`, () => {
    // Both of these tasks are deterministic ports of retired workflows: no agent,
    // so the contract requires the work to be a bounded preprocessing subprocess.
    assert.equal(decl.agent_model, "none");
    assert.equal(decl.prework, "bash worker.sh");
    assert.ok(Number.isInteger(decl.prework_timeout) && decl.prework_timeout > 0);
    assert.ok(existsSync(path.join(__dirname, dir, "worker.sh")), "the declared worker must exist beside task.mjs");
  });

  test(`${dir}'s precondition returns a verdict with a reason`, () => {
    const verdict = decl.precondition({}, {});
    assert.equal(typeof verdict.run, "boolean");
    assert.ok(verdict.reason.length > 0, "every verdict explains itself — it lands in the scheduler's job summary");
  });
}

test("refresh-shows runs unconditionally, as its retired daily cron did", () => {
  assert.equal(refreshShows.precondition({}, {}).run, true);
});
