import { describe, it, expect, vi } from "vitest";

import { retryComBackoff } from "../../src/shared/retry";

describe("retryComBackoff", () => {
  it("retorna na primeira tentativa quando não há erro", async () => {
    const fn = vi.fn(async () => "ok");
    const r = await retryComBackoff(fn, { baseMs: 0 });
    expect(r).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reexecuta até ter sucesso (backoff sem espera nos testes)", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n++;
      if (n < 3) throw new Error("transitório");
      return "ok";
    });
    const r = await retryComBackoff(fn, { tentativas: 5, baseMs: 0 });
    expect(r).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("esgota as tentativas e repassa o último erro", async () => {
    const fn = vi.fn(async () => {
      throw new Error("sempre falha");
    });
    await expect(
      retryComBackoff(fn, { tentativas: 3, baseMs: 0 }),
    ).rejects.toThrow("sempre falha");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
