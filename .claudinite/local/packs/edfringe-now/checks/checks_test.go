package checks

import (
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"testing"

	"claudinite.com/checksdk"
)

func TestRegisteredAsTheNodeRulesWere(t *testing.T) {
	for _, c := range []struct {
		check  checksdk.Check
		id     string
		onFail string
	}{
		{dataDirCheck, "edfringe-data-dir-is-generator-output", ""},
		{lookupCheck, "edfringe-lookup-indices", ""},
		{noStrayCheck, "edfringe-no-stray-package-json", "advise"},
		{selftestCheck, "edfringe-normalizer-selftest-in-verify", ""},
		{testGlobsCheck, "edfringe-test-globs-in-step", ""},
		{sourceDirsCheck, "edfringe-verify-sh-covers-source-dirs", ""},
		{workerCheck, "edfringe-worker-restores-main", ""},
	} {
		if c.check.ID != c.id || c.check.OnFail != c.onFail || c.check.Since != "" {
			t.Errorf("%s: registered as id %q, on_fail %q, since %q", c.id, c.check.ID, c.check.OnFail, c.check.Since)
		}
		if strings.Join(c.check.Tags, ",") != "world" || c.check.Run == nil || c.check.Why == "" || c.check.Doc == "" {
			t.Errorf("%s: want a world-tagged Run with a why and a doc, got %+v", c.id, c.check)
		}
	}
}

// --- test-globs-in-step ---

const globs = "plan/lib/__tests__/*.test.mjs .claudinite/local/packs/*/*.test.mjs"

func verifyScript(globs string) string {
	return "#!/usr/bin/env bash\nset -euo pipefail\n\nstep \"Unit tests — node --test\"\n" +
		"# Keep in step with the \"test\" script in package.json.\nnode --test " + globs +
		"\n\nstep \"JavaScript syntax — node --check\"\n"
}

func packageJSON(globs string) string {
	b, _ := json.Marshal(map[string]any{"name": "edfringenow",
		"scripts": map[string]string{"test": "node --test " + globs, "verify": "bash scripts/verify.sh"}})
	return string(b)
}

func TestTestGlobsInStep(t *testing.T) {
	expect(t, "identical glob lists", run(t, testGlobsInStep, map[string]string{
		"package.json": packageJSON(globs), "scripts/verify.sh": verifyScript(globs),
	}), "")
	expect(t, "the same globs in a different order", run(t, testGlobsInStep, map[string]string{
		"package.json":      packageJSON(".claudinite/local/packs/*/*.test.mjs plan/lib/__tests__/*.test.mjs"),
		"scripts/verify.sh": verifyScript(globs),
	}), "")

	// The exact regression this guards: a new local pack's test is wired
	// into `npm test`, the verify.sh copy is forgotten, and CI never runs it.
	fs := run(t, testGlobsInStep, map[string]string{
		"package.json":      packageJSON(globs + " .claudinite/local/packs/edfringe-now/tasks/*/*.test.mjs"),
		"scripts/verify.sh": verifyScript(globs),
	})
	expect(t, "a glob only in package.json", fs, "scripts/verify.sh")
	saysAll(t, "only in package.json", fs, "drifted apart",
		"only in package.json: .claudinite/local/packs/edfringe-now/tasks/*/*.test.mjs", "npm test")

	fs = run(t, testGlobsInStep, map[string]string{
		"package.json": packageJSON(globs), "scripts/verify.sh": verifyScript(globs + " scraper/__tests__/*.test.mjs"),
	})
	expect(t, "a glob only in verify.sh", fs, "scripts/verify.sh")
	saysAll(t, "only in verify.sh", fs, "only in scripts/verify.sh: scraper/__tests__/*.test.mjs")

	fs = run(t, testGlobsInStep, map[string]string{
		"package.json": packageJSON(globs), "scripts/verify.sh": "#!/usr/bin/env bash\nset -euo pipefail\nnode --check js/app.js\n",
	})
	expect(t, "verify.sh dropping node --test", fs, "scripts/verify.sh")
	saysAll(t, "no unit tests", fs, "runs no unit tests at all")

	expect(t, "verify.sh delegating to npm test", run(t, testGlobsInStep, map[string]string{
		"package.json": packageJSON(globs), "scripts/verify.sh": "#!/usr/bin/env bash\nset -euo pipefail\nnpm test\n",
	}), "")

	expect(t, "only package.json", run(t, testGlobsInStep, map[string]string{"package.json": packageJSON(globs)}), "")
	expect(t, "only verify.sh", run(t, testGlobsInStep, map[string]string{"scripts/verify.sh": verifyScript(globs)}), "")
	expect(t, "neither file", run(t, testGlobsInStep, map[string]string{"README.md": "hi"}), "")
	expect(t, "no test script", run(t, testGlobsInStep, map[string]string{
		"package.json": `{"scripts":{}}`, "scripts/verify.sh": verifyScript(globs),
	}), "")
}

// --- verify-sh-covers-source-dirs ---

func verifyShWithDirs(dirs ...string) string {
	var q []string
	for _, d := range dirs {
		q = append(q, "'"+d+"'")
	}
	return "#!/usr/bin/env bash\nstep \"JavaScript syntax — node --check\"\n" +
		"js_files=$(git ls-files " + strings.Join(q, " ") + " | { grep -E '\\.m?js$' || true; })\n"
}

func TestVerifyShCoversSourceDirs(t *testing.T) {
	expect(t, "every source dir named", run(t, verifyShCoversSourceDirs, map[string]string{
		"scripts/verify.sh": verifyShWithDirs("js", "plan", "scripts", "shared"),
		"js/app.js":         "", "plan/plan.js": "", "scripts/release-tool.mjs": "", "shared/geo.js": "",
	}), "")

	// The exact regression this guards: a .mjs script shipped under
	// scripts/ (#81) while scripts/ was never on the syntax-check list.
	fs := run(t, verifyShCoversSourceDirs, map[string]string{
		"scripts/verify.sh": verifyShWithDirs("js", "plan", "shared"),
		"js/app.js":         "", "scripts/release-tool.mjs": "",
	})
	expect(t, "a dir with .mjs source left off", fs, "scripts/verify.sh")
	if !strings.HasPrefix(sentences(fs), "scripts has committed .js/.mjs files") {
		t.Errorf("sentence %q", sentences(fs))
	}
	saysAll(t, "the fix names the dir", fs, "add 'scripts' to the `git ls-files` call")

	fs = run(t, verifyShCoversSourceDirs, map[string]string{
		"scripts/verify.sh": verifyShWithDirs("plan"), "shared/geo.js": "", "js/app.js": "",
	})
	expect(t, "several missing dirs, one finding", fs, "scripts/verify.sh")
	if !strings.HasPrefix(sentences(fs), "js, shared ") {
		t.Errorf("sentence %q, want the dirs named together, sorted", sentences(fs))
	}

	expect(t, "hidden dirs and bare top-level files", run(t, verifyShCoversSourceDirs, map[string]string{
		"scripts/verify.sh":               verifyShWithDirs("js", "plan", "scripts", "shared"),
		".claudinite/shared/engine/x.mjs": "", "build-info.js": "",
	}), "")
	expect(t, "no verify.sh", run(t, verifyShCoversSourceDirs, map[string]string{"shared/geo.js": ""}), "")
}

// --- no-stray-package-json ---

func TestNoStrayPackageJSON(t *testing.T) {
	expect(t, "only the allowed ones", run(t, noStrayPackageJSON, map[string]string{
		"package.json": "{}", "site/package.json": "{}", "site/js/app.js": "",
	}), "")

	fs := run(t, noStrayPackageJSON, map[string]string{
		"package.json": "{}", "site/package.json": "{}", "site/shared/package.json": "{}",
	})
	expect(t, "one copied into a new source dir", fs, "site/shared/package.json")
	saysAll(t, "the fix", fs, "remove it")

	expect(t, "each stray reported", run(t, noStrayPackageJSON, map[string]string{
		"js/package.json": "{}", "shared/package.json": "{}",
	}), "js/package.json shared/package.json")
	expect(t, "no package.json", run(t, noStrayPackageJSON, map[string]string{"README.md": "hi"}), "")
}

// --- worker-restores-main ---

const workerPath = ".claudinite/local/packs/edfringe-now/tasks/refresh-widgets/worker.sh"

const guard = `current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  git checkout main
fi
`

const writes = `python3 scraper/refresh.py
git add data
git commit -m "Refresh"
git push
`

func TestWorkerRestoresMain(t *testing.T) {
	expect(t, "restores main before writing", run(t, workerRestoresMain,
		map[string]string{workerPath: "set -euo pipefail\n" + guard + writes}), "")

	// The exact regression this guards: #141 and #231, where the task ran
	// after `basics/baselining` left the shared checkout on its branch.
	fs := run(t, workerRestoresMain, map[string]string{workerPath: "set -euo pipefail\n" + writes})
	expect(t, "pushes with no restore", fs, workerPath)
	saysAll(t, "no restore", fs, "without ever returning the checkout to `main`", "git rev-parse --abbrev-ref HEAD", "HEAD:main")

	fs = run(t, workerRestoresMain, map[string]string{workerPath: "set -euo pipefail\n" + writes + guard})
	expect(t, "restore after the write", fs, workerPath)
	saysAll(t, "late restore", fs, "only after it has already committed or pushed")

	expect(t, "git switch main", run(t, workerRestoresMain, map[string]string{
		workerPath: strings.Replace(guard, "git checkout main", "git switch main", 1) + writes,
	}), "")

	fs = run(t, workerRestoresMain, map[string]string{workerPath: "# Not `git checkout main`: see the note above.\n" + writes})
	expect(t, "a restore only in a comment", fs, workerPath)
	saysAll(t, "commented restore", fs, "without ever returning the checkout to `main`")

	expect(t, "a read-only worker", run(t, workerRestoresMain, map[string]string{
		workerPath: "set -euo pipefail\npython3 scraper/report.py\n",
	}), "")
	expect(t, "non-worker scripts", run(t, workerRestoresMain, map[string]string{
		"scripts/verify.sh": writes, ".github/workflows/ci.yml": writes,
		".claudinite/local/packs/edfringe-now/tasks/refresh-widgets/task.mjs": writes,
	}), "")
}

// --- the live gate: this repo meets every check ---

var workerScript = regexp.MustCompile(`/tasks/[^/]+/worker\.sh$`)

func TestThisRepo(t *testing.T) {
	root := os.Getenv("EDFRINGE_REPO")
	files := []string{}
	if root != "" {
		files = repoFiles(t, root)
	}
	need := func(what string, ok bool) {
		t.Helper()
		if !ok {
			t.Errorf("expected this repo to carry %s", what)
		}
	}
	need("package.json and scripts/verify.sh", contains(files, "package.json") && contains(files, "scripts/verify.sh"))
	need("scraper/normalize.py", contains(files, "scraper/normalize.py"))
	workers, days := 0, 0
	for _, f := range files {
		if workerScript.MatchString(f) {
			workers++
		}
		if dayFile.MatchString(f) {
			days++
		}
	}
	need("at least one task worker", workers > 0)
	need("committed day files", days > 3)

	for _, c := range []checksdk.Check{dataDirCheck, lookupCheck, noStrayCheck, selftestCheck, testGlobsCheck, sourceDirsCheck, workerCheck} {
		if fs := live(t, c.Run); len(fs) > 0 {
			t.Errorf("%s fails on this repo:\n%s", c.ID, said(fs))
		}
	}
}
