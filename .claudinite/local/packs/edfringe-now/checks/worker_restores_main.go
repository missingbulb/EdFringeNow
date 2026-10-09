package checks

import (
	"regexp"
	"sort"

	"claudinite.com/checksdk"
)

const workerWhy = "the Claudinite scheduler runs every due task in ONE checkout, and a task ordered after a " +
	"delivering `basics/baselining` inherits the maintenance branch its deliver() left behind (`git checkout -B`, " +
	"never switched back) — an upstream-less branch whose bare push aborts with exit 128, which is how #141 and " +
	"#231 each silently stopped a data refresh for days"

var (
	// taskWorker is a local task's worker script; the legacy
	// .claudinite/local_packs/ path is accepted too.
	taskWorker = regexp.MustCompile(`^\.claudinite/local(?:/packs|_packs)/[^/]+/tasks/[^/]+/worker\.sh$`)
	// workerWrites is a commit or a push outside a comment: a worker that
	// only reads can be left wherever the scheduler put it.
	workerWrites = regexp.MustCompile(`(?m)^[^#\n]*\bgit\s+(?:commit|push)\b`)
	// workerRestores is `git checkout main` or `git switch main` outside a
	// comment.
	workerRestores = regexp.MustCompile(`(?m)^[^#\n]*\bgit\s+(?:checkout|switch)\s+main\b`)
)

var workerCheck = checksdk.Check{
	ID:   "edfringe-worker-restores-main",
	Tags: []string{"world"},
	Doc:  doc,
	Why:  workerWhy,
	Run:  workerRestoresMain,
}

func init() { checksdk.Register(workerCheck) }

func workerRestoresMain(repo checksdk.Repo) []checksdk.Finding {
	var out []checksdk.Finding
	for _, file := range repo.Files() {
		if !taskWorker.MatchString(file) {
			continue
		}
		src, ok := repo.Read(file)
		if !ok {
			continue
		}
		write := workerWrites.FindStringIndex(src)
		if write == nil {
			continue
		}
		var what string
		if restore := workerRestores.FindStringIndex(src); restore == nil {
			what = "commits or pushes without ever returning the checkout to `main`"
		} else if restore[0] > write[0] {
			what = "returns the checkout to `main` only after it has already committed or pushed"
		} else {
			continue
		}
		out = append(out, checksdk.Finding{
			Path:     file,
			Sentence: file + " " + what,
			Fix: "before the worker writes anything, add the guard the refresh-shows / refresh-tickets workers carry: " +
				"read `git rev-parse --abbrev-ref HEAD` and `git checkout main` when it is anything else. " +
				"Do not reach for `git push origin HEAD:main` instead — from a polluted checkout that pushes " +
				"baselining's unreviewed converge straight to main, past its own maintenance PR.",
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out
}
