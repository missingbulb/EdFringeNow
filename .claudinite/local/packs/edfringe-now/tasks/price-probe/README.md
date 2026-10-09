# price-probe

Reads one show's raw `performancePrices` payload — `fees[]`,
`transactionFeesPrice`, `outsideFeesPrice` and `feeInTicketPrice` together, not
reduced to `booking_fee()`'s single figure — into the run log, for a question
about how the API composes a price that does not warrant the full pass.

Name the show with a Context bullet `slug: <edfringe slug>`. It is **not** behind
the scraping switch, which gates only the passes that write data.
