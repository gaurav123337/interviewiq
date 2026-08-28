/* Content module — clean exports for all consumers.

   Usage:
     import { getContentProvider } from "../services/content";
     const provider = getContentProvider();
     const coach = await provider.getCoachContent("react"); */

export type {
  // Article normalization types
  IContentProvider,
  ArticleContent,
  ArticleHit,
  ContentRequest,
  CoachContent,
  SystemDesignContent,
  RoadmapContent,
  InterviewContent,
  // Re-export from CMS types
  Testimonial,
  Ad,
  Resource,
  TipConfig,
} from "./types";

export { getContentProvider, resetContentProvider } from "./contentProvider";
