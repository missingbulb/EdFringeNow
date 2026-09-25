# Sourced by the task workers beside this file; never run on its own.

# context_param <key> <default> — an operator parameter from the item's Context,
# written as a bullet `key: value` (or `key=value`). Context is the only channel
# a task takes parameters from.
context_param() {
  local key="$1" default="$2" line value
  while IFS= read -r line; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line#- }"
    case "$line" in
      "$key:"*) value="${line#"$key:"}" ;;
      "$key="*) value="${line#"$key="}" ;;
      *) continue ;;
    esac
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
    return 0
  done <<< "${CLAUDINITE_CONTEXT:-}"
  printf '%s' "$default"
}

# commit_regenerated <message> <regenerate-command> <path>... — commit the given
# paths and push them to main, retrying on a rejected push. The caller has
# already returned the checkout to main.
#
# A plain push from a long run is guaranteed to lose it (#292, #695): the
# periodic ticket refresh pushes to main throughout the festival, so main has
# moved by the time a long fetch finishes. Recovery RE-DERIVES rather than
# merges. Everything under data/normalized and site/data is generator output, so
# a rebase would conflict on bytes whose only correct value is whatever the
# generator says now: take main's generated files (which also carry the
# append-only lookup lists and geocode cache the generator extends), regenerate
# from them plus this run's own non-generated input, and retry.
commit_regenerated() {
  local message="$1" regenerate="$2" attempt
  shift 2
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  for attempt in 1 2 3 4 5; do
    git add "$@"
    if git diff --staged --quiet; then
      echo "No data changes to commit."
      return 0
    fi
    git commit -q -m "$message"
    if git push; then
      echo "pushed on attempt ${attempt}"
      return 0
    fi
    echo "push rejected on attempt ${attempt}; re-deriving onto latest main"
    git fetch -q origin main
    git reset -q --soft origin/main
    git checkout -q origin/main -- data/normalized site/data
    $regenerate
  done
  echo "could not push the regenerated data after 5 attempts" >&2
  return 1
}
