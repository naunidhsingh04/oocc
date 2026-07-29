import { beforeEach, describe, expect, it } from "vitest";
import { hasTourBeenSeen, markTourSeen } from "./store";

describe("onboarding tour storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts unseen and becomes seen after marking", () => {
    expect(hasTourBeenSeen()).toBe(false);
    markTourSeen();
    expect(hasTourBeenSeen()).toBe(true);
  });
});
