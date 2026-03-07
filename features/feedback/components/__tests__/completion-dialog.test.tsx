import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

import { CompletionDialog } from "../completion-dialog";

describe("CompletionDialog", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    pushMock.mockClear();
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

  it("routes to the case instructions page when restarting", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <CompletionDialog
          isOpen={true}
          onClose={() => {}}
          feedback="<p>done</p>"
          isLoading={false}
          caseId="case-5"
          messages={[]}
        />
      );
    });

    const restartButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      (btn.textContent || "").includes("Restart This Case")
    );

    expect(restartButton).toBeTruthy();

    act(() => {
      restartButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledWith("/case/case-5/instructions");
  });
});
