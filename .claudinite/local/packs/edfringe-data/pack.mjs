import lookupIndices from './lookup-indices.mjs';
import dayFileDecoderKeys from './day-file-decoder-keys.mjs';

// EdFringeNow's data-pipeline pack: the edfringe.com scrape and the committed
// data layer it produces (scraper/, data/). Split out of the general `edfringe`
// pack because it is a distinct domain with its own trigger — you are in it only
// when touching the scraper or the data files, not when working on the UI — and
// it is where this repo's external-API and wire-format knowledge lives.
// Declaration-authoritative like every local pack (no fingerprint).
export default {
  id: 'edfringe-data',
  detect: null,
  marker: null,
  prose: 'RULES.md',
  rules: [lookupIndices, dayFileDecoderKeys],
};
