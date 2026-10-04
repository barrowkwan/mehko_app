import type messages from "../messages/en.json";

export type ErrorKey = keyof typeof messages.errors;

// The database raises English messages (RPCs/triggers). Map the known ones to translation keys so the
// UI can show them in the user's language. Order matters: first match wins.
const PATTERNS: [RegExp, ErrorKey][] = [
  [/not authenticated/i, "notAuthenticated"],
  [/past offerings cannot be edited/i, "pastOfferingLocked"],
  [/cannot move an offering that has orders/i, "offeringHasOrdersLocked"],
  [/offering has orders/i, "offeringHasOrders"],
  [/item has orders/i, "itemHasOrders"],
  [/below the quantity already ordered/i, "limitBelowOrdered"],
  [/new date is in the past/i, "newDatePast"],
  [/offering must contain at least one item/i, "emptyOffering"],
  [/note is too long/i, "noteTooLong"],
  [/offering not found/i, "offeringNotFound"],
  [/pickup point not found/i, "pickupPointNotFound"],
  [/pickup point has upcoming orders/i, "pickupPointHasOrders"],
  [/slots must be on the same date/i, "slotsSameDate"],
  [/offering is not available/i, "offeringUnavailable"],
  [/cutoff has passed/i, "cutoffPassed"],
  [/already have an order/i, "alreadyOrdered"],
  [/stock/i, "noStock"],
  [/can no longer be changed/i, "cannotChange"],
  [/order not found/i, "orderNotFound"],
  [/at least one item/i, "emptyOrder"],
  [/invalid quantity/i, "invalidQuantity"],
  [/does not belong to this offering/i, "itemNotInOffering"],
  [/unknown qr/i, "unknownQr"],
  [/different merchant/i, "otherMerchant"],
  [/was cancelled/i, "orderCancelled"],
  [/cutoff must be before/i, "cutoffAfterPickup"],
];

export function dbErrorKey(message: string): ErrorKey {
  return PATTERNS.find(([re]) => re.test(message))?.[1] ?? "generic";
}

// Translates a database/RPC error message; unknown ones become the generic message.
export function translateDbError(t: (key: ErrorKey) => string, message: string): string {
  const key = dbErrorKey(message);
  if (key === "generic") console.error("Unmapped database error:", message);
  return t(key);
}
