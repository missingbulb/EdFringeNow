/* Who is coming, as rules: the answers it suggests for the questions the
 * reader has not answered themselves. The children's ages and the evening
 * they allow are the Plan2 page's (site/plan2/lib/draft.js).
 *
 * Pure: no DOM, no storage.
 */

export const PARTIES = ["solo", "couple", "family", "group"];

/** The ages a family is asked about. */
export const AGES = [3, 5, 7, 9, 12, 15];

/** The evening a party with nobody small in it keeps: 01:00. */
const LATE_MIN = 25 * 60;

/**
 * @param {{type: string, ages?: number[]}|null} party
 * @returns {{pace: string, interests: string[], dayEndMin: number, food: string}|null}
 *   pace and food are the ids of the pictures those questions offer
 */
export function suggestedAnswers(party) {
  if (!party || !PARTIES.includes(party.type)) return null;
  if (party.type === "family") {
    const youngest = party.ages && party.ages.length ? Math.min(...party.ages) : null;
    const small = youngest !== null && youngest < 8;
    const school = youngest !== null && youngest < 12;
    return {
      pace: small ? "easy" : "steady",
      interests: ["family"],
      dayEndMin: small ? 21 * 60 : school ? 22 * 60 : LATE_MIN,
      food: "regular",
    };
  }
  return {
    pace: party.type === "solo" ? "packed" : "steady",
    interests: [],
    dayEndMin: LATE_MIN,
    food: party.type === "couple" ? "dinner" : "self",
  };
}
