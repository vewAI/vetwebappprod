export type PersonaKey = "owner" | "veterinary-nurse" | string;

export interface DelayedSwitchHandle {
  cancel: () => void;
}

/**
 * Request a delayed persona switch. Returns a handle that can be cancelled.
 * The real switch side-effect should be provided by caller (or via an event emitter).
 */
export function delayedPersonaSwitch(
  persona: PersonaKey,
  delayMs = 3000,
  onSwitch?: (persona: PersonaKey) => void,
): DelayedSwitchHandle {
  let cancelled = false;
  const timer = setTimeout(() => {
    if (!cancelled) {
      onSwitch?.(persona);
    }
  }, delayMs);

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
    },
  };
}

export default { delayedPersonaSwitch };
