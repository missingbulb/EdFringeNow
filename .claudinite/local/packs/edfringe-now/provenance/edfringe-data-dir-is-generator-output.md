## 2026-07-31 · born · the check lands (#189)
- **Mechanism:** a coded check.
- **Landed:** #189

## 2026-09-29 · moved · into its scope folder, off the manifest's list
- **Reason:** a data-only manifest lists no modules; the folder is what the loader reads for the
  scope.
- **Mechanism:** a coded check discovered from the pack's rule folder.
- **Actor:** @missingbulb (owner).
- **Model:** claude-opus-5-5

## 2026-10-02 · policy-changed · names the city cycle's new raw and serving files
- **Reason:** the city cycle grew to where to stay and eat (`amenities`) and day trips
  (`wikivoyage`), and to every city the registry places a served festival in; each new file is named
  with its writer rather than the directory, as the check asks.
- **Mechanism:** the coded check's allowlist.
- **Actor:** Claude, on the owner's request for hotels, restaurants and excursions per festival
  city.
- **Model:** claude-opus-5-5

## 2026-10-02 · policy-changed · names the city files of four more festival cities
- **Reason:** nine new Israeli festivals brought Ramat Gan, Airport City, Eilat and Kfar Blum into
  the registry, and each city's raw and serving files are named with their writer.
- **Mechanism:** the coded check's allowlist.
- **Actor:** Claude, on the coordinator's follow-up to the owner's city-cycle request.
- **Model:** claude-opus-5-5

## 2026-10-02 · policy-changed · names the city files of sixteen international festival cities
- **Reason:** sixteen international festivals brought London, Amsterdam, Berlin, Luxembourg,
  Rapperswil, Malmö, Athens, Singapore, New Orleans, Wichita, Fort Lauderdale, Tryon, Santa Fe,
  Santa Ana, San Jose and San Francisco into the registry, and each city's raw and serving files are
  named with their writer.
- **Mechanism:** the coded check's allowlist.
- **Actor:** Claude, on the coordinator's follow-up to the owner's city-cycle request.
- **Model:** claude-opus-5-5

## 2026-10-09 · moved · ported to a Go check for the cn engine
- **Reason:** cn runs no JavaScript checks, so the Node world rule would stop running once the repo
  moves off the Node engine.
- **Mechanism:** a coded Go world check in the pack's checks/ folder, registered through the check
  SDK under the same id and on_fail; its fixtures are Go tests run by checks/test.sh.
- **Actor:** @missingbulb (owner).
- **Model:** claude-opus-5-5
