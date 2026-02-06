import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import PersonaButton from "../PersonaButton";

describe("PersonaButton", () => {
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

  it("renders portrait and name and responds to clicks", () => {
    const handleClick = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(<PersonaButton roleKey="owner" displayName="Owner" portraitUrl="/img.png" isActive onClick={handleClick} />);
    });

    expect(container.textContent).toContain("Owner");
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/img.png");

    const button = container.querySelector("button[aria-label=persona-owner]") as HTMLElement;
    expect(button).toBeTruthy();
    act(() => button.click());
    expect(handleClick).toHaveBeenCalled();
  });
});
