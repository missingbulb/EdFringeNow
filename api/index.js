/* The site's one Worker. Everything is the static tree under site/ (see
 * wrangler.jsonc); the Worker only answers the paths the page cannot answer
 * itself: a secret it must not hold, or what the edge knows of the request. */

import { handleFares } from "./fares.js";
import { handleWhere } from "./where.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/fares") return handleFares(request, env);
    if (pathname === "/api/where") return handleWhere(request);
    return env.ASSETS.fetch(request);
  },
};
