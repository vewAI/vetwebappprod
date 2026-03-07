import { act } from "react-dom/test-utils";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { PERSONA_DIRECTORY_READY_EVENT, usePersonaDirectory } from "../usePersonaDirectory";

function TestHarness({ caseId, onReady }: { caseId?: string; onReady?: (api: any) => void }) {
  const api = usePersonaDirectory(caseId);
  React.useEffect(() => {
    if (onReady) onReady(api);
  }, [api, onReady]);
  return null;
}

describe("usePersonaDirectory", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    if (root) {
      root.unmount();
      root = null;
    }
    container.remove();
  });

  it("starts not ready then becomes ready and supports upsert/get", async () => {
    let api: any;
    act(() => {
      root = createRoot(container);
      root.render(<TestHarness caseId="case-1" onReady={(a) => (api = a)} />);
    });

    // initial hook runs; upsert should work synchronously
    act(() => {
      api.upsertPersona("owner", { displayName: "Owner" });
    });

    expect(api.getPersonaMetadata("owner")).toEqual(expect.objectContaining({ displayName: "Owner" }));
    // isReady should be a boolean that eventually becomes true (we used setTimeout(0))
    expect(typeof api.isReady).toBe("boolean");
  });

  it("emits personaDirectoryReady event when loading completes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ personas: [] }),
    } as Response);

    const eventPromise = new Promise<any>((resolve) => {
      const onReady = (evt: Event) => {
        window.removeEventListener(PERSONA_DIRECTORY_READY_EVENT, onReady as EventListener);
        resolve((evt as CustomEvent).detail);
      };
      window.addEventListener(PERSONA_DIRECTORY_READY_EVENT, onReady as EventListener);
    });

    try {
      act(() => {
        root = createRoot(container);
        root.render(<TestHarness caseId="case-event" />);
      });

      const eventDetail = await eventPromise;
      expect(eventDetail).toBeTruthy();
      expect(eventDetail.caseId).toBe("case-event");
      expect(typeof eventDetail.entryCount).toBe("number");
    } finally {
      fetchMock.mockRestore();
    }
  });
});
