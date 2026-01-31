export interface ScheduleHandle {
  cancel: () => void;
  promise: Promise<boolean>;
}

/**
 * Resolves `true` if `predicate()` becomes true before `timeoutMs`.
 * Resolves `false` if timed out or cancelled.
 * The returned object contains a `cancel()` to stop waiting (resolves to false).
 */
export function scheduleClearSuppressionWhen(
  predicate: () => boolean,
  timeoutMs: number,
): ScheduleHandle {
  if (predicate()) {
    return {
      cancel: () => {},
      promise: Promise.resolve(true),
    };
  }

  let resolved = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolver: (v: boolean) => void;

  const promise = new Promise<boolean>((resolve) => {
    resolver = resolve;

    const start = Date.now();

    const tick = () => {
      try {
        if (predicate() && !resolved) {
          resolved = true;
          resolve(true);
          return;
        }
      } catch (err) {
        // swallow predicate errors
      }

      if (Date.now() - start >= timeoutMs) {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
        return;
      }

      // schedule next poll
      timer = setTimeout(tick, 50);
    };

    // first tick scheduled
    timer = setTimeout(tick, 50);
  });

  return {
    cancel: () => {
      if (!resolved) {
        resolved = true;
        if (timer) clearTimeout(timer);
        resolver(false);
      }
    },
    promise,
  };
}

export default {
  scheduleClearSuppressionWhen,
};
