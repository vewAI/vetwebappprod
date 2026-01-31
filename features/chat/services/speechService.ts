import { scheduleClearSuppressionWhen } from "../utils/timers";

let _suppressed = false;

export function setSuppressed(v: boolean) {
  _suppressed = v;
}

export function isSuppressed() {
  return _suppressed;
}

export function scheduleClearSuppression(
  predicate: () => boolean,
  timeoutMs = 5000,
) {
  return scheduleClearSuppressionWhen(predicate, timeoutMs);
}

export default {
  setSuppressed,
  isSuppressed,
  scheduleClearSuppression,
};
