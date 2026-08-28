/* Content module — clean exports for all consumers.

   Usage:
     import { getContentProvider } from "../services/content";
     const provider = getContentProvider();
     const coach = await provider.getCoachContent("react"); */

// Original barrel exports (CRUD, cache, analytics, AB tests)
export * from "./types";
export * from "./abTest";
export * from "./cache";
export * from "./crud";
export * from "./analytics";

// Content provider (article normalization → module consumption)
export { getContentProvider, resetContentProvider } from "./contentProvider";
