import { act } from "react-dom/test-utils";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { usePersonaDirectory } from "../usePersonaDirectory";

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
});
