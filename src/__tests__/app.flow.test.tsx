// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppProvider } from "../store";
import { App } from "../components/App";

const clickBtn = (name: RegExp) => {
  const btns = screen.getAllByRole("button", { name });
  fireEvent.click(btns[0]);
};

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>
  );
}

beforeEach(() => {
  for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  cleanup();
});

describe("full interview flow", () => {
  it("walks onboarding → interview → feedback → results → history → bank → settings", () => {
    renderApp();

    /* onboarding: fresh state, step 1 (levels) */
    expect(screen.getByText(/What level are you interviewing/)).toBeTruthy();

    /* pick a level, field, company */
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

    /* interview view */
    expect(screen.getByText(/Question 1 of/)).toBeTruthy();

    /* answer every question until results */
    let guard = 0;
    while (!screen.queryByText(/Session complete/) && guard < 20) {
      const ta = document.querySelector("textarea");
      expect(ta).toBeTruthy();
      fireEvent.change(ta as HTMLTextAreaElement, { target: { value: "I would approach this by analyzing the requirements, considering the tradeoffs, and structuring my answer clearly with a concrete example." } });
      fireEvent.click(screen.getByRole("button", { name: /Submit answer/ }));
      fireEvent.click(screen.getByRole("button", { name: /Next question →|See my results 🎉/ }));
      guard++;
    }
    expect(guard).toBeLessThan(20);

    /* results page */
    expect(screen.getByText(/Session complete/)).toBeTruthy();
    expect(screen.getByText(/Category breakdown/)).toBeTruthy();
    expect(screen.getByText(/What to study next/)).toBeTruthy();
    expect(screen.getByText(/Question review/)).toBeTruthy();

    /* session persisted to history */
    const saved = JSON.parse(localStorage.getItem("iq.sessions") || "[]");
    expect(saved.length).toBe(1);
    expect(saved[0].answers.length).toBeGreaterThanOrEqual(5);
    expect(saved[0].meta.company).toBe("Stripe");

    /* bank view: search filters */
    clickBtn(/Bank/);
    expect(screen.getByPlaceholderText(/Search questions/)).toBeTruthy();
    const search = screen.getByPlaceholderText(/Search questions/) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "zzzz-nothing-matches" } });
    expect(screen.getByText(/No questions found/)).toBeTruthy();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByText(/Model answer/).length).toBeGreaterThan(0);

    /* history view shows saved session; review replays it */
    clickBtn(/History/);
    expect(screen.getByText(/Stripe · Security Engineer/)).toBeTruthy();
    clickBtn(/Review/);
    expect(screen.getByText(/Session complete/)).toBeTruthy();
    /* the replayed session shows the saved answers */
    expect(screen.getAllByText(/I would approach this by analyzing/).length).toBeGreaterThan(0);

    /* settings view */
    clickBtn(/Settings/);
    expect(screen.getByText(/AI feedback \(optional\)/)).toBeTruthy();
    expect(screen.getByPlaceholderText("sk-…")).toBeTruthy();
    expect(screen.getByText(/Interview defaults/)).toBeTruthy();
  });
});

describe("practice from bank", () => {
  it("starts a single-question session from the question bank", () => {
    renderApp();
    clickBtn(/Bank/);
    const details = document.querySelector("details") as HTMLDetailsElement;
    fireEvent.click(details.querySelector("summary") as HTMLElement);
    fireEvent.click(details.querySelector("button") as HTMLElement);
    expect(screen.getByText(/Question 1 of 1/)).toBeTruthy();
  });
});

describe("settings persistence", () => {
  it("saves interview defaults to localStorage", () => {
    renderApp();
    clickBtn(/Settings/);
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    const saved = JSON.parse(localStorage.getItem("iq.settings") || "{}");
    expect(saved.count).toBe(10);
  });
});
