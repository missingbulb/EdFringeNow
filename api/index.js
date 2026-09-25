/* The site's one Worker. Everything is the static tree under site/ (see
 * wrangler.jsonc); the Worker only answers the paths the page cannot answer
 * itself, because they need a secret. */

import { handleFares } from "./fares.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/fares") return handleFares(request, env);
    return env.ASSETS.fetch(request);
  },
};
