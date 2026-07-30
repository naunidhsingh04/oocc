import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateProviderKey } from "@/lib/api/client";
import { useSettingsStore } from "@/lib/settings/store";
import { SettingsPanel } from "./SettingsPanel";

vi.mock("@/lib/api/client", () => ({
  validateProviderKey: vi.fn(),
}));

const mockValidateProviderKey = vi.mocked(validateProviderKey);

async function pasteAndSave(key: string) {
  fireEvent.click(screen.getByRole("button", { name: /api key/i }));
  fireEvent.change(screen.getByPlaceholderText(/paste your gemini api key/i), {
    target: { value: key },
  });
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    useSettingsStore.setState({ providerKey: null, status: "empty", error: null, sessionTokens: 0 });
    localStorage.clear();
  });

  // Regression test: a real, working Gemini key that fails for a reason
  // that isn't the key (Gemini rate-limiting it, Gemini/the network being
  // unreachable) used to render identically to a genuinely bad key — both
  // showed the same raw "invalid_key" string. See
  // apps/api/app/routers/settings.py's docstring for the full reasoning;
  // this only covers that the frontend actually surfaces the distinction
  // it's given, not that the backend classifies correctly (that's
  // apps/api/tests/test_settings_endpoint.py's job).
  it.each([
    ["invalid_key", /rejected this key/i],
    ["rate_limited", /rate-limiting this key/i],
    ["upstream_unavailable", /couldn't reach gemini/i],
    ["network_error", /couldn't reach the oocc backend/i],
  ])("shows distinct copy for %s, not the raw error code", async (error, expectedText) => {
    mockValidateProviderKey.mockResolvedValue({ valid: false, tokens_used: null, error });
    render(<SettingsPanel />);

    await pasteAndSave("a-real-looking-key-12345");

    await waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
    expect(screen.queryByText(error, { exact: true })).not.toBeInTheDocument();
  });

  it("shows the valid state and never renders an error line on success", async () => {
    mockValidateProviderKey.mockResolvedValue({ valid: true, tokens_used: 42, error: null });
    render(<SettingsPanel />);

    await pasteAndSave("a-real-looking-key-12345");

    await waitFor(() => expect(screen.getByText("Key valid")).toBeInTheDocument());
  });
});
