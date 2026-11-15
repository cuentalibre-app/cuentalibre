import type {
  ApiKey,
  Billing,
  BillingInvoice,
  BillingPeriod,
  CreatedApiKey,
  EmailMessage,
  EmailRequest,
  EmailSender,
  FileListing,
  NewApiKey,
  OrganizationMember,
  ExtractionUsage,
  HelpChatMessage,
  PurchaseExtraction,
} from "@cuentalibre/contracts";
import type { Command } from "./commands";

/**
 * Where commands go. The commands of one call are applied together or not at
 * all, so a change that touches several records can't be half saved.
 */
export interface Backend {
  send(commands: Command[]): Promise<void>;
  /**
   * Stores a file picked as an attachment, under the attachment's ID. Commands
   * upload the files they name before they are sent. Without it, files stay in this browser tab.
   */
  upload?(id: string, file: File): Promise<void>;
  /** Where to open a stored file. */
  fileUrl?(id: string): string;
  /** The organization's stored files, and deleting those no record names. Without a server there are none. */
  files?: {
    list(): Promise<FileListing>;
    delete(id: string): Promise<void>;
  };
  /** Sends an email with these files attached. Without it, the user's mail client sends it. */
  sendEmail?(email: Omit<EmailRequest, "attachments">, files: File[]): Promise<EmailMessage>;
  /** The emails that sent a document, newest first. */
  emailsOf?(documentId: string): Promise<EmailMessage[]>;
  /** Who emails go out from. */
  emailSender?(): Promise<EmailSender>;
  /** The user's API keys for the organization. Without a server there are none. */
  apiKeys?: {
    list(): Promise<ApiKey[]>;
    create(key: NewApiKey): Promise<CreatedApiKey>;
    revoke(id: string): Promise<void>;
  };
  /** The company's Cloud plan. Only on instances that charge for it. */
  billing?: {
    get(): Promise<Billing>;
    /** Where to pay for the period: a Stripe Checkout page. */
    checkout(period: BillingPeriod): Promise<string>;
    /** Where to manage the subscription: Stripe's customer portal. */
    portal(): Promise<string>;
    /** The invoices for the plan's charges, newest first. */
    invoices(): Promise<BillingInvoice[]>;
    /** Where an invoice's PDF opens, in the browser's viewer. */
    pdfUrl(invoiceId: string): string;
  };
  /** Reads a stored PDF or photo with AI: a draft for a received invoice or an expense, nothing saved. */
  extractPurchase?(fileId: string): Promise<PurchaseExtraction>;
  /** Documents read with AI this month, against the server's limit. */
  extractionUsage?(): Promise<ExtractionUsage>;
  /**
   * Asks the help chat the last of `messages`, with the conversation before it, and passes
   * each piece of the answer to `onText` as it is written. Resolves when the answer ends.
   */
  helpChat?(messages: HelpChatMessage[], onText: (text: string) => void, signal?: AbortSignal): Promise<void>;
  /** The people in the organization. Without a server, the sample users stand in. */
  members?(): Promise<OrganizationMember[]>;
}

/** Until there is an API, data lives only in memory and every change is accepted. */
export const localBackend: Backend = {
  send: () => Promise.resolve(),
};

let backend: Backend = localBackend;

/** The backend in use, for the file helpers in `files.ts`. */
export const currentBackend = () => backend;

/** Switches the backend: the API client once there is one, or a fake in tests. */
export function setBackend(next: Backend) {
  backend = next;
}

type ErrorListener = (error: unknown, commands: Command[]) => void;
const errorListeners = new Set<ErrorListener>();

/** Called when the backend rejects a change, after the store has undone it. */
export function onCommandError(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => void errorListeners.delete(listener);
}

/**
 * Sends commands the store has already applied. If the backend rejects them,
 * `undo` takes the store back and the error listeners are told.
 */
export function send(commands: Command[], undo: () => void): Promise<void> {
  if (commands.length === 0) return Promise.resolve();
  return backend.send(commands).catch((error: unknown) => {
    undo();
    errorListeners.forEach((listener) => listener(error, commands));
  });
}
