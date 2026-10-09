package checks

import (
	"encoding/json"
	"strings"
	"testing"

	"claudinite.com/checksdk"
)

// --- lookup-indices ---

var lookups = map[string]any{
	"venues":          map[string]any{"33": map[string]any{"name": "Pleasance Courtyard"}},
	"rooms":           []string{"Above", "Below"},
	"genres":          []string{"Comedy", "Theatre"},
	"subgenres":       []string{"Improv", "Stand-up"},
	"ticketStatuses":  []string{"SOLD_OUT", "TICKETS_AVAILABLE"},
	"ageRestrictions": []string{"EIGHTEEN", "SIXTEEN"},
}

// jsonTree is a tree of documents written as JSON. Map keys marshal
// sorted, so a document whose key order matters is given as its text.
func jsonTree(docs map[string]any) map[string]string {
	tree := map[string]string{}
	for p, v := range docs {
		if s, ok := v.(string); ok {
			tree[p] = s
			continue
		}
		b, err := json.Marshal(v)
		if err != nil {
			panic(err)
		}
		tree[p] = string(b)
	}
	return tree
}

type obj = map[string]any

var cleanDay = []obj{
	{"id": "X", "title": "A show", "genre": 1, "subs": []int{0, 1}, "venue": "33", "room": 0, "ts": 1},
	// -1 is the producer's "unknown" for room and ticket status, not an
	// out-of-range index.
	{"id": "Y", "title": "Another", "genre": 0, "subs": []int{}, "venue": "33", "room": -1, "ts": -1},
}

func TestLookupIndices(t *testing.T) {
	expect(t, "clean day file, master and sidecar", run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json":          lookups,
		"site/data/days/2026-08-07.json": cleanDay,
		"site/data/normalized/shows.min.json": []obj{
			{"i": "X", "t": "A show", "g": 1, "sg": []int{0}, "rm": 0, "ar": 1, "p": []obj{{"d": 807, "s": "20:00"}}},
		},
		"site/data/normalized/availability.min.json": obj{
			"v": 1, "ts": []string{"TICKETS_AVAILABLE"}, "a": obj{"X": obj{"807|20:00": 0}}, "o": obj{},
		},
	})), "")

	// The exact regression this guards: a lookup list shrinks or reorders
	// (or a day file is hand-edited) and every affected card mislabels.
	fs := run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json":          lookups,
		"site/data/days/2026-08-07.json": []obj{{"id": "X", "title": "A show", "genre": 7, "venue": "33", "room": 0, "ts": 1}},
	}))
	expect(t, "a genre past the end", fs, "site/data/days/2026-08-07.json")
	saysAll(t, "genre", fs, `genre = 7 is outside venues.json "genres"`, "normalize.py")

	fs = run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json": lookups,
		"site/data/days/2026-08-07.json": []obj{
			{"id": "X", "title": "A", "genre": 0, "subs": []int{9}, "venue": "33", "room": 0, "ts": 1},
			{"id": "Y", "title": "B", "genre": 0, "subs": []int{}, "venue": "33", "room": 4, "ts": 1},
			{"id": "Z", "title": "C", "genre": 0, "subs": []int{}, "venue": "33", "room": 0, "ts": 5},
		},
	}))
	in := "site/data/days/2026-08-07.json"
	expect(t, "subgenre, room and ticket status", fs, in+" "+in+" "+in)
	inOrder(t, "subgenre, room and ticket status", fs,
		`subs[] = 9 is outside venues.json "subgenres"`,
		`room = 4 is outside venues.json "rooms"`,
		`ts = 5 is outside venues.json "ticketStatuses"`)

	fs = run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json": lookups,
		"site/data/normalized/shows.min.json": []obj{
			{"i": "X", "t": "A show", "g": 0, "sg": []int{3}, "rm": 0, "ar": 0, "p": []obj{{"d": 807, "s": "20:00"}}},
			{"i": "Y", "t": "Bad room", "g": 0, "sg": []int{}, "rm": 4, "ar": 0, "p": []obj{}},
		},
	}))
	expect(t, "the master's own keys", fs, masterMin+" "+masterMin)
	inOrder(t, "the master's own keys", fs,
		`sg[] = 3 is outside venues.json "subgenres"`, `rm = 4 is outside venues.json "rooms"`)

	// Against its OWN ts list, not venues.json: refresh-tickets rewrites
	// the sidecar on its own. The key order is the text's, so it is spelled.
	fs = run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json": lookups,
		"site/data/normalized/availability.min.json": `{"v":1,"ts":["TICKETS_AVAILABLE","SOLD_OUT"],` +
			`"a":{"X":{"807|20:00":1},"Y":{"807|20:00":4},"Z":{"807|20:00":"SOLD_OUT"}},"o":{}}`,
	}))
	expect(t, "the sidecar's indices", fs, availability+" "+availability)
	inOrder(t, "the sidecar's indices", fs,
		`Y 807|20:00 = 4 is outside this file's own "ts" (2 entries)`,
		`Z 807|20:00 is "SOLD_OUT", not an integer index`)
	saysAll(t, "the sidecar's fix", fs, "normalize.py")

	// venues.json has 2 ticketStatuses; the sidecar's own list has 5.
	expect(t, "an index only the sidecar's own list allows", run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json": lookups,
		"site/data/normalized/availability.min.json": obj{
			"v": 1, "ts": []string{"A", "B", "C", "D", "E"}, "a": obj{"X": obj{"807|20:00": 4}}, "o": obj{},
		},
	})), "")

	fs = run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json":          lookups,
		"site/data/days/2026-08-07.json": []obj{{"id": "X", "title": "A", "genre": "Comedy", "venue": "33", "room": 0, "ts": 1}},
	}))
	expect(t, "a non-integer index", fs, "site/data/days/2026-08-07.json")
	saysAll(t, "non-integer", fs, `genre is "Comedy", not an integer index`)
	fs = run(t, lookupIndices, jsonTree(obj{
		"site/data/venues.json":          lookups,
		"site/data/days/2026-08-07.json": `[{"id":"X","title":"A","genre":1.5,"room":1.0,"ts":1}]`,
	}))
	expect(t, "a fractional index, beside a whole one written 1.0", fs, "site/data/days/2026-08-07.json")
	saysAll(t, "fractional", fs, `genre is 1.5, not an integer index`)

	expect(t, "no data layer", run(t, lookupIndices, jsonTree(obj{"README.md": obj{}})), "")
}

// inOrder holds that the findings' sentences contain parts, one each, in
// order.
func inOrder(t *testing.T, name string, fs []checksdk.Finding, parts ...string) {
	t.Helper()
	if len(fs) != len(parts) {
		t.Errorf("%s: %d findings, want %d\n%s", name, len(fs), len(parts), sentences(fs))
		return
	}
	for i, p := range parts {
		if !strings.Contains(fs[i].Sentence, p) {
			t.Errorf("%s: finding %d is %q, want it to contain %q", name, i, fs[i].Sentence, p)
		}
	}
}

// --- normalizer-selftest-in-verify ---

const normalizer = "import sys\nif \"--selftest\" in sys.argv:\n    run_selftest()\n"

const verifyWithSelftest = `#!/usr/bin/env bash
set -euo pipefail

step "Normalizer self-test — normalize.py --selftest"
if command -v python3 >/dev/null 2>&1; then
  python3 scraper/normalize.py --selftest
fi
`

// The label survives, the invocation is gone: a grep for the two tokens
// passes here, which is why the check strips `step "..."` first.
const verifyLabelOnly = `#!/usr/bin/env bash
set -euo pipefail

step "Normalizer self-test — normalize.py --selftest"
echo "skipped"
`

func TestNormalizerSelftestInVerify(t *testing.T) {
	expect(t, "verify.sh invokes it", run(t, normalizerSelftestInVerify, map[string]string{
		"scraper/normalize.py": normalizer, "scripts/verify.sh": verifyWithSelftest,
	}), "")

	// The exact regression this guards: the step is gutted, its heading
	// stays.
	fs := run(t, normalizerSelftestInVerify, map[string]string{
		"scraper/normalize.py": normalizer, "scripts/verify.sh": verifyLabelOnly,
	})
	expect(t, "only the step label left", fs, "scripts/verify.sh")
	saysAll(t, "label only", fs, "never invokes it", "--selftest")

	expect(t, "a commented-out invocation", run(t, normalizerSelftestInVerify, map[string]string{
		"scraper/normalize.py": normalizer,
		"scripts/verify.sh":    "#!/usr/bin/env bash\n# python3 scraper/normalize.py --selftest\necho hi\n",
	}), "scripts/verify.sh")
	expect(t, "a trailing comment naming it", run(t, normalizerSelftestInVerify, map[string]string{
		"scraper/normalize.py": normalizer,
		"scripts/verify.sh":    "#!/usr/bin/env bash\nnode --check js/app.js  # unlike normalize.py --selftest, this is syntax only\n",
	}), "scripts/verify.sh")

	expect(t, "a normalizer with no --selftest", run(t, normalizerSelftestInVerify, map[string]string{
		"scraper/normalize.py": "def main():\n    pass\n", "scripts/verify.sh": verifyLabelOnly,
	}), "")
	expect(t, "no normalizer", run(t, normalizerSelftestInVerify, map[string]string{"scripts/verify.sh": verifyLabelOnly}), "")
	expect(t, "no verify.sh", run(t, normalizerSelftestInVerify, map[string]string{"scraper/normalize.py": normalizer}), "")
}

// --- data-dir-is-generator-output ---

var cleanDataTree = map[string]string{
	"site/data/venues.json":                      "",
	"data/shows.json":                            "",
	"data/normalized/shows.json":                 "",
	"site/data/normalized/shows.min.json":        "",
	"site/data/normalized/descriptions.min.json": "",
	"site/data/days/index.json":                  "",
	"site/data/days/2026-08-07.json":             "",
	"js/app.js":                                  "",
}

func plus(files ...string) map[string]string {
	set := map[string]string{}
	for _, f := range files {
		set[f] = ""
	}
	return with(cleanDataTree, set)
}

func TestDataDirIsGeneratorOutput(t *testing.T) {
	expect(t, "only normalizer output", run(t, dataDirIsGeneratorOutput, cleanDataTree), "")

	// prices.json is the one file normalize.py READS; it is allowed by
	// name, so a second file cannot ride in on its shape.
	expect(t, "the named input", run(t, dataDirIsGeneratorOutput, plus("data/prices.json")), "")
	fs := run(t, dataDirIsGeneratorOutput, plus("data/prices.backup.json"))
	expect(t, "a lookalike of the named input", fs, "data/prices.backup.json")
	saysAll(t, "the fix names the allowed inputs", fs, "data/prices.json")

	expect(t, "a second generator's named output", run(t, dataDirIsGeneratorOutput,
		plus("site/data/festivals/jerusalem-comedy/2026.json")), "")
	fs = run(t, dataDirIsGeneratorOutput, plus("site/data/festivals/jerusalem-comedy/2027.json"))
	expect(t, "a lookalike beside it", fs, "site/data/festivals/jerusalem-comedy/2027.json")
	saysAll(t, "the fix names the allowed outputs", fs, "site/data/festivals/jerusalem-comedy/2026.json")

	raw := "data/festivals/jerusalem-comedy/2026/nominatim/"
	expect(t, "a fetcher's named raw file", run(t, dataDirIsGeneratorOutput, plus(raw+"geocode.json")), "")
	expect(t, "another file in its folder", run(t, dataDirIsGeneratorOutput, plus(raw+"scratch.json")), raw+"scratch.json")

	// The published tree matters most: a file there is served to visitors.
	expect(t, "a hand-made file under site/data/", run(t, dataDirIsGeneratorOutput,
		plus("site/data/hand/notes.json")), "site/data/hand/notes.json")

	page := "data/festivals/.cache/jerusalem-comedy/2026/comedy-festival-site/salakh.html"
	fs = run(t, dataDirIsGeneratorOutput, plus(page))
	expect(t, "a force-added festival page cache", fs, page)
	saysAll(t, "un-track, not delete", fs, "git rm --cached "+page)

	// The exact regression this guards: a throwaway probe's answer parked
	// in data/ as if it were data.
	fs = run(t, dataDirIsGeneratorOutput, plus("data/ticket-status-enum.json"))
	expect(t, "a probe's output", fs, "data/ticket-status-enum.json")
	saysAll(t, "probe", fs, "is not something a generator in this repo produces", "normalize.py")

	fs = run(t, dataDirIsGeneratorOutput, plus("data/raw_pages/events_1.json"))
	expect(t, "a force-added raw scrape cache", fs, "data/raw_pages/events_1.json")
	saysAll(t, "raw cache", fs, "git rm --cached data/raw_pages/events_1.json")

	expect(t, "a note beside the normalized files", run(t, dataDirIsGeneratorOutput,
		plus("data/normalized/NOTES.md")), "data/normalized/NOTES.md")
	expect(t, "a whole new output directory, per file, sorted", run(t, dataDirIsGeneratorOutput,
		plus("data/weeks/2026-w32.json", "data/hand/notes.json")), "data/hand/notes.json data/weeks/2026-w32.json")
	expect(t, "no data/", run(t, dataDirIsGeneratorOutput,
		map[string]string{"README.md": "hi", "scraper/normalize.py": ""}), "")
}
