package checks

import (
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"

	"claudinite.com/checksdk"
)

const (
	masterMin    = "site/data/normalized/shows.min.json"
	availability = "site/data/normalized/availability.min.json"
	lookupsFile  = "site/data/venues.json"
	// maxPerFile keeps one systematically shifted lookup list to a
	// readable handful of findings instead of thousands of identical ones.
	maxPerFile = 5
)

const lookupWhy = "the wire format ships the lookup lists once and references them by position, so an index the " +
	"list no longer has (or a list regenerated without its day files) mislabels shows silently — the client " +
	"renders undefined, or worse, the neighbouring genre"

const regenerateTogether = "regenerate the data layer together — `python3 scraper/normalize.py` (add --merge for a " +
	"top-up) rewrites venues.json and every day file from the master in one pass; never edit either side alone"

var dayFile = regexp.MustCompile(`^site/data/days/\d{4}-\d{2}-\d{2}\.json$`)

// indexField is a record key holding an index into a venues.json list;
// orMissing when the producer writes -1 for "unknown".
type indexField struct {
	key, list string
	orMissing bool
}

// The producer is scraper/normalize.py (build_day_files / minify_master);
// the consumers are js/app.js adaptShow and plan/lib/hydrate.js
// rehydrateShows. `room` and `ts` carry -1 for "unknown".
var dayFields = []indexField{
	{"genre", "genres", false},
	{"room", "rooms", true},
	{"ts", "ticketStatuses", true},
}

// shows.min.json's shorter keys, same lists. Its ticket status lives in
// availability.min.json, checked against that file's own list.
var masterFields = []indexField{
	{"g", "genres", false},
	{"rm", "rooms", true},
	{"ar", "ageRestrictions", true},
}

var lookupCheck = checksdk.Check{
	ID:   "edfringe-lookup-indices",
	Tags: []string{"world"},
	Doc:  "scraper/README.md",
	Why:  lookupWhy,
	Run:  lookupIndices,
}

func init() { checksdk.Register(lookupCheck) }

// integer is v as an integer when it is a JSON number with no fraction.
func integer(v any) (int64, bool) {
	f, ok := v.(float64)
	if !ok || math.Trunc(f) != f || math.IsInf(f, 0) {
		return 0, false
	}
	return int64(f), true
}

// jsString is v as JavaScript's template interpolation writes it.
func jsString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(x)
	case map[string]any:
		return "[object Object]"
	case []any:
		var parts []string
		for _, e := range x {
			parts = append(parts, jsString(e))
		}
		return strings.Join(parts, ",")
	}
	return ""
}

func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case string:
		return x != ""
	case float64:
		return x != 0 && !math.IsNaN(x)
	case bool:
		return x
	}
	return true
}

type lookupRun struct {
	lists map[string]any
	out   []checksdk.Finding
}

func (l *lookupRun) add(file, what, fix string) {
	l.out = append(l.out, checksdk.Finding{Path: file, Sentence: what, Fix: fix})
}

func (l *lookupRun) size(list string) int {
	arr, _ := l.lists[list].([]any)
	return len(arr)
}

func (l *lookupRun) checkIndex(found *[]string, label string, value any, list string, orMissing bool) {
	if value == nil {
		return
	}
	n, ok := integer(value)
	if !ok {
		*found = append(*found, label+" is "+jsonText(value)+", not an integer index")
		return
	}
	if orMissing && n == -1 {
		return
	}
	if n < 0 || n >= int64(l.size(list)) {
		*found = append(*found, label+" = "+strconv.FormatInt(n, 10)+" is outside venues.json \""+list+
			"\" ("+strconv.Itoa(l.size(list))+" entries)")
	}
}

func (l *lookupRun) checkRecords(file string, records []any, fields []indexField, subKey string) {
	var found []string
	for i, r := range records {
		if len(found) >= maxPerFile {
			break
		}
		rec, ok := r.(map[string]any)
		if !ok {
			continue
		}
		at := "record #" + strconv.Itoa(i)
		if truthy(rec["title"]) {
			at += " (" + jsString(rec["title"]) + ")"
		} else if truthy(rec["t"]) {
			at += " (" + jsString(rec["t"]) + ")"
		}
		for _, f := range fields {
			l.checkIndex(&found, at+" "+f.key, rec[f.key], f.list, f.orMissing)
		}
		subs, _ := rec[subKey].([]any)
		for _, s := range subs {
			l.checkIndex(&found, at+" "+subKey+"[]", s, "subgenres", false)
		}
	}
	for i, what := range found {
		if i == maxPerFile {
			break
		}
		l.add(file, what, regenerateTogether)
	}
}

func lookupIndices(repo checksdk.Repo) []checksdk.Finding {
	raw, ok := repo.Read(lookupsFile)
	if !ok {
		return nil
	}
	l := &lookupRun{}
	var lookups any
	if err := json.Unmarshal([]byte(raw), &lookups); err != nil {
		l.add(lookupsFile, "data/venues.json is not valid JSON: "+err.Error(),
			"regenerate it with `python3 scraper/normalize.py` rather than hand-editing")
		return l.out
	}
	l.lists, _ = lookups.(map[string]any)

	for _, file := range repo.Files() {
		if !dayFile.MatchString(file) {
			continue
		}
		text, ok := repo.Read(file)
		if !ok {
			continue
		}
		var records any
		if err := json.Unmarshal([]byte(text), &records); err != nil {
			l.add(file, "day file is not valid JSON: "+err.Error(), "regenerate it with `python3 scraper/normalize.py`")
			continue
		}
		arr, isArr := records.([]any)
		if !isArr {
			l.add(file, "a day file must be a plain array of show records", "regenerate it with `python3 scraper/normalize.py`")
			continue
		}
		l.checkRecords(file, arr, dayFields, "subs")
	}

	if text, ok := readTracked(repo, masterMin); ok {
		var records any
		if err := json.Unmarshal([]byte(text), &records); err != nil {
			l.add(masterMin, "shows.min.json is not valid JSON: "+err.Error(), "regenerate it with `python3 scraper/normalize.py`")
			return l.out
		}
		if arr, isArr := records.([]any); isArr {
			l.checkRecords(masterMin, arr, masterFields, "sg")
		}
	}

	// The availability sidecar indexes into its OWN `ts` list, not
	// venues.json: refresh-tickets rewrites it on its own, so it must not
	// depend on the lookup file having been regenerated in the same breath.
	if text, ok := readTracked(repo, availability); ok {
		var probe any
		if err := json.Unmarshal([]byte(text), &probe); err != nil {
			l.add(availability, "availability.min.json is not valid JSON: "+err.Error(),
				"regenerate it with `python3 scraper/normalize.py --minify-from-master`")
			return l.out
		}
		var sidecar struct {
			TS any             `json:"ts"`
			A  json.RawMessage `json:"a"`
		}
		_ = json.Unmarshal([]byte(text), &sidecar)
		statuses, _ := sidecar.TS.([]any)
		var found []string
		for _, show := range orderedObject(sidecar.A) {
			if len(found) >= maxPerFile {
				break
			}
			for _, perf := range orderedObject(show.value.(json.RawMessage)) {
				var value any
				_ = json.Unmarshal(perf.value.(json.RawMessage), &value)
				label := show.key + " " + perf.key
				if n, isInt := integer(value); !isInt {
					found = append(found, label+" is "+jsonText(value)+", not an integer index")
				} else if n < 0 || n >= int64(len(statuses)) {
					found = append(found, label+" = "+strconv.FormatInt(n, 10)+" is outside this file's own \"ts\" ("+
						strconv.Itoa(len(statuses))+" entries)")
				}
				if len(found) >= maxPerFile {
					break
				}
			}
		}
		for _, what := range found {
			l.add(availability, what,
				"regenerate the data layer together — `python3 scraper/normalize.py --minify-from-master` rewrites the "+
					"sidecar and its status list from the master in one pass; never edit either side alone")
		}
	}
	return l.out
}
