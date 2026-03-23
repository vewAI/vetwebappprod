import { describe, expect, it } from "vitest";
import { isRefreshTokenAuthError } from "../supabase-auth-error-utils";

describe("isRefreshTokenAuthError", () => {
  it("detects refresh_token_not_found by code", () => {
    expect(
      isRefreshTokenAuthError({
        code: "refresh_token_not_found",
        message: "Refresh Token Not Found",
      }),
    ).toBe(true);
  });

  it("detects invalid refresh message variants", () => {
    expect(isRefreshTokenAuthError({ message: "Invalid Refresh Token: Refresh Token Not Found" })).toBe(true);
    expect(isRefreshTokenAuthError({ message: "invalid_grant" })).toBe(true);
  });

  it("does not flag unrelated auth errors", () => {
    expect(isRefreshTokenAuthError({ message: "Email not confirmed" })).toBe(false);
    expect(isRefreshTokenAuthError(null)).toBe(false);
  });
});
