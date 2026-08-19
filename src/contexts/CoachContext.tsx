/* Coach context — shares the currently selected system design case study
   between the SystemDesign hub and the FloatingCoach. When a case study
   drawer is open, the floating coach shows a context banner and tailors
   its offline replies to that topic.
   Also tracks whether the CaseDrawer is open so the coach can reposition. */

import { createContext, useContext, useState, type ReactNode } from "react";

export interface CoachTopicContext {
  caseId: string | null;
  title: string | null;
  icon: string | null;
  blurb: string | null;
  drawerOpen: boolean;
}

const Ctx = createContext<CoachTopicContext>({
  caseId: null, title: null, icon: null, blurb: null, drawerOpen: false
});

export function CoachTopicProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState<CoachTopicContext>({
    caseId: null, title: null, icon: null, blurb: null, drawerOpen: false
  });
  return (
    <Ctx.Provider value={topic}>
      {children}
      {/* Hidden setter exposed via window for SystemDesign to call */}
      <CoachTopicSetter onSet={setTopic} />
    </Ctx.Provider>
  );
}

/** Hidden component that listens for window.__coachTopic events */
function CoachTopicSetter({ onSet }: { onSet: (t: CoachTopicContext) => void }) {
  // We use a custom event approach since SystemDesign is a sibling
  // This component attaches the setter to window for SystemDesign to call
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__setCoachTopic = onSet;
  }
  return null;
}

export function useCoachTopic(): CoachTopicContext {
  return useContext(Ctx);
}
