import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useResilientLoad } from "../useResilientLoad";

describe("useResilientLoad", () => {
  it("resolve com dados quando o loader sucede", async () => {
    const loader = vi.fn().mockResolvedValue({ ok: true, n: 1 });
    const { result } = renderHook(() => useResilientLoad(loader, []));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toEqual({ ok: true, n: 1 });
    expect(result.current.error).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("expõe erro e permite reload manual", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useResilientLoad(loader, []));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("boom");

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toEqual({ ok: true });
  });

  it("aplica timeout duro quando o loader trava", async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockImplementation(
      () => new Promise(() => {}), // nunca resolve
    );
    const { result } = renderHook(() =>
      useResilientLoad(loader, [], { timeoutMs: 50, label: "test" }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toMatch(/timeout/i);
    vi.useRealTimers();
  });
});
