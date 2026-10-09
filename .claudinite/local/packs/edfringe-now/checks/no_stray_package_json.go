package checks

import (
	"sort"
	"strings"

	"claudinite.com/checksdk"
)

// One package.json marks the whole ES-module tree — `site/package.json` —
// and the repo root carries the project's own. A third one is a copy of
// that pattern into a directory the second already covers, and buys
// nothing.
const noStrayWhy = "site/package.json already declares every source under it an ES module, so a package.json in " +
	"one of its subdirectories re-states what it inherits — and one outside site/ marks a tree that has no " +
	"module type to declare"

var allowedPackageJSON = []string{"package.json", "site/package.json"}

var noStrayCheck = checksdk.Check{
	ID:     "edfringe-no-stray-package-json",
	Tags:   []string{"world"},
	OnFail: "advise",
	Doc:    doc,
	Why:    noStrayWhy,
	Run:    noStrayPackageJSON,
}

func init() { checksdk.Register(noStrayCheck) }

func noStrayPackageJSON(repo checksdk.Repo) []checksdk.Finding {
	var stray []string
	for _, f := range repo.Files() {
		if strings.HasSuffix(f, "/package.json") && !contains(allowedPackageJSON, f) {
			stray = append(stray, f)
		}
	}
	sort.Strings(stray)
	var out []checksdk.Finding
	for _, f := range stray {
		out = append(out, checksdk.Finding{
			Path:     f,
			Sentence: f + " is a package.json outside the repo root and site/",
			Fix: f + " adds nothing site/package.json does not already give its directory — remove it, " +
				"unless it genuinely configures its own dependencies/scripts",
		})
	}
	return out
}
