import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  REFRESH_LEAD_DAYS, UPDATER, changesMoreThanStamps, festivalParam, readPlan,
  refreshEditions, reportLines, upcomingEditions, windowTerm,
} from './festival-data.mjs';
import { terms as updateTerms } from './festival-update/preconditions.mjs';
import { terms as refreshTerms } from './festival-refresh/preconditions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const declaration = (dir) => JSON.parse(readFileSync(path.join(__dirname, dir, 'task.json'), 'utf8'));

const PLAN = {
  editions: [
    { festival: 'near', edition: '2026', format: 'block', first: '2026-10-20', last: '2026-10-25', tools: ['site'], refreshTools: ['site'] },
    { festival: 'no-tickets', edition: '2026', format: 'block', first: '2026-10-03', last: '2026-10-05', tools: ['site'], refreshTools: [] },
    { festival: 'fringe', edition: '2026', format: 'edfringe-wire', first: '2026-09-30', last: '2026-10-30', tools: ['listing'], refreshTools: ['tickets'] },
    { festival: 'over', edition: '2026', format: 'block', first: '2026-09-01', last: '2026-09-05', tools: ['site'], refreshTools: ['site'] },
  ],
};
const at = (day) => new Date(`${day}T12:00:00Z`);
const ids = (editions) => editions.map((e) => e.festival);

for (const [dir, term, terms, preconditions] of [
  ['festival-update', 'festival-edition-upcoming', updateTerms, ['schedule:at-most-daily', 'festival-edition-upcoming']],
  ['festival-refresh', 'festival-in-refresh-window', refreshTerms, ['festival-in-refresh-window']],
]) {
  test(`${dir} is a scheduled agentless task whose own term resolves`, () => {
    const decl = declaration(dir);
    assert.equal(decl.id, dir);
    assert.equal(decl.trigger, 'schedule');
    assert.deepEqual(decl.preconditions, preconditions);
    assert.equal(decl.agent_model, 'none');
    assert.equal(decl.expected_outcome, 'supersede_existing_pr');
    assert.deepEqual(decl.automerge, ['under:data/festivals', 'under:site/data/festivals']);
    assert.ok(existsSync(path.join(__dirname, dir, decl.code_worker_mjs)));
    assert.ok(decl.code_work_timeout > 0 && decl.code_work_timeout < 3600);
    assert.ok(term in terms);
  });

  test(`${dir}'s term reads the committed editions plan and gives a reason`, () => {
    const verdict = terms[term].holds({}, { now: new Date() });
    assert.equal(typeof verdict.holds, 'boolean', JSON.stringify(verdict));
    assert.ok(verdict.reason);
  });
}

test('the refresh reads only block editions with an availability tool, three weeks out to the last day', () => {
  assert.deepEqual(ids(refreshEditions(PLAN, at('2026-09-28'))), []);
  assert.deepEqual(ids(refreshEditions(PLAN, at('2026-09-29'))), ['near']);
  assert.deepEqual(ids(refreshEditions(PLAN, at('2026-10-25'))), ['near']);
  assert.deepEqual(ids(refreshEditions(PLAN, at('2026-10-26'))), []);
});

test('the update reads every block edition not yet over', () => {
  assert.deepEqual(ids(upcomingEditions(PLAN, at('2026-10-04'))), ['near', 'no-tickets']);
  assert.deepEqual(ids(upcomingEditions(PLAN, at('2026-10-26'))), []);
});

test('a window term declines with no edition, and errs rather than declines on an unreadable plan', () => {
  const term = windowTerm(refreshEditions, { yes: 'y', no: 'n' }, () => PLAN);
  assert.deepEqual(term.holds({}, { now: at('2026-10-01') }), { holds: true, reason: 'y: near 2026' });
  assert.deepEqual(term.holds({}, { now: at('2026-12-01') }), { holds: false, reason: 'n' });
  const broken = windowTerm(refreshEditions, { yes: 'y', no: 'n' }, () => { throw new Error('gone'); });
  assert.match(broken.holds({}, { now: at('2026-10-01') }).error, /gone/);
});

test('the refresh lead matches the updater', () => {
  const python = readFileSync(path.join(REPO_ROOT, UPDATER), 'utf8');
  assert.equal(Number(/^REFRESH_LEAD_DAYS = (\d+)$/m.exec(python)?.[1]), REFRESH_LEAD_DAYS);
});

test('the committed plan lists every edition with its tool set', () => {
  const plan = readPlan(REPO_ROOT);
  assert.ok(plan.editions.length > 0);
  for (const e of plan.editions) assert.ok(e.tools.length, `${e.festival} ${e.edition} names no tools`);
});

test('a change of fetch time alone is not a change', () => {
  const before = JSON.stringify({ fetchedAt: '2026-10-01T00:00:00Z', provenance: { sources: { a: { fetchedAt: 'x', path: 'p' } } }, n: 1 });
  const stampsOnly = JSON.stringify({ fetchedAt: '2026-10-02T00:00:00Z', provenance: { sources: { a: { fetchedAt: 'y', path: 'p' } } }, n: 1 });
  const moved = JSON.stringify({ fetchedAt: '2026-10-02T00:00:00Z', provenance: { sources: { a: { fetchedAt: 'y', path: 'p' } } }, n: 2 });
  assert.equal(changesMoreThanStamps(before, stampsOnly), false);
  assert.equal(changesMoreThanStamps(before, moved), true);
  assert.equal(changesMoreThanStamps(null, stampsOnly), true, 'a new file is a change');
});

test('the festival parameter comes from the Context bullet', () => {
  assert.equal(festivalParam('- festival: abu-gosh\n- other: x'), 'abu-gosh');
  assert.equal(festivalParam('festival=micf'), 'micf');
  assert.equal(festivalParam(''), null);
  assert.equal(festivalParam(undefined), null);
});

test('the report lists broken editions first, with what failed', () => {
  const lines = reportLines({ editions: [
    { festival: 'a', edition: '2026', status: 'updated', problems: [] },
    { festival: 'b', edition: '2026', status: 'broken', problems: [{ step: 'site', notReady: false, detail: 'ValueError' }] },
    { festival: 'c', edition: '2027', status: 'not-ready', problems: [{ step: 'api', notReady: true, detail: 'no fetcher yet' }] },
  ] });
  assert.deepEqual(lines, [
    '- **broken** b 2026 — site: ValueError',
    '- **not-ready** c 2027 — api (nothing to fetch yet): no fetcher yet',
    '- **updated** a 2026',
  ]);
});
