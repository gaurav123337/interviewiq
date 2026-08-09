/* Domain layer: session composition, scoring, feedback, aggregation, and bank queries. */

export { composeSession } from "./compose";
export type { ComposeArgs } from "./compose";
export { scoreAnswer } from "./scoring";
export type { ScoreResult } from "./scoring";
export { buildFeedback } from "./feedback";
export { grade, aggregate, topicSuggestions } from "./aggregate";
export { bankItems } from "./bank";
export type { BankItem } from "./bank";
