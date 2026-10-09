// What the festival-update and festival-refresh tasks share: their window terms,
// read off the editions plan the festival registry writes, and the one worker
// that runs the festival updater and delivers what it changed.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
export const PLAN_PATH = 'scraper/festivals/editions.GENERATED.json';
export const UPDATER = 'scraper/festivals/update.py';
// The trees the updater writes: raw, then serving.
export const DATA_TREES = ['data/festivals/', 'site/data/festivals/'];

// Kept equal to the updater's REFRESH_LEAD_DAYS by festival-data.test.mjs.
export const REFRESH_LEAD_DAYS = 21;

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDay = (now) => new Date(now).toISOString().slice(0, 10);
const shift = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const served = (plan) => (plan?.editions ?? []).filter((e) => e.format === 'block');

// Editions an update could still change: not over on `now`'s UTC day.
export function upcomingEditions(plan, now) {
  const today = utcDay(now);
  return served(plan).filter((e) => e.last >= today);
}

// Editions a rapid refresh works on: they carry an availability tool, and `now`
// falls between REFRESH_LEAD_DAYS before they open and the day they close.
export function refreshEditions(plan, now) {
  const today = utcDay(now);
  return served(plan).filter((e) => e.refreshTools.length
    && shift(e.first, -REFRESH_LEAD_DAYS) <= today && today <= e.last);
}

const names = (editions) => editions.map((e) => `${e.festival} ${e.edition}`).join(', ');

export function readPlan(root = REPO_ROOT) {
  return JSON.parse(readFileSync(path.join(root, PLAN_PATH), 'utf8'));
}

// A term that holds while `select(plan, now)` is non-empty. An unreadable plan is
// an error, never a decline: a silent "no festival is near" would stop the task
// with nothing going red.
export function windowTerm(select, { yes, no }, load = readPlan) {
  return {
    signals: [],
    holds(_signals, { now }) {
      let plan;
      try { plan = load(); } catch (error) { return { error: `cannot read ${PLAN_PATH}: ${error.message}` }; }
      const editions = select(plan, now);
      return editions.length
        ? { holds: true, reason: `${yes}: ${names(editions)}` }
        : { holds: false, reason: no };
    },
  };
}

// A JSON value with every `fetchedAt` key removed: what a re-fetch that found
// nothing new still changes.
export function withoutFetchStamps(value) {
  if (Array.isArray(value)) return value.map(withoutFetchStamps);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== 'fetchedAt')
      .map(([key, v]) => [key, withoutFetchStamps(v)]));
  }
  return value;
}

// Does `after` say anything `before` (null: a new file) did not, beyond when it
// was fetched?
export function changesMoreThanStamps(before, after) {
  if (before === null) return true;
  try {
    return JSON.stringify(withoutFetchStamps(JSON.parse(before))) !== JSON.stringify(withoutFetchStamps(JSON.parse(after)));
  } catch {
    return before !== after;
  }
}

// The report as pull-request lines, broken editions first.
export function reportLines(report) {
  const order = { broken: 0, 'not-ready': 1, updated: 2 };
  return [...report.editions]
    .sort((a, b) => order[a.status] - order[b.status])
    .map((o) => {
      const problems = o.problems.map((p) => `${p.step}${p.notReady ? ' (nothing to fetch yet)' : ''}: ${p.detail}`);
      return `- **${o.status}** ${o.festival} ${o.edition}${problems.length ? ` — ${problems.join('; ')}` : ''}`;
    });
}

// The one operator parameter: `festival: <id>` runs that festival whatever its cadence.
export function festivalParam(context) {
  return /^\s*-?\s*festival\s*[:=]\s*([a-z0-9-]+)\s*$/m.exec(context ?? '')?.[1] ?? null;
}

const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

function changedFiles(root) {
  const out = git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...DATA_TREES]);
  return out.split('\n').filter(Boolean).map((line) => ({ status: line.slice(0, 2), file: line.slice(3) }));
}

// The worker both tasks run. `mode` is 'update' or 'refresh'. `stampsCount` says
// whether a change of fetch time alone is delivered: the update's cadence reads
// the manifests' fetchedAt, so it needs them; the refresh does not.
export async function runFestivalData({ mode, stampsCount, root, defaultBranch, context, deliver, log }) {
  git(root, ['fetch', '-q', 'origin', defaultBranch]);
  git(root, ['checkout', '-q', defaultBranch]);
  git(root, ['merge', '-q', '--ff-only', `origin/${defaultBranch}`]);

  const festival = festivalParam(context);
  const reportPath = path.join(mkdtempSync(path.join(tmpdir(), 'festival-data-')), 'report.json');
  const argv = [UPDATER, '--report', reportPath];
  if (mode === 'refresh') argv.push('--refresh');
  if (festival) argv.push('--festival', festival);
  let exitCode = 0;
  try {
    execFileSync('python3', argv, { cwd: root, stdio: 'inherit' });
  } catch (error) {
    if (typeof error.status !== 'number') throw error;
    exitCode = error.status;
  }
  if (!existsSync(reportPath)) throw new Error(`${UPDATER} exited ${exitCode} without a report`);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));

  const changed = changedFiles(root);
  const deleted = changed.filter((c) => c.status.includes('D')).map((c) => c.file);
  if (deleted.length) throw new Error(`${UPDATER} removed files, which this delivery cannot carry: ${deleted.join(', ')}`);
  const files = {};
  let substantive = false;
  for (const { status, file } of changed) {
    const after = readFileSync(path.join(root, file), 'utf8');
    const before = status === '??' ? null : git(root, ['show', `HEAD:${file}`]);
    files[file] = after;
    if (stampsCount || changesMoreThanStamps(before, after)) substantive = true;
  }
  const added = changed.filter((c) => c.status === '??').map((c) => c.file);

  if (substantive) {
    const lines = reportLines(report);
    const title = `Festival ${mode} ${report.today}`;
    const body = [
      `The festival ${mode} of ${report.today}, by \`${UPDATER}${mode === 'refresh' ? ' --refresh' : ''}\`.`,
      '',
      ...lines,
      ...(added.length
        ? ['', "New raw files, each to be named in `edfringe-data-dir-is-generator-output`'s allowlist before this can land:",
          ...added.map((f) => `- \`${f}\``)]
        : []),
    ].join('\n');
    const pr = await deliver({ files, title, body, message: `${title}\n\n${lines.join('\n')}` });
    log(`delivered ${Object.keys(files).length} file(s) on #${pr.number}`);
  } else {
    log(changed.length ? 'only fetch times moved; nothing delivered' : 'no festival data changed');
  }

  const broken = report.editions.filter((o) => o.status === 'broken');
  if (broken.length) {
    const error = new Error(`festival tools broke: ${names(broken)}`);
    error.triage = { kind: 'failure', detail: reportLines({ editions: broken }).join('\n') };
    throw error;
  }
  if (exitCode !== 0) throw new Error(`${UPDATER} exited ${exitCode}`);
}
