export interface DiscoveryBoard { id: string; url?: string; jobs_url?: string; label?: string; type?: string; status?: string }
export interface DiscoveryPlan { provider: 'greenhouse' | 'lever' | 'ashby'; endpoint: string; boardId: string; boardUrl: string }
export interface DiscoveryJob { jobUrl: string; title: string; company: string; description: string; skills: string[]; location: string; postedAt?: string; source: string; externalId: string; portal: string }
export function discoveryBoardPlan(board: DiscoveryBoard): DiscoveryPlan | null;
export function planDiscoveryBoards(boards: DiscoveryBoard[]): DiscoveryPlan[];
export function discoveryPostingUrl(value: unknown): string | null;
export function boardCandidateFromPosting(job: { jobUrl?: string; url?: string; company?: string }): { url: string; label: string; type: 'greenhouse' | 'lever' | 'ashby' } | null;
export function parseDiscoveryJobs(plan: DiscoveryPlan, data: unknown): DiscoveryJob[];
