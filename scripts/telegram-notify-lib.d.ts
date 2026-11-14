export type ResultState = 'submitted' | 'needs_review' | 'error' | 'skipped' | 'filtered' | 'budget_capped';
export type DeliveryOutcome = { status: 'sent' | 'failed' | 'unknown' | 'not_configured' | 'suppressed' | 'pending'; messageId?: number; reason?: string; sentAt?: string };
export interface ResultEvent { eventId: string; occurredAt: string; runId: string; siteHost: string; jobUrl: string; title: string; company: string; result: ResultState; detail: string; fit: number | null; ageH: number | null; formUrl?: string; reviewQueue?: string }
export interface ResultRow { eventId: string; at: string | number; url: string; title?: string; company?: string; result: string; detail?: string; fit?: number | null; ageH?: number | null; sync?: string; notification?: DeliveryOutcome }
export interface RunReport { site?: string; cycleId?: string; startedAt?: string | number; endedAt?: string | number; results?: Array<{ result: string }>; counts?: Partial<Record<ResultState, number>>; deliveryCounts?: Record<DeliveryOutcome['status'], number>; syncPending?: number; siteErrors?: number; missingReports?: number }
export interface PendingResult { event: ResultEvent; recorded: boolean; ready: boolean; notification: DeliveryOutcome }
export const RESULT_STATES: readonly ResultState[];
export const MAX_PENDING_RESULTS: number;
export function safeNotifyText(value: unknown, max?: number): string;
export function safeNotifyUrl(value: unknown): string;
export function normalizeResult(value: string): ResultState;
export function notifyReason(result: string, detail?: unknown): string;
export function notificationTime(value: string | number, zone?: string): string;
export function resultCounts(rows?: Array<{ result: string }>): Record<ResultState, number>;
export function deliveryCounts(rows?: Array<{ notification?: DeliveryOutcome }>): Record<DeliveryOutcome['status'], number>;
export function formatJobNotification(event: ResultEvent, options?: { timeZone?: string; sentAt?: string | number }): string | null;
export function formatRunNotification(report: RunReport, options?: { timeZone?: string; sentAt?: string | number }): string;
export function createTelegramSender(options: { getConfig: () => Promise<{ chat_id?: string; bot_token?: string; time_zone?: string } | null>; fetchFn?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<unknown>; timeoutMs?: number; minIntervalMs?: number; maxMessages?: number }): { send(text: string | ((options: { timeZone: string; sentAt: number }) => string | null), beforeDispatch?: () => void, options?: { summary?: boolean }): Promise<DeliveryOutcome>; drain(): Promise<void>; resetBudget(): Promise<void> };
export function resultEvent(row: ResultRow, siteHost: string, runId: string): ResultEvent;
export function createResultDeliveryQueue(options: { runId: string; load?: () => PendingResult[]; save: (entries: PendingResult[]) => void; record: (event: ResultEvent) => Promise<unknown>; send: (event: ResultEvent, beforeDispatch: () => void) => Promise<DeliveryOutcome>; now?: () => number; maxPending?: number; retryLimit?: number; onFailure?: (reason: string) => void }): {
  startup(): Promise<void>; enqueue(event: ResultEvent, row: ResultRow, options?: { notify?: boolean; ready?: boolean }): Promise<void>;
  finishReview(eventId: string, outcome: { status: string; formUrl?: string; suppress?: boolean }): Promise<void>;
  retry(): Promise<void>; drain(): Promise<void>; readonly pending: number;
};
export function cycleLockReclaimable(lock: { pid?: number } | null, options: { activePid: (pid: number) => boolean; now?: number; modifiedAt?: number; corruptGraceMs?: number }): boolean;
export function aggregateCycleReports(reports: RunReport[], cycleId: string, options?: { startedAt?: string | number; endedAt?: string | number; siteErrors?: number; expectedReports?: number }): RunReport;
