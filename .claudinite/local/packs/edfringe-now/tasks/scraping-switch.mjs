// The kill switch for the tasks that fetch from the live ticketing API. Scraping
// is off — the owner's call — and a task that fetches is a live route to the API,
// so each one names `scraping-switched-on` among its preconditions and a created
// item declines with the reason below instead of fetching. Turning scraping back
// on is flipping this one constant.
export const SCRAPING_ON = false;

export const scrapingSwitchedOn = {
  // No signals: the verdict is this constant, nothing about the repo.
  signals: [],
  holds() {
    return SCRAPING_ON
      ? { holds: true, reason: 'update scraping is switched on' }
      : { holds: false, reason: 'update scraping is switched off — nothing was fetched and no data file was touched' };
  },
};
