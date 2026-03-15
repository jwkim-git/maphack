export interface IsolatedSyncLoopHandle {
  refreshRetry: () => void;
}

export function bindIsolatedSyncLoop(input: {
  root: Document;
  onSync: () => Promise<void>;
  getNextRetryAt: () => number | null;
}): IsolatedSyncLoopHandle {
  const noopHandle: IsolatedSyncLoopHandle = {
    refreshRetry: () => {}
  };

  if (typeof MutationObserver === "undefined") {
    return noopHandle;
  }

  const observeTarget = input.root.body ?? input.root.documentElement;
  if (!observeTarget) {
    return noopHandle;
  }

  let queued = false;
  let running = false;
  let retryTimerId: number | null = null;

  const requestSync = (): void => {
    queued = true;
    void flush();
  };

  const armRetry = (): void => {
    if (typeof window === "undefined" || typeof window.setTimeout !== "function") {
      return;
    }

    if (retryTimerId !== null && typeof window.clearTimeout === "function") {
      window.clearTimeout(retryTimerId);
      retryTimerId = null;
    }

    const nextRetryAt = input.getNextRetryAt();
    if (nextRetryAt !== null) {
      retryTimerId = window.setTimeout(requestSync, Math.max(0, nextRetryAt - Date.now()));
    }
  };

  const flush = async (): Promise<void> => {
    if (running || !queued) {
      return;
    }

    running = true;
    try {
      while (queued) {
        queued = false;
        await input.onSync();
      }
    } finally {
      running = false;
      armRetry();
    }
  };

  new MutationObserver(requestSync).observe(observeTarget, {
    subtree: true,
    childList: true,
    characterData: true
  });

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("popstate", requestSync);
    window.addEventListener("focus", requestSync);
  }

  if (
    typeof document !== "undefined" &&
    typeof document.addEventListener === "function"
  ) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        requestSync();
      }
    });
  }

  armRetry();

  return {
    refreshRetry: armRetry
  };
}
