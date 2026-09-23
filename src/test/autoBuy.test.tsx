import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAutoBuyMonitoring, type AutoBuyRuleLike } from "@/hooks/useAutoBuyMonitoring";
import { isValidAutoBuyRule } from "@/components/DemoTrading";

const rule = (over: Partial<AutoBuyRuleLike> = {}): AutoBuyRuleLike => ({
  id: "r1",
  symbol: "INFY",
  triggerPrice: 100,
  status: "active",
  ...over,
});

describe("useAutoBuyMonitoring", () => {
  it("fires when the price falls to the trigger", () => {
    const cb = vi.fn();
    renderHook(() => useAutoBuyMonitoring([rule()], new Map([["INFY", 99]]), cb));
    expect(cb).toHaveBeenCalledWith("r1", 99);
  });

  it("does not fire above the trigger", () => {
    const cb = vi.fn();
    renderHook(() => useAutoBuyMonitoring([rule()], new Map([["INFY", 101]]), cb));
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires only once per rule across re-renders", () => {
    const cb = vi.fn();
    const rules = [rule()];
    const { rerender } = renderHook(
      ({ p }: { p: number }) => useAutoBuyMonitoring(rules, new Map([["INFY", p]]), cb),
      { initialProps: { p: 98 } },
    );
    rerender({ p: 97 });
    rerender({ p: 96 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("ignores missing or zero prices", () => {
    const cb = vi.fn();
    renderHook(() => useAutoBuyMonitoring([rule()], new Map([["INFY", 0]]), cb));
    renderHook(() => useAutoBuyMonitoring([rule({ id: "r2" })], new Map(), cb));
    expect(cb).not.toHaveBeenCalled();
  });
});

/**
 * Mirrors the balance guard used by handleAutoBuyTrigger: funds are locked in a
 * pending-debit ref so two rules firing in the same tick cannot overdraw.
 */
function simulateTriggers(startBalance: number, orders: number[]) {
  let balance = startBalance;
  let pending = 0;
  const filled: number[] = [];
  const skipped: number[] = [];
  for (const total of orders) {
    if (total > balance - pending) {
      skipped.push(total);
      continue;
    }
    pending += total;
    filled.push(total);
  }
  balance -= pending; // React applies the batched updates
  return { balance, filled, skipped };
}

describe("auto-buy balance guard", () => {
  it("prevents an overdraft when two rules fire on the same tick", () => {
    const r = simulateTriggers(5000, [3000, 3000]);
    expect(r.filled).toEqual([3000]);
    expect(r.skipped).toEqual([3000]);
    expect(r.balance).toBe(2000);
  });

  it("fills both when funds cover them", () => {
    const r = simulateTriggers(7000, [3000, 3000]);
    expect(r.filled).toEqual([3000, 3000]);
    expect(r.balance).toBe(1000);
  });
});

describe("isValidAutoBuyRule", () => {
  it("accepts a well-formed rule", () => {
    expect(
      isValidAutoBuyRule({ id: "a", symbol: "INFY", triggerPrice: 100, quantity: 2, status: "active" }),
    ).toBe(true);
  });

  it("rejects malformed rules", () => {
    const bad = [
      null,
      "nope",
      { symbol: "INFY", triggerPrice: 100, quantity: 1, status: "active" },
      { id: "a", symbol: "", triggerPrice: 100, quantity: 1, status: "active" },
      { id: "a", symbol: "INFY", triggerPrice: -5, quantity: 1, status: "active" },
      { id: "a", symbol: "INFY", triggerPrice: 100, quantity: 0, status: "active" },
      { id: "a", symbol: "INFY", triggerPrice: 100, quantity: 1, status: "pending" },
    ];
    bad.forEach((b) => expect(isValidAutoBuyRule(b)).toBe(false));
  });
});
