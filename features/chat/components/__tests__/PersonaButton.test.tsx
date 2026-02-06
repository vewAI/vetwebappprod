import React from "react";
import { renderToString } from "react-dom/server";
import PersonaButton from "../PersonaButton";

describe("PersonaButton (server render)", () => {
  it("includes label and portrait url in rendered output", () => {
    const html = renderToString(
      <PersonaButton roleKey="owner" label="Owner" portraitUrl="/img.png" fallbackText="OWN" isActive={true} onClick={() => {}} />,
    );
    expect(html).toContain("Owner");
    expect(html).toContain("/img.png");
    expect(html).toContain('aria-label="Select Owner persona"');
  });
});
