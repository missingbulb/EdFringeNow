package checks

import (
	"regexp"
	"strings"

	"claudinite.com/checksdk"
)

const (
	normalizerPy = "scraper/normalize.py"
	selftestFlag = "--selftest"
)

const selftestWhy = "the live edfringe API is unreachable from a session, so the normalizer self-test is the ONE " +
	"transform check that runs offline — drop it from the gate and every scraper change ships with no " +
	"verification at all, in a repo where nothing else can stand in for it"

var (
	commentLine = regexp.MustCompile(`^\s*#`)
	// stepLabel is a `step "..."` call's quoted argument.
	stepLabel       = regexp.MustCompile(`\bstep\s+(?:"[^"]*"|'[^']*')`)
	trailingComment = regexp.MustCompile(`\s#.*$`)
)

var selftestCheck = checksdk.Check{
	ID:   "edfringe-normalizer-selftest-in-verify",
	Tags: []string{"world"},
	Doc:  doc,
	Why:  selftestWhy,
	Run:  normalizerSelftestInVerify,
}

func init() { checksdk.Register(selftestCheck) }

// commandLines are sh's lines with comments and every `step` label
// dropped: verify.sh labels the step `step "Normalizer self-test —
// normalize.py --selftest"`, so a plain grep for the two tokens passes even
// after the real invocation is deleted.
func commandLines(sh string) []string {
	var out []string
	for _, l := range strings.Split(sh, "\n") {
		if commentLine.MatchString(l) {
			continue
		}
		l = stepLabel.ReplaceAllString(l, "")
		out = append(out, trailingComment.ReplaceAllString(l, ""))
	}
	return out
}

func normalizerSelftestInVerify(repo checksdk.Repo) []checksdk.Finding {
	normalizer, ok := readTracked(repo, normalizerPy)
	if !ok || !strings.Contains(normalizer, selftestFlag) {
		return nil
	}
	sh, ok := readTracked(repo, verifySh)
	if !ok {
		return nil
	}
	for _, l := range commandLines(sh) {
		if strings.Contains(l, "normalize.py") && strings.Contains(l, selftestFlag) {
			return nil
		}
	}
	return []checksdk.Finding{{
		Path: verifySh,
		Sentence: normalizerPy + " supports " + selftestFlag + " but " + verifySh +
			" never invokes it (a step label naming it does not count — only a command line does)",
		Fix: "restore the step to " + verifySh + ": `python3 " + normalizerPy + " " + selftestFlag +
			"` — both the pre-commit hook and CI run that script, so this is the only place wiring it makes it a gate",
	}}
}
