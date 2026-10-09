package checks

import (
	"encoding/json"
	"regexp"
	"strings"

	"claudinite.com/checksdk"
)

const testGlobsWhy = "CI and the pre-commit hook run scripts/verify.sh while a developer runs `npm test`, so the " +
	"same list is spelled twice; a glob added to only one of them means a suite that is green locally and never " +
	"runs in CI, or one that runs in CI and is invisible to whoever is editing it"

var (
	// nodeTest is the `node --test <globs...>` invocation, anchored per
	// line so verify.sh's prose comments can mention the command.
	nodeTest = regexp.MustCompile(`(?m)^\s*node --test\s+(.+?)\s*$`)
	// delegates is verify.sh calling the package script instead of
	// repeating the globs: one source of truth, nothing to drift.
	delegates = regexp.MustCompile(`\bnpm (?:run )?test\b`)
)

var testGlobsCheck = checksdk.Check{
	ID:   "edfringe-test-globs-in-step",
	Tags: []string{"world"},
	Doc:  verifySh,
	Why:  testGlobsWhy,
	Run:  testGlobsInStep,
}

func init() { checksdk.Register(testGlobsCheck) }

// globArgs are the whitespace-separated glob arguments, de-duped and
// sorted.
func globArgs(args string) []string { return sortedUnique(fields(args)) }

func without(list, drop []string) []string {
	var out []string
	for _, s := range list {
		if !contains(drop, s) {
			out = append(out, s)
		}
	}
	return out
}

func testGlobsInStep(repo checksdk.Repo) []checksdk.Finding {
	pkgRaw, okPkg := repo.Read("package.json")
	verifyRaw, okVerify := repo.Read(verifySh)
	if !okPkg || !okVerify {
		return nil
	}
	var pkg struct {
		Scripts struct {
			Test any `json:"test"`
		} `json:"scripts"`
	}
	if json.Unmarshal([]byte(pkgRaw), &pkg) != nil {
		return nil
	}
	script, ok := pkg.Scripts.Test.(string)
	if !ok {
		return nil
	}
	pkgMatch := nodeTest.FindStringSubmatch(script)
	verifyMatch := nodeTest.FindStringSubmatch(verifyRaw)
	finding := func(what, fix string) []checksdk.Finding {
		return []checksdk.Finding{{Path: verifySh, Sentence: what, Fix: fix}}
	}
	switch {
	case pkgMatch == nil && verifyMatch == nil:
		return nil
	case verifyMatch == nil:
		if delegates.MatchString(verifyRaw) {
			return nil
		}
		return finding("package.json's \"test\" script runs `node --test` but "+verifySh+" runs no unit tests at all",
			"add the `node --test` line back to "+verifySh+", or have it call `npm test` so the globs live in one place")
	case pkgMatch == nil:
		return finding(verifySh+" runs `node --test` but package.json's \"test\" script does not",
			"point package.json's \"test\" script at the same globs, or at `bash "+verifySh+"`")
	}
	inPkg, inVerify := globArgs(pkgMatch[1]), globArgs(verifyMatch[1])
	onlyPkg, onlyVerify := without(inPkg, inVerify), without(inVerify, inPkg)
	if len(onlyPkg) == 0 && len(onlyVerify) == 0 {
		return nil
	}
	var parts []string
	if len(onlyPkg) > 0 {
		parts = append(parts, "only in package.json: "+strings.Join(onlyPkg, " "))
	}
	if len(onlyVerify) > 0 {
		parts = append(parts, "only in "+verifySh+": "+strings.Join(onlyVerify, " "))
	}
	return finding("the `node --test` globs have drifted apart — "+strings.Join(parts, "; "),
		"add the missing glob to both lines (they are meant to be identical), or have "+verifySh+
			" call `npm test` so there is only one list")
}
