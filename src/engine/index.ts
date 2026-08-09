/* Domain layer: session composition, scoring, feedback, aggregation, and bank queries. */

export { composeSession, composeRelevantSession } from "./compose";
export type { ComposeArgs, RelevantArgs } from "./compose";
export { scoreAnswer, tokenize } from "./scoring";
export type { ScoreResult } from "./scoring";
export { buildFeedback } from "./feedback";
export { grade, aggregate, topicSuggestions, verdict } from "./aggregate";
export type { Verdict } from "./aggregate";
export { bankItems } from "./bank";
export type { BankItem } from "./bank";
export { pickRelevant } from "./relevance";
export { shuffle, pickN } from "./random";
