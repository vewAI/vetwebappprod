import assert from "assert";
import React from "react";
import { PersonaTabs } from "../components/PersonaTabs";

test("PersonaTabs renders and exposes tabs and handles interactions", () => {
  let last: any = null;
  const onChange = (k: any) => { last = k; };
  const el = PersonaTabs({ activePersona: "owner", onChange } as any);
  assert.ok(el);
  // container should be a tablist
  assert.equal((el as any).props.role, "tablist");

  const children = (el as any).props.children;
  // first child is OWNER button
  const ownerBtn = children[0];
  const nurseBtn = children[1];
  assert.equal(ownerBtn.props.role, "tab");
  assert.equal(ownerBtn.props["aria-selected"], true);
  assert.equal(ownerBtn.props["data-testid"], "persona-owner");

  // clicking owner should call onChange('owner')
  ownerBtn.props.onClick();
  assert.equal(last, "owner");

  // clicking nurse should call onChange('veterinary-nurse')
  nurseBtn.props.onClick();
  assert.equal(last, "veterinary-nurse");
});
