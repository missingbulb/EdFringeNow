import { upcomingEditions, windowTerm } from '../festival-data.mjs';

export const terms = {
  'festival-edition-upcoming': windowTerm(upcomingEditions, {
    yes: 'editions upcoming or live',
    no: 'no festival edition is upcoming or live',
  }),
};
