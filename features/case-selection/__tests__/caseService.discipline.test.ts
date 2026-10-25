import { describe, it, expect } from "vitest";
import { matchesDiscipline } from "../services/caseService";

describe("matchesDiscipline", () => {
  it("matches all cases when discipline is empty or 'all'", () => {
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, "all")).toBe(true);
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, "")).toBe(true);
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, undefined)).toBe(true);
  });

  it("handles general Surgery matching any surgery case", () => {
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, "Surgery")).toBe(true);
    expect(matchesDiscipline({ category: "Equine Surgery", species: "Equine" }, "Surgery")).toBe(true);
    expect(matchesDiscipline({ category: "Small Animal Surgery", species: "Canine" }, "Surgery")).toBe(true);
    expect(matchesDiscipline({ category: "Internal Medicine", species: "Canine" }, "Surgery")).toBe(false);
  });

  it("handles Small Animal Surgery matching canine/feline surgery cases", () => {
    // Rocky: canine surgery
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, "Small Animal Surgery")).toBe(true);
    expect(matchesDiscipline({ category: "Small Animal Surgery", species: "Canine" }, "Small Animal Surgery")).toBe(true);
    // Freddie: equine surgery should NOT match
    expect(matchesDiscipline({ category: "Equine Surgery", species: "Equine" }, "Small Animal Surgery")).toBe(false);
    expect(matchesDiscipline({ category: "Surgery", species: "Horse" }, "Small Animal Surgery")).toBe(false);
  });

  it("handles Equine Surgery matching equine surgery cases", () => {
    expect(matchesDiscipline({ category: "Equine Surgery", species: "Equine" }, "Equine Surgery")).toBe(true);
    expect(matchesDiscipline({ category: "Surgery", species: "Equine" }, "Equine Surgery")).toBe(true);
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, "Equine Surgery")).toBe(false);
  });

  it("handles general Internal Medicine matching any internal medicine case", () => {
    expect(matchesDiscipline({ category: "Internal Medicine", species: "Equine" }, "Internal Medicine")).toBe(true);
    expect(matchesDiscipline({ category: "Small Animal Internal Medicine", species: "Canine" }, "Internal Medicine")).toBe(true);
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, "Internal Medicine")).toBe(false);
  });

  it("handles Small Animal Internal Medicine matching canine/feline internal medicine cases", () => {
    expect(matchesDiscipline({ category: "Small Animal Internal Medicine", species: "Canine" }, "Small Animal Internal Medicine")).toBe(true);
    expect(matchesDiscipline({ category: "Internal Medicine", species: "Canine" }, "Small Animal Internal Medicine")).toBe(true);
    expect(matchesDiscipline({ category: "Internal Medicine", species: "Equine" }, "Small Animal Internal Medicine")).toBe(false);
  });

  it("handles Infectious Disease and Equine Infectious Disease", () => {
    expect(matchesDiscipline({ category: "Infectious Disease", species: "Canine" }, "Infectious Disease")).toBe(true);
    expect(matchesDiscipline({ category: "Equine Infectious Disease", species: "Equine" }, "Infectious Disease")).toBe(true);
    expect(matchesDiscipline({ category: "Equine Infectious Disease", species: "Equine" }, "Equine Infectious Disease")).toBe(true);
    expect(matchesDiscipline({ category: "Infectious Disease", species: "Canine" }, "Equine Infectious Disease")).toBe(false);
  });

  it("handles Large Animal and Food Animal Production Medicine", () => {
    expect(matchesDiscipline({ category: "Large Animal", species: "Horse" }, "Large Animal")).toBe(true);
    expect(matchesDiscipline({ category: "Food Animal Production Medicine", species: "Bovine" }, "Large Animal")).toBe(true);
    expect(matchesDiscipline({ category: "Surgery", species: "Canine" }, "Large Animal")).toBe(false);
  });
});
