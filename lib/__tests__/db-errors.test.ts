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
    ["Past offerings cannot be edited", "pastOfferingLocked"],
    ["Cannot move an offering that has orders", "offeringHasOrdersLocked"],
    ["Offering has orders", "offeringHasOrders"],
    ["Item has orders", "itemHasOrders"],
    ["Limit is below the quantity already ordered (8)", "limitBelowOrdered"],
    ["The new date is in the past", "newDatePast"],
    ["Offering not found", "offeringNotFound"],
    ["An offering must contain at least one item", "emptyOffering"],
    ["Note is too long", "noteTooLong"],
  ])("maps %s", (msg, key) => {
    expect(dbErrorKey(msg)).toBe(key);
  });
  it("falls back to generic for unknown messages", () => {
    expect(dbErrorKey("new row violates row-level security policy")).toBe("generic");
  });
});
