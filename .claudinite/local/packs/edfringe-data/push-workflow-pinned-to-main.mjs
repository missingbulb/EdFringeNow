// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.
//
// Why this pack owns a workflow-shape rule: the shape it forbids is the one the
// `probe-edfringe-api` procedure creates on purpose. A probe adds a script under
// scraper/ plus a workflow that runs it on push to the working branch, reads the
// answer out of the job log, and is meant to be deleted before the PR opens.
// Deleted, it costs nothing; left behind, it is a live wire — a workflow that
// fires on every push to every branch, unattended, against an external API this
// repo is a guest of. That survives review easily, because a probe workflow is
// small and looks like CI.
//
// The static signature is the branch scoping, not the file's name or contents:
// this repo's two real push-triggered workflows (ci.yml, pages.yml) are both
// pinned to the default branch, feature branches are covered by `pull_request`,
// and everything else here is `schedule:` or `workflow_dispatch:`. So a push
// trigger that is NOT pinned to main is either scaffolding that should have gone
// with the PR, or a workflow pinned to a branch that will be deleted under it.

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const DEFAULT_BRANCH = 'main';

const indentOf = (l) => l.length - l.trimStart().length;
const skippable = (l) => l.trim() === '' || /^\s*#/.test(l);
const unquote = (s) => s.trim().replace(/^['"]|['"]$/g, '');

// Drop a trailing `# …` comment. A scoped parse rather than a grep is the whole
// point here — `on: push` appears in the header comment of more than one
// workflow in this repo, and a grep would read the prose as the trigger.
const stripComment = (s) => s.replace(/(^|\s)#.*$/, '$1');

/** The top-level `on:` key: its inline value (if any) and its indented body. */
function onSection(yaml) {
  const lines = yaml.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (skippable(lines[i])) continue;
    const m = /^(?:on|"on"|'on'):(.*)$/.exec(lines[i]); // column 0 only — a nested `on:` is not the trigger block
    if (!m) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (skippable(lines[j])) continue;
      if (indentOf(lines[j]) === 0) break; // the next top-level key ends the block
      body.push(lines[j]);
    }
    return { inline: stripComment(m[1]).trim(), body };
  }
  return null;
}

/** `push` → ['push']; `[push, pull_request]` → ['push', 'pull_request']. */
function inlineNames(inline) {
  if (!inline) return null;
  if (inline.startsWith('[')) {
    return inline.replace(/^\[/, '').replace(/\]$/, '').split(',').map(unquote).filter(Boolean);
  }
  return [unquote(inline)];
}

/** A key's list value inside `block`, at exactly `indent`: inline, scalar or `- ` items. */
function keyList(block, indent, key) {
  for (let i = 0; i < block.length; i += 1) {
    if (indentOf(block[i]) !== indent) continue;
    const m = new RegExp(`^${key}:(.*)$`).exec(stripComment(block[i]).trim());
    if (!m) continue;
    const inline = m[1].trim();
    if (inline) return inlineNames(inline) ?? [];
    const items = [];
    for (let j = i + 1; j < block.length; j += 1) {
      if (indentOf(block[j]) <= indent) break;
      const t = stripComment(block[j]).trim();
      if (t.startsWith('- ')) items.push(unquote(t.slice(2)));
    }
    return items;
  }
  return null;
}

/**
 * The workflow's `push` trigger, or null when it has none.
 * `{ branches }` — the branch allow-list, or null when the trigger names none.
 * `{ ignored }` — the `branches-ignore:` list, which pins nothing.
 */
function pushTrigger(yaml) {
  const section = onSection(yaml);
  if (!section) return null;

  const inline = inlineNames(section.inline); // `on: push` / `on: [push, pull_request]`
  if (inline) return inline.includes('push') ? { branches: null, ignored: null } : null;

  const body = section.body;
  if (body.length === 0) return null;
  const base = indentOf(body[0]);

  // Block-sequence form: `on:` / `  - push` — a bare trigger name, no filters.
  if (body[0].trim().startsWith('- ')) {
    const names = body.filter((l) => indentOf(l) === base).map((l) => unquote(stripComment(l).trim().slice(2)));
    return names.includes('push') ? { branches: null, ignored: null } : null;
  }

  // Mapping form: `on:` / `  push:` with an optional filter block under it.
  const at = body.findIndex((l) => indentOf(l) === base && /^push:/.test(stripComment(l).trim()));
  if (at === -1) return null;
  const sub = [];
  for (let j = at + 1; j < body.length; j += 1) {
    if (indentOf(body[j]) <= base) break;
    sub.push(body[j]);
  }
  if (sub.length === 0) return { branches: null, ignored: null };
  const filterIndent = indentOf(sub[0]);
  return {
    branches: keyList(sub, filterIndent, 'branches'),
    ignored: keyList(sub, filterIndent, 'branches-ignore'),
  };
}

const rule = {
  id: 'edfringe-push-workflow-pinned-to-main',
  severity: 'blocking',
  description: `Every .github/workflows/ workflow with a push: trigger pins it to the ${DEFAULT_BRANCH} branch`,
  why:
    'a push trigger that is not pinned to the default branch fires on every push to every branch — the exact shape a throwaway edfringe-API probe workflow leaves behind when it is not deleted before the PR, and a live wire that then runs unattended against an external API on work that has nothing to do with it (feature branches are already covered here by pull_request)',
  doc: 'skills/probe-edfringe-api/SKILL.md',

  run(ctx) {
    const findings = [];
    for (const file of ctx.files.filter((f) => WORKFLOW.test(f)).sort()) {
      const yaml = ctx.read(file);
      if (yaml === null) continue; // relevance-first: unreadable is not a violation

      const trigger = pushTrigger(yaml);
      if (!trigger) continue; // schedule / workflow_dispatch / pull_request only — not this rule's business

      const { branches, ignored } = trigger;
      if (ignored && ignored.length > 0) {
        findings.push(finding(file,
          `its push: trigger filters with branches-ignore: (${ignored.join(', ')}), so it still fires on every other branch`,
          `replace branches-ignore: with \`branches: [${DEFAULT_BRANCH}]\``));
        continue;
      }
      if (branches === null || branches.length === 0) {
        findings.push(finding(file,
          'its push: trigger names no branches, so it fires on a push to any branch',
          `add \`branches: [${DEFAULT_BRANCH}]\` under push: — or, if this is a probe workflow, delete it along with its scraper/ probe script (probe-edfringe-api step 5)`));
        continue;
      }
      const off = branches.filter((b) => b !== DEFAULT_BRANCH);
      if (off.length > 0) {
        findings.push(finding(file,
          `its push: trigger is pinned to ${off.join(', ')} rather than ${DEFAULT_BRANCH}`,
          `a workflow pinned to a working branch stops meaning anything once that branch is merged and deleted — pin it to \`branches: [${DEFAULT_BRANCH}]\`, or delete it along with its scraper/ probe script (probe-edfringe-api step 5)`));
      }
    }
    return findings;
  },
};

function finding(file, what, fix) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file,
    line: null,
    what: `${file} is a live wire — ${what}`,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
