// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.
//
// Why this lives in the data pack: the one procedure in this repo that
// legitimately creates a push-triggered workflow on a session branch is the
// `probe-edfringe-api` skill — the live API is unreachable from a session, so a
// throwaway workflow is pushed to a branch purely to run a probe on a GitHub
// runner and read its job log. That skill's last step is "delete the probe
// script and its workflow before opening the PR", and this check is what makes
// that step a gate instead of a good intention. Left behind, the workflow keeps
// firing on every push to the branch, re-hitting a rate-limited external site
// from a datacentre IP long after the answer it fetched was written down.
//
// Why a scoped YAML walk rather than a grep: `branches:` is a `pull_request:`
// filter as often as a `push:` one, `push` appears in every `git push` line of
// every `run:` step, and the repo's real workflows carry both. The rule is only
// ever about the branch filter on the `on:` block's OWN `push:` trigger, so the
// check descends exactly that path — on: → push: → branches: — and reads
// nothing else in the file. Where the shape is one this walk cannot read with
// confidence (a flow mapping), it reports nothing rather than guessing.

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;

// A push trigger pinned to the default branch is the normal CI shape (ci.yml,
// pages.yml both use it); branch coverage belongs on `pull_request:` instead.
const DEFAULT_BRANCHES = new Set(['main', 'master']);

const indentOf = (l) => l.length - l.trimStart().length;
const isStructural = (l) => l.trim() !== '' && !/^\s*#/.test(l);
const unquote = (s) => s.replace(/^['"]|['"]$/g, '');
const stripComment = (s) => s.replace(/\s+#.*$/, '').trim();

/** The lines strictly more indented than `indent`, i.e. one YAML key's own block. */
function childLines(lines, from, indent) {
  const out = [];
  for (let i = from; i < lines.length; i++) {
    if (!isStructural(lines[i])) continue;
    if (indentOf(lines[i]) <= indent) break;
    out.push(lines[i]);
  }
  return out;
}

/**
 * Look up `name` among the keys at the TOP level of `lines` — never a deeper
 * one, so a nested key can never stand in for the one the rule means.
 * Returns the key's inline value, its child block, and its 1-based line.
 */
function keyIn(lines, name) {
  const structural = lines.filter(isStructural);
  if (structural.length === 0) return null;
  const top = Math.min(...structural.map(indentOf));
  const re = new RegExp(`^\\s*(?:${name}|"${name}"|'${name}')\\s*:(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    if (!isStructural(lines[i]) || indentOf(lines[i]) !== top) continue;
    const m = re.exec(lines[i]);
    if (!m) continue;
    return { inline: stripComment(m[1]), children: childLines(lines, i + 1, top), line: i + 1 };
  }
  return null;
}

/** A YAML sequence in either style: `[a, b]` inline, or `- a` lines beneath. */
function listValues(node) {
  if (!node) return null;
  if (node.inline.startsWith('[')) {
    return node.inline.replace(/^\[/, '').replace(/\]$/, '')
      .split(',').map((s) => unquote(s.trim())).filter(Boolean);
  }
  const items = [];
  for (const l of node.children) {
    const m = /^\s*-\s*(.+)$/.exec(l);
    if (m) items.push(unquote(stripComment(m[1])));
  }
  return items;
}

/** The `push:` trigger of a workflow's `on:` block, or null if it has none. */
function pushTrigger(lines) {
  const on = keyIn(lines, 'on');
  // No readable `on:` block, or a flow mapping (`on: {push: {...}}`) this walk
  // does not parse — say nothing rather than guess.
  if (!on || on.inline.startsWith('{')) return null;

  if (on.inline) {
    // `on: push` / `on: [push, pull_request]` — a bare trigger name carries no filter.
    const triggers = on.inline.startsWith('[') ? listValues(on) : [unquote(on.inline)];
    return triggers.includes('push') ? { inline: '', children: [], line: on.line } : null;
  }

  const push = keyIn(on.children, 'push');
  if (!push || push.inline.startsWith('{')) return null;
  return push;
}

const rule = {
  id: 'edfringe-no-branch-push-workflow',
  severity: 'blocking',
  description:
    'no .github/workflows/ workflow triggers on pushes to a branch other than the default one',
  why:
    'a push trigger that is not pinned to the default branch fires on every push to every session branch for as long as the file sits in the tree — the shape a throwaway probe workflow has, and the reason the probe procedure ends by deleting it: left behind it keeps burning runner minutes and re-hitting the rate-limited edfringe API from a datacentre IP, with nobody watching the runs',
  doc: '.claudinite/local/packs/edfringe-data/skills/probe-edfringe-api/SKILL.md',

  run(ctx) {
    const out = [];
    for (const file of ctx.files.filter((f) => WORKFLOW.test(f)).sort()) {
      const raw = ctx.read(file);
      if (raw === null) continue; // relevance-first: unreadable file, nothing to judge

      const push = pushTrigger(raw.split('\n'));
      if (!push) continue; // no push trigger at all — not this rule's business

      const branchesIgnore = keyIn(push.children, 'branches-ignore');
      const branches = keyIn(push.children, 'branches');

      if (branchesIgnore) {
        const ignored = listValues(branchesIgnore);
        out.push(finding(file, push.line,
          `its \`push:\` trigger uses \`branches-ignore\`${ignored.length ? ` (${ignored.join(', ')})` : ''}, so it fires on a push to every OTHER branch`));
        continue;
      }

      if (!branches) {
        // A tags-only push trigger never fires on a branch push at all — that is
        // a release workflow, not a live wire.
        if (keyIn(push.children, 'tags') || keyIn(push.children, 'tags-ignore')) continue;
        out.push(finding(file, push.line,
          'its `push:` trigger has no `branches:` filter, so it fires on a push to every branch'));
        continue;
      }

      const stray = listValues(branches).filter((b) => !DEFAULT_BRANCHES.has(b));
      if (stray.length === 0) continue;
      out.push(finding(file, branches.line,
        `its \`push:\` trigger fires on ${stray.map((b) => `\`${b}\``).join(', ')}, not just the default branch`));
    }
    return out;
  },
};

function finding(file, line, what) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file,
    line,
    what: `${file}: ${what}`,
    why: rule.why,
    fix: 'if this is throwaway probe scaffolding, delete the workflow together with the script it runs — that is the last step of the probe-edfringe-api procedure, and the answer belongs in scraper/SCRAPING.md instead. If it is a real workflow, pin it to `push:` / `branches: [main]` and add `pull_request:` to cover work on branches, the way .github/workflows/ci.yml does.',
    doc: rule.doc,
  };
}

export default rule;
