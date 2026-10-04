import { describe, expect, it } from "vitest";
import { dbErrorKey } from "../db-errors";

describe("dbErrorKey", () => {
  it.each([
    ["Ordering cutoff has passed", "cutoffPassed"],
    ["Offering is not available", "offeringUnavailable"],
    ["You already have an order for this offering; edit it instead", "alreadyOrdered"],
    ["Not enough stock remaining for an item", "noStock"],
    ["Order can no longer be changed", "cannotChange"],
    ["Order not found", "orderNotFound"],
    ["Order must contain at least one item", "emptyOrder"],
    ["Unknown QR code", "unknownQr"],
    ["This order belongs to a different merchant", "otherMerchant"],
    ["This order was cancelled", "orderCancelled"],
    ["Cutoff must be before the pickup start time", "cutoffAfterPickup"],
    ["Not authenticated", "notAuthenticated"],
  ])("maps %s", (msg, key) => {
    expect(dbErrorKey(msg)).toBe(key);
  });
  it("falls back to generic for unknown messages", () => {
    expect(dbErrorKey("new row violates row-level security policy")).toBe("generic");
  });
});
