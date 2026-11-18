import type { MembershipRole } from "@cuentalibre/contracts";

import type { AiProvider, ChatProvider } from "./ai";
import type { AiLimits } from "./ai/readings";
import type { Auth } from "./auth";
import type { Billing } from "./billing";
import type { Mailer } from "./email/mailer";
import type { Db } from "./db/client";
import type { FileStorage } from "./storage";

type SessionData = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

export interface HelpChat {
  provider: ChatProvider;
  /** Its rules and the documentation it answers from. */
  prompt: string;
  dailyQuestions: number;
}

/** Variables that middleware puts on the request context. */
export interface AppEnv {
  Variables: {
    db: Db;
    storage: FileStorage;
    /** Sends email; null when the instance has no mail server. */
    mailer: Mailer | null;
    /** Reads documents with an AI model; null when the instance has none set up. */
    ai: AiProvider | null;
    /** The help chat: its model, system prompt and daily limit per organization (0 means none); null when off. */
    chat: HelpChat | null;
    /** Most documents an organization may read with AI a month (0 means no limit), and the model's prices. */
    aiLimits: AiLimits;
    /** Charging for Cloud; null when the instance doesn't bill. */
    billing: Billing | null;
    /** Whether new passwords are checked against data breaches. */
    checkBreachedPasswords: boolean;
    /** Most recipients an organization's emails reach in a day and in 30 days; 0 means no limit. */
    emailQuota: { daily: number; monthly: number };
    /** Largest file that can be uploaded, in bytes. */
    fileMaxBytes: number;
    /** Most bytes an organization's files may take in all; 0 means no limit. */
    fileQuotaBytes: number;
    user: SessionData["user"] | null;
    /** The browser session; null when the request authenticates with an API key. */
    session: SessionData["session"] | null;
    /** The organization the request is scoped to: the session's, or the API key's. */
    activeOrganizationId: string | null;
    /** Set when the request authenticates with an API key. */
    apiKeyId: string | null;
    /** The client's IP address, set by `identifyClient`. */
    clientIp: string;
    /** Set by `requireOrganization`. */
    organizationId: string;
    role: MembershipRole;
  };
}
