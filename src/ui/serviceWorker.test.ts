import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKIP_WAITING } from "../sw/core.ts";
import { retryWaitingActivation } from "./serviceWorker.ts";

class FakeWorker extends EventTarget {
  posted: unknown[] = [];
  state: ServiceWorkerState;
  constructor(state: ServiceWorkerState) {
    super();
    this.state = state;
  }
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  become(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  /** A new build is found and starts installing. */
  find(): FakeWorker {
    const worker = new FakeWorker("installing");
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
    return worker;
  }
  /** It finishes installing and waits until the browser activates it. */
  installed(worker: FakeWorker): FakeWorker {
    this.installing = null;
    this.waiting = worker;
    worker.become("installed");
    return worker;
  }
  install(): FakeWorker {
    return this.installed(this.find());
  }
  activate(worker: FakeWorker) {
    this.waiting = null;
    worker.become("activated");
  }
}

const start = (reg: FakeRegistration) => retryWaitingActivation(reg as unknown as ServiceWorkerRegistration);

describe("retryWaitingActivation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks a new build that is still waiting a second after installing to take over", () => {
    const reg = new FakeRegistration();
    start(reg);
    const worker = reg.install();
    vi.advanceTimersByTime(999);
    expect(worker.posted).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(worker.posted).toEqual([SKIP_WAITING]);
  });

  it("leaves a new build alone when the browser activates it in time", () => {
    const reg = new FakeRegistration();
    start(reg);
    const worker = reg.install();
    reg.activate(worker);
    vi.advanceTimersByTime(5000);
    expect(worker.posted).toEqual([]);
  });

  it("keeps asking every second until the new build takes over", () => {
    const reg = new FakeRegistration();
    start(reg);
    const worker = reg.install();
    vi.advanceTimersByTime(3000);
    expect(worker.posted).toEqual([SKIP_WAITING, SKIP_WAITING, SKIP_WAITING]);
    reg.activate(worker);
    vi.advanceTimersByTime(5000);
    expect(worker.posted).toHaveLength(3);
  });

  it("also asks a build that was still installing when the page registered", () => {
    const reg = new FakeRegistration();
    const worker = reg.find();
    start(reg);
    reg.installed(worker);
    vi.advanceTimersByTime(1000);
    expect(worker.posted).toEqual([SKIP_WAITING]);
  });

  it("also asks a build that was already waiting when the page registered", () => {
    const reg = new FakeRegistration();
    const worker = reg.install();
    start(reg);
    vi.advanceTimersByTime(1000);
    expect(worker.posted).toEqual([SKIP_WAITING]);
  });
});
