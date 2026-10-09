## 2026-07-29 · born · the check lands (#145)
- **Mechanism:** a coded check.
- **Landed:** #145

## 2026-09-29 · moved · into its scope folder, off the manifest's list
- **Reason:** a data-only manifest lists no modules; the folder is what the loader reads for the
  scope.
- **Mechanism:** a coded check discovered from the pack's rule folder.
- **Actor:** @missingbulb (owner).
- **Model:** claude-opus-5-5

## 2026-10-09 · moved · ported to a Go check for the cn engine
- **Reason:** cn runs no JavaScript checks, so the Node world rule would stop running once the repo
  moves off the Node engine.
- **Mechanism:** a coded Go world check in the pack's checks/ folder, registered through the check
  SDK under the same id and on_fail; its fixtures are Go tests run by checks/test.sh.
- **Actor:** @missingbulb (owner).
- **Model:** claude-opus-5-5
