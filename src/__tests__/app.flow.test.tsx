// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { AppProvider } from "../store";
import { App } from "../components/App";

/* This is the heaviest integration test in the suite: it mounts the whole app
   shell (a large DOM) and drives it across every view. Under the full parallel
   suite the machine is CPU-saturated (dozens of jsdom environments at once), and
   a single evaluation of an expensive accessibility query — getAllByRole walks
   the entire tree computing the ARIA role + accessible name of every node — can
   itself exceed findBy's 1s default before one poll ever succeeds. That made the
   first gate flake in the full run while passing in isolation. Raise the async
   timeout for this file and prefer cheaper text/placeholder queries for the hot
   gates so a slow poll (or a slow lazy-chunk resolve) has room to settle. */
configure({ asyncUtilTimeout: 8000 });

/* The app code-splits every view behind React.lazy + Suspense (App.tsx). In a
   synchronous test the routed chunk resolves a microtask after navigation, so
   the first paint of each new view shows the <RouteSpinner> fallback. Whenever
   a click crosses into a *new* lazy chunk, wait for that view with an async
   findBy* query; assertions inside an already-loaded chunk stay synchronous. */

const clickBtn = (name: RegExp) => {
  const btns = screen.getAllByRole("button", { name });
  fireEvent.click(btns[0]);
};

/* secondary tabs live behind the ☰ menu — open it first (header, always mounted) */
const openMenu = () => {
  fireEvent.click(screen.getAllByRole("button", { name: /More/ })[0]);
};

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>
  );
}

/* first-time visitors land on the marketing page. Landing and Onboarding are
   each their own lazy chunk, so wait for the Landing CTA to paint, click
   through, then wait for the onboarding step-1 heading. */
async function startApp() {
  renderApp();
  /* text query, not findAllByRole — role queries are the slow path and this is
     the first gate every test hits (see the note by configure() above). */
  const cta = await screen.findAllByText(/Start practicing free/);
  fireEvent.click(cta[0]);
  await screen.findByText(/What level are you interviewing/);
}

beforeAll(async () => {
  /* Warm the lazy route chunks once. Views are code-split (App.tsx), and the
     first-ever import of a chunk pays a transform cost that can exceed a
     findBy's default 1s timeout on a cold run — which is why the first test to
     touch a view would otherwise flake. Preloading caches the modules so each
     React.lazy factory resolves promptly during the flow. */
  await Promise.all([
    import("../components/Landing"),
    import("../components/Onboarding"),
    import("../components/Interview"),
    import("../components/Results"),
    import("../components/Bank"),
    import("../components/History"),
    import("../components/Settings")
  ]);
});

beforeEach(() => {
  cleanup();
  /* jsdom keeps window.location across tests; the app derives its initial view
     from the URL hash (store.initialState → viewFromHash), so a hash left behind
     by a previous test's navigation would boot the next test straight into that
     view instead of the landing page. Reset it so every test starts fresh. */
  window.location.hash = "";
  localStorage.clear();
});

describe("full interview flow", () => {
  it("walks onboarding → interview → feedback → results → history → bank → settings", async () => {
    await startApp();

    /* onboarding: fresh state, step 1 (levels) — already awaited in startApp */
    expect(screen.getByText(/What level are you interviewing/)).toBeTruthy();

    /* pick a level, field, company (all within the onboarding chunk) */
    clickBtn(/Senior/);
    expect(screen.getByText(/Pick your field/)).toBeTruthy();
    clickBtn(/Security Engineer/);
    expect(screen.getByText(/Which company/)).toBeTruthy();
    clickBtn(/Stripe/);
    expect(screen.getByText(/Ready to be interviewed/)).toBeTruthy();

    /* open config modal and begin */
    clickBtn(/Start Interview/);
    expect(screen.getByText(/Configure your interview/)).toBeTruthy();
    clickBtn(/Begin interview/);

    /* interview view — its own lazy chunk */
    expect(await screen.findByText(/Question 1 of/)).toBeTruthy();

    /* answer every question until results. Key the loop off the interview's own
       "Submit answer" button (only present in the question state of the interview
       chunk) rather than the first textarea on the page — the interview also
       mounts the CoachChat input, and the global FloatingCoach input persists
       across views, so document.querySelector("textarea") would keep matching a
       coach box after the final "See my results" click has already navigated
       into the (lazy) results chunk. When the Submit button is gone we've left
       the interview — break and await the results paint below. */
    let guard = 0;
    while (guard < 20) {
      const submit = screen.queryByRole("button", { name: /Submit answer/ });
      if (!submit) break;
      const answerBox = screen.getByPlaceholderText(/Type your answer/);
      fireEvent.change(answerBox, { target: { value: "I would approach this by analyzing the requirements, considering the tradeoffs, and structuring my answer clearly with a concrete example." } });
      fireEvent.click(submit);
      fireEvent.click(screen.getByRole("button", { name: /Next question →|See my results 🎉/ }));
      guard++;
    }
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(20);

    /* results page — lazy chunk */
    expect(await screen.findByText(/Session complete/)).toBeTruthy();
    expect(screen.getByText(/Category breakdown/)).toBeTruthy();
    expect(screen.getByText(/What to study next/)).toBeTruthy();
    expect(screen.getByText(/Question review/)).toBeTruthy();

    /* session persisted to history */
    const saved = JSON.parse(localStorage.getItem("iq.sessions") || "[]");
    expect(saved.length).toBe(1);
    expect(saved[0].answers.length).toBeGreaterThanOrEqual(5);
    expect(saved[0].meta.company).toBe("Stripe");

    /* bank view: search filters (secondary tab — via ☰ menu, lazy chunk) */
    openMenu();
    clickBtn(/Bank/);
    const search = await screen.findByPlaceholderText(/Search questions/) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "zzzz-nothing-matches" } });
    expect(screen.getByText(/No questions found/)).toBeTruthy();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByText(/Model answer/).length).toBeGreaterThan(0);

    /* history view shows saved session; review replays it (lazy chunk) */
    openMenu();
    clickBtn(/History/);
    expect(await screen.findByText(/Stripe · Security Engineer/)).toBeTruthy();
    clickBtn(/Review/);
    /* the replayed session shows the saved answers (results chunk) */
    expect(await screen.findByText(/Session complete/)).toBeTruthy();
    expect(screen.getAllByText(/I would approach this by analyzing/).length).toBeGreaterThan(0);

    /* settings view (secondary tab — via ☰ menu, lazy chunk) */
    openMenu();
    clickBtn(/Settings/);
    expect(await screen.findByText(/AI feedback \(optional\)/)).toBeTruthy();
    expect(screen.getByPlaceholderText("sk-…")).toBeTruthy();
    expect(screen.getByText(/Interview defaults/)).toBeTruthy();
  });
});

describe("ending with no answers", () => {
  it("returns to the launch view instead of a blank results screen", async () => {
    await startApp();

    /* walk onboarding and begin a session */
    clickBtn(/Senior/);
    clickBtn(/Security Engineer/);
    clickBtn(/Stripe/);
    clickBtn(/Start Interview/);
    clickBtn(/Begin interview/);
    expect(await screen.findByText(/Question 1 of/)).toBeTruthy();

    /* end the interview without answering anything */
    clickBtn(/← End/);
    clickBtn(/End & see results/);

    /* must NOT land on a blank results page — back on the launch view */
    expect(await screen.findByText(/Ready to be interviewed/)).toBeTruthy();
    expect(screen.queryByText(/Session complete/)).toBeFalsy();
    /* nothing saved to history either */
    const saved = JSON.parse(localStorage.getItem("iq.sessions") || "[]");
    expect(saved.length).toBe(0);
  });
});

describe("admin gating", () => {
  it("does not expose an Admin tab to non-admins", async () => {
    await startApp();
    openMenu();
    const adminBtns = screen.queryAllByRole("button", { name: /Admin/ });
    expect(adminBtns.length).toBe(0);
  });
});

describe("practice from bank", () => {
  it("starts a single-question session from the question bank", async () => {
    await startApp();
    openMenu();
    clickBtn(/Bank/);
    await screen.findByPlaceholderText(/Search questions/);
    const details = document.querySelector("details") as HTMLDetailsElement;
    fireEvent.click(details.querySelector("summary") as HTMLElement);
    fireEvent.click(details.querySelector("button") as HTMLElement);
    expect(await screen.findByText(/Question 1 of 1/)).toBeTruthy();
  });
});

describe("job-description tailoring", () => {
  it("analyzes a pasted JD and builds a tailored session", async () => {
    await startApp();
    clickBtn(/I have a job description/);
    const ta = screen.getByPlaceholderText(/Senior Backend Engineer at Stripe/);
    fireEvent.change(ta, {
      target: {
        value: "Senior Backend Engineer at Stripe. We use Go, PostgreSQL, Kubernetes and AWS. 5+ years experience building distributed systems. Lead design of microservices and APIs with strong reliability and performance requirements."
      }
    });
    clickBtn(/Analyze & continue/);
    expect(await screen.findByText(/Ready to be interviewed/)).toBeTruthy();
    expect(screen.getByText(/Job description/)).toBeTruthy();
    clickBtn(/Start Interview/);
    clickBtn(/Begin interview/);
    expect(await screen.findByText(/Question 1 of/)).toBeTruthy();
  });
});

describe("settings persistence", () => {
  it("saves interview defaults to localStorage", async () => {
    await startApp();
    openMenu();
    clickBtn(/Settings/);
    fireEvent.click(await screen.findByRole("button", { name: "10" }));
    const saved = JSON.parse(localStorage.getItem("iq.settings") || "{}");
    expect(saved.count).toBe(10);
  });
});
