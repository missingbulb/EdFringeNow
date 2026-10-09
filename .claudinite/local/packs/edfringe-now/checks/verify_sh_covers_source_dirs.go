package checks

import (
	"regexp"
	"sort"
	"strings"

	"claudinite.com/checksdk"
)

const sourceDirsWhy = "the step only walks the top-level directories named in its `git ls-files` call; a source " +
	"directory left off that list is silently never parse-checked, in the pre-commit hook or in CI"

var (
	// lsFilesDirs is the `git ls-files 'site' 'scripts' …` call in
	// verify.sh's "JavaScript syntax" step, its quoted arguments captured.
	lsFilesDirs = regexp.MustCompile(`git ls-files((?:\s+'[^']*')+)`)
	quotedArg   = regexp.MustCompile(`'([^']*)'`)
	jsFile      = regexp.MustCompile(`\.m?js$`)
)

var sourceDirsCheck = checksdk.Check{
	ID:   "edfringe-verify-sh-covers-source-dirs",
	Tags: []string{"world"},
	Doc:  doc,
	Why:  sourceDirsWhy,
	Run:  verifyShCoversSourceDirs,
}

func init() { checksdk.Register(sourceDirsCheck) }

func verifyShCoversSourceDirs(repo checksdk.Repo) []checksdk.Finding {
	sh, ok := repo.Read(verifySh)
	if !ok {
		return nil
	}
	var listed []string
	if m := lsFilesDirs.FindStringSubmatch(sh); m != nil {
		for _, q := range quotedArg.FindAllStringSubmatch(m[1], -1) {
			listed = append(listed, q[1])
		}
	}
	var present []string
	for _, f := range repo.Files() {
		if !jsFile.MatchString(f) {
			continue
		}
		top, _, inDir := strings.Cut(f, "/")
		// Hidden and tooling directories (.claudinite, .github, …) are out
		// of scope, and so is a bare top-level file.
		if !inDir || strings.HasPrefix(top, ".") {
			continue
		}
		present = append(present, top)
	}
	missing := without(sortedUnique(present), listed)
	if len(missing) == 0 {
		return nil
	}
	sort.Strings(missing)
	verb, neg := "has", "isn't"
	if len(missing) > 1 {
		verb, neg = "have", "aren't"
	}
	var quoted []string
	for _, d := range missing {
		quoted = append(quoted, "'"+d+"'")
	}
	return []checksdk.Finding{{
		Path: verifySh,
		Sentence: strings.Join(missing, ", ") + " " + verb + " committed .js/.mjs files but " + neg +
			" named in " + verifySh + "'s `git ls-files` syntax-check step",
		Fix: "add " + strings.Join(quoted, " ") + " to the `git ls-files` call in " + verifySh +
			" — or, if the directory is deliberately excluded (vendored/generated content), extend its grep -v filter instead",
	}}
}
