import assert from "assert";
import React from "react";
import { PersonaTabs } from "../components/PersonaTabs";

test("PersonaTabs renders and exposes tabs", () => {
  const el = PersonaTabs({ activePersona: "owner", onChange: () => {} } as any);
  assert.ok(el);
  // Basic shape sanity: it should return a React element with props and children
  assert.ok((el as any).props);
});
