# EdFringeNow
Website to help find a fringe show

## Development

Shared Claude guidelines are mounted at `.claudinite/` via [Claudinite](https://github.com/missingbulb/Claudinite).

This is a git submodule, so it is not pulled automatically. After cloning, run:

```
git submodule update --init --recursive
```

(or clone with `git clone --recurse-submodules`). A `SessionStart` hook runs this automatically for Claude Code sessions.
