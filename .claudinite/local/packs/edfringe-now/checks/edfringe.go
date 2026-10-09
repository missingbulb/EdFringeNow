package checks

import (
	"bytes"
	"encoding/json"
	"regexp"
	"sort"
	"strings"

	"claudinite.com/checksdk"
)

// doc is the page most edfringe-now checks point a finding at.
const doc = ".claudinite/local/packs/edfringe-now/RULES.md"

// verifySh is the gate script both the pre-commit hook and CI run.
const verifySh = "scripts/verify.sh"

// whitespace is a run of JavaScript's \s, which arguments are split on.
var whitespace = regexp.MustCompile(`[\t\n\v\f\r \x{a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]+`)

// fields splits s on whitespace runs, dropping the empty ends.
func fields(s string) []string {
	var out []string
	for _, t := range whitespace.Split(s, -1) {
		if t != "" {
			out = append(out, t)
		}
	}
	return out
}

// tracked reports whether rel is one of the scanned files.
func tracked(repo checksdk.Repo, rel string) bool {
	for _, f := range repo.Files() {
		if f == rel {
			return true
		}
	}
	return false
}

// readTracked is rel's text when it is a scanned file that can be read.
func readTracked(repo checksdk.Repo, rel string) (string, bool) {
	if !tracked(repo, rel) {
		return "", false
	}
	return repo.Read(rel)
}

// member is one key of a JSON object, in the order the text carries it.
type member struct {
	key   string
	value any
}

// orderedObject is a JSON object's members in JavaScript's Object.entries
// order: array-index keys ascending, then the rest as written. Nil when
// raw is not an object.
func orderedObject(raw json.RawMessage) []member {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if t, err := dec.Token(); err != nil || t != json.Delim('{') {
		return nil
	}
	var indexed, named []member
	for dec.More() {
		t, err := dec.Token()
		if err != nil {
			return nil
		}
		key, _ := t.(string)
		var v json.RawMessage
		if dec.Decode(&v) != nil {
			return nil
		}
		m := member{key, v}
		if arrayIndex(key) {
			indexed = insertByIndex(indexed, m)
		} else {
			named = append(named, m)
		}
	}
	return append(indexed, named...)
}

// arrayIndex is whether JavaScript orders key as an integer: a canonical
// non-negative integer below 2^32-1.
func arrayIndex(key string) bool {
	if key == "" || len(key) > 10 || (len(key) > 1 && key[0] == '0') {
		return false
	}
	n := 0
	for _, c := range key {
		if c < '0' || c > '9' {
			return false
		}
		n = n*10 + int(c-'0')
	}
	return n < 1<<32-1
}

func insertByIndex(ms []member, m member) []member {
	i := len(ms)
	for i > 0 && (len(ms[i-1].key) > len(m.key) || len(ms[i-1].key) == len(m.key) && ms[i-1].key > m.key) {
		i--
	}
	ms = append(ms, member{})
	copy(ms[i+1:], ms[i:])
	ms[i] = m
	return ms
}

// jsonText is v as JSON.stringify writes it.
func jsonText(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "undefined"
	}
	return string(b)
}

// sortedUnique is the distinct strings of in, sorted.
func sortedUnique(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	sort.Strings(out)
	return out
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

func hasPrefixAny(s string, prefixes []string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(s, p) {
			return true
		}
	}
	return false
}
