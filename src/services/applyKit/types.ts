/* ApplyKit types */

export interface ApplyKit {
  jobId: string;
  jobTitle: string;
  company: string;
  resume: string;
  coverLetter: string;
  /** True when AI-tailored, false when template-generated. */
  ai: boolean;
  createdAt: number;
  /** The last AI-polished version of each document — the baseline for the
      "vs AI" diff after the user hand-edits the text. */
  aiResume?: string;
  aiCover?: string;
}
