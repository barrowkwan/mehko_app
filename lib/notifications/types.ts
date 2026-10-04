import type { Locale } from "../locale";
import type { EmailType, RenderInput } from "./templates";

export type OutboxRow = { id: string; user_id: string; type: EmailType; entity_id: string; attempts: number };

export type Recipient = { email: string | null; name: string | null; locale: Locale; wantsEmail: boolean };

// What the store resolves for an outbox row at send time: who gets it and what it says — or why to skip it.
export type Loaded = { recipient: Recipient; content: RenderInput } | { skip: string };
