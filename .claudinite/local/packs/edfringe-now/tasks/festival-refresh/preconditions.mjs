import { refreshEditions, windowTerm } from '../festival-data.mjs';

export const terms = {
  'festival-in-refresh-window': windowTerm(refreshEditions, {
    yes: 'editions in their refresh window',
    no: 'no edition with an availability tool is within three weeks of opening, or running',
  }),
};
