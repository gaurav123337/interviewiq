/* ApplyKit service — barrel re-export (zero import changes for consumers) */

export type { ApplyKit } from "./types";
export { jdKeywords, jdResponsibilities } from "./jdMining";
export { yearLabel, quantifiedClaims, buildResume, buildCoverLetter } from "./builders";
export type { AtsKeywordRow, AtsDrilldown } from "./ats";
export { atsCoverage, atsKeywordDrilldown } from "./ats";
export { getApplyKit, saveApplyKit } from "./persistence";
export { aiTailorResume, aiTailorCoverLetter } from "./ai";
