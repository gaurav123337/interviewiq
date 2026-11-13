// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const cloud = vi.hoisted(() => ({
  user: { id: "user-test" } as { id: string } | null,
  listener: null as ((state: { user: { id: string } | null }) => void) | null,
  unsubscribe: vi.fn(),
}));
const services = vi.hoisted(() => ({
  exportProfileJson: vi.fn(() => '{"name":"Test User"}\n'),
  engineCommands: vi.fn((site: string) => [{
    site,
    label: `${site} setup`,
    submit: "auto" as const,
    command: `setup ${site}`,
  }]),
  getApplyConfig: vi.fn(),
  requestRunNow: vi.fn(),
  fetchRunStatus: vi.fn(),
  personalApplyReady: vi.fn(),
  applyAgent: vi.fn(),
}));
const corePanels = vi.hoisted(() => ({
  applyResults: vi.fn(),
  appliedByUser: vi.fn(),
  resumeVariants: vi.fn(),
  reviewQueue: vi.fn(),
  exemplars: vi.fn(),
}));
const globalPanels = vi.hoisted(() => ({
  applyMode: vi.fn(),
  jobSites: vi.fn(),
  credentials: vi.fn(),
}));

vi.mock("../services/cloud", () => ({
  getCloudState: vi.fn(() => ({ user: cloud.user })),
  subscribeCloud: vi.fn((listener: typeof cloud.listener) => {
    cloud.listener = listener;
    return () => { cloud.listener = null; cloud.unsubscribe(); };
  }),
}));
vi.mock("../services/applyAgent", () => ({ personalApplyReady: services.personalApplyReady }));
vi.mock("../services/autoApply", () => ({
  APPLY_SITES: [{ id: "instahyre", label: "Instahyre", url: "https://example.test/jobs", submit: "auto" }],
  engineCommands: services.engineCommands,
  exportProfileJson: services.exportProfileJson,
}));
vi.mock("../services/jobSites", () => ({
  getApplyConfig: services.getApplyConfig,
  requestRunNow: services.requestRunNow,
  fetchRunStatus: services.fetchRunStatus,
}));

function StatefulPanel({ name }: { name: string }) {
  const [value, setValue] = useState(() => `fresh ${cloud.user?.id}`);
  return <label>{name}<input aria-label={`${name} state`} value={value} onChange={event => setValue(event.target.value)} /></label>;
}

vi.mock("../components/jobs/ApplyAgentPanel", () => ({
  default: ({ canPair }: { canPair: boolean }) => {
    services.applyAgent({ canPair });
    return <StatefulPanel name="Personal agent panel" />;
  },
}));
vi.mock("../components/jobs/ApplyModePanel", () => ({
  default: () => { globalPanels.applyMode(); return <div>Apply mode panel</div>; },
}));
vi.mock("../components/jobs/ApplyResultsPanel", () => ({
  default: () => { corePanels.applyResults(); return <StatefulPanel name="Apply results panel" />; },
}));
vi.mock("../components/jobs/AppliedByUserPanel", () => ({
  default: () => { corePanels.appliedByUser(); return <StatefulPanel name="Applied by user panel" />; },
}));
vi.mock("../components/jobs/ResumeVariantsPanel", () => ({
  default: () => { corePanels.resumeVariants(); return <StatefulPanel name="Resume variants panel" />; },
}));
vi.mock("../components/jobs/JobSitesPanel", () => ({
  default: () => { globalPanels.jobSites(); return <div>Job sites panel</div>; },
}));
vi.mock("../components/jobs/CredentialsPanel", () => ({
  default: () => { globalPanels.credentials(); return <div>Credentials panel</div>; },
}));
vi.mock("../components/jobs/ReviewQueuePanel", () => ({
  default: () => { corePanels.reviewQueue(); return <StatefulPanel name="Review queue panel" />; },
}));
vi.mock("../components/jobs/ExemplarsPanel", () => ({
  default: () => { corePanels.exemplars(); return <StatefulPanel name="Exemplars panel" />; },
}));

import { AutoApplyCard } from "../components/jobs/AutoApplyCard";

const coreNames = ["Apply results panel", "Applied by user panel", "Resume variants panel", "Review queue panel", "Exemplars panel"];
const expectNoCorePanels = () => {
  for (const panel of Object.values(corePanels)) expect(panel).not.toHaveBeenCalled();
  for (const name of coreNames) expect(screen.queryByLabelText(`${name} state`)).toBeNull();
};
const expectCorePanels = () => {
  for (const panel of Object.values(corePanels)) expect(panel).toHaveBeenCalled();
  for (const name of coreNames) expect(screen.getByLabelText(`${name} state`)).toBeTruthy();
};
const expectNoGlobalControls = () => {
  for (const panel of Object.values(globalPanels)) expect(panel).not.toHaveBeenCalled();
  expect(screen.queryByRole("region", { name: "Legacy administrator controls" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Run now/i })).toBeNull();
  expect(services.getApplyConfig).not.toHaveBeenCalled();
  expect(services.requestRunNow).not.toHaveBeenCalled();
  expect(services.fetchRunStatus).not.toHaveBeenCalled();
};
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
function switchAccount(id: string | null) {
  act(() => {
    cloud.user = id ? { id } : null;
    cloud.listener?.({ user: cloud.user });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cloud.user = { id: "user-test" };
  cloud.listener = null;
  services.personalApplyReady.mockReset().mockResolvedValue(undefined);
  services.getApplyConfig.mockReset().mockResolvedValue({ mode: "local", cloud_provider: null, cloud_endpoint: null, updated_at: null });
  services.requestRunNow.mockReset().mockResolvedValue("requested");
  services.fetchRunStatus.mockReset().mockResolvedValue({ status: "done", detail: "done" });
});
afterEach(cleanup);

describe("AutoApplyCard access composition", () => {
  /* The entitlement boundary must prevent the readiness RPC and core panel
     mounts, while signed-in locked users can still manage existing bindings. */
  it.each(["guest", "free user", "Pro user without the add-on"])(
    "%s stays locked without issuing core RPCs or mounting global controls",
    account => {
      if (account === "guest") cloud.user = null;
      const onUpgrade = vi.fn();
      render(<AutoApplyCard locked={true} isAdmin={false} onUpgrade={onUpgrade} />);

      expect(screen.getByText("🔒 Platinum or add-on")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Unlock with Platinum or add-on" }));
      expect(onUpgrade).toHaveBeenCalledOnce();
      expect(services.exportProfileJson).not.toHaveBeenCalled();
      expect(services.personalApplyReady).not.toHaveBeenCalled();
      expectNoCorePanels();
      expectNoGlobalControls();
      if (account === "guest") {
        expect(services.applyAgent).not.toHaveBeenCalled();
        expect(screen.queryByLabelText("Personal agent panel state")).toBeNull();
      } else {
        expect(services.applyAgent.mock.calls).toEqual([[{ canPair: false }]]);
        expect(screen.getByLabelText("Personal agent panel state")).toBeTruthy();
      }
    },
  );

  it.each(["auto-apply add-on", "Platinum"])(
    "%s unlocks personal tools and own panels only after readiness succeeds",
    async () => {
      const readiness = deferred();
      services.personalApplyReady.mockReturnValueOnce(readiness.promise);
      render(<AutoApplyCard locked={false} isAdmin={false} onUpgrade={vi.fn()} />);

      expect(screen.getByText("Auto-apply active")).toBeTruthy();
      expect(screen.getByRole("button", { name: /Download apply-profile\.json/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Copy JSON/i })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /Instahyre/i }));
      expect(screen.getByText("setup instahyre")).toBeTruthy();
      expect(screen.getByText(/Platform-wide registry, credentials, and remote start\/stop controls are administrator-only/)).toBeTruthy();
      expect(services.exportProfileJson).toHaveBeenCalledOnce();
      expect(services.applyAgent).toHaveBeenCalledWith({ canPair: true });
      expect(services.personalApplyReady.mock.calls).toEqual([[]]);
      expectNoCorePanels();
      expectNoGlobalControls();

      await act(async () => readiness.resolve());
      expectCorePanels();
      expect(screen.queryByRole("alert")).toBeNull();
      expectNoGlobalControls();
    },
  );

  it("keeps own panels unmounted and reports a readiness failure without global fallback", async () => {
    const message = "Personal application data is unavailable until the tenant migration is applied.";
    services.personalApplyReady.mockRejectedValueOnce(new Error(message));
    render(<AutoApplyCard locked={false} isAdmin={false} onUpgrade={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(message));
    expect(services.personalApplyReady).toHaveBeenCalledOnce();
    expect(services.applyAgent).toHaveBeenCalledWith({ canPair: true });
    expectNoCorePanels();
    expectNoGlobalControls();
  });

  it("does not infer administrator or personal data access from an unlocked guest", () => {
    cloud.user = null;
    render(<AutoApplyCard locked={false} isAdmin={false} onUpgrade={vi.fn()} />);

    expect(screen.getByText("Auto-apply active")).toBeTruthy();
    expect(services.applyAgent).not.toHaveBeenCalled();
    expect(services.personalApplyReady).not.toHaveBeenCalled();
    expectNoCorePanels();
    expectNoGlobalControls();
  });

  it("explicit administrator access bypasses the lock but still gates own panels on readiness", async () => {
    const readiness = deferred();
    const configReady = deferred();
    services.personalApplyReady.mockReturnValueOnce(readiness.promise);
    services.getApplyConfig.mockReturnValueOnce(configReady.promise.then(() => ({ mode: "local", cloud_provider: null, cloud_endpoint: null, updated_at: null })));
    render(<AutoApplyCard locked={true} isAdmin={true} onUpgrade={vi.fn()} />);

    expect(screen.getByText("Auto-apply active")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Run now/i })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Legacy administrator controls" })).toBeTruthy();
    expect(services.applyAgent).toHaveBeenCalledWith({ canPair: true });
    await waitFor(() => expect(services.getApplyConfig).toHaveBeenCalledOnce());
    for (const panel of Object.values(globalPanels)) expect(panel).toHaveBeenCalledOnce();
    expectNoCorePanels();

    await act(async () => configReady.resolve());
    for (const panel of Object.values(globalPanels)) expect(panel).toHaveBeenCalledTimes(2);
    expectNoCorePanels();

    await act(async () => readiness.resolve());
    expectCorePanels();
  });

  it("account switches discard agent and core panel state and probe the new account", async () => {
    render(<AutoApplyCard locked={false} isAdmin={false} onUpgrade={vi.fn()} />);
    await waitFor(expectCorePanels);
    const names = ["Personal agent panel", ...coreNames];
    for (const name of names) {
      fireEvent.change(screen.getByLabelText(`${name} state`), { target: { value: "private user-test state" } });
      expect((screen.getByLabelText(`${name} state`) as HTMLInputElement).value).toBe("private user-test state");
    }

    const nextReadiness = deferred();
    services.personalApplyReady.mockReturnValueOnce(nextReadiness.promise);
    switchAccount("user-next");
    expect(services.personalApplyReady).toHaveBeenCalledTimes(2);
    expect((screen.getByLabelText("Personal agent panel state") as HTMLInputElement).value).toBe("fresh user-next");
    for (const name of coreNames) expect(screen.queryByLabelText(`${name} state`)).toBeNull();

    await act(async () => nextReadiness.resolve());
    for (const name of names) {
      expect((screen.getByLabelText(`${name} state`) as HTMLInputElement).value).toBe("fresh user-next");
    }
    expectNoGlobalControls();

    switchAccount(null);
    for (const name of names) expect(screen.queryByLabelText(`${name} state`)).toBeNull();
    expect(services.personalApplyReady).toHaveBeenCalledTimes(2);
    expectNoGlobalControls();
  });

  it.each(["success", "failure"])("ignores a previous account's late readiness %s", async outcome => {
    const priorReadiness = deferred();
    const nextReadiness = deferred();
    services.personalApplyReady.mockReturnValueOnce(priorReadiness.promise).mockReturnValueOnce(nextReadiness.promise);
    render(<AutoApplyCard locked={false} isAdmin={false} onUpgrade={vi.fn()} />);
    switchAccount("user-next");

    await act(async () => {
      if (outcome === "success") priorReadiness.resolve();
      else priorReadiness.reject(new Error("private previous-account failure"));
    });
    expectNoCorePanels();
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByLabelText("Personal agent panel state") as HTMLInputElement).value).toBe("fresh user-next");

    await act(async () => nextReadiness.resolve());
    expectCorePanels();
    expect(services.personalApplyReady).toHaveBeenCalledTimes(2);
    expectNoGlobalControls();
  });

  it("relocking removes own panels and does not start another readiness RPC", async () => {
    const { rerender } = render(<AutoApplyCard locked={false} isAdmin={false} onUpgrade={vi.fn()} />);
    await waitFor(expectCorePanels);
    rerender(<AutoApplyCard locked={true} isAdmin={false} onUpgrade={vi.fn()} />);

    expect(screen.getByText("🔒 Platinum or add-on")).toBeTruthy();
    for (const name of coreNames) expect(screen.queryByLabelText(`${name} state`)).toBeNull();
    expect(services.applyAgent).toHaveBeenLastCalledWith({ canPair: false });
    expect(services.personalApplyReady).toHaveBeenCalledOnce();
    expectNoGlobalControls();
  });
});
