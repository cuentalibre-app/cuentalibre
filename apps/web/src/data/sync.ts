import type { Change, SyncedEntity, Workspace } from "@fiscalia/contracts";
import type { Collection } from "./collection";

/*
 * The data the server stores. Records the server sends (in the workspace, in
 * answer to commands, or in the change feed) are applied to the stores without
 * being sent back.
 */

/** How the server's records for one entity reach the store that keeps them. */
export interface SyncTarget<T> {
  receive: (item: T) => void;
  /** `id` is the record's ID; for closed quarters, the period. */
  forget: (id: string) => void;
  replace: (items: T[]) => void;
}

const targets = new Map<SyncedEntity, SyncTarget<unknown>>();

/** Lets the server's records for `entity` reach a store. */
export function syncTarget<T>(entity: SyncedEntity, target: SyncTarget<T>) {
  targets.set(entity, target as SyncTarget<unknown>);
}

/** Lets the server's records for `entity` reach the collection. */
export function syncCollection<T extends { id: string }>(entity: SyncedEntity, collection: Collection<T>) {
  syncTarget<T>(entity, { receive: collection.receive, forget: collection.forget, replace: collection.replace });
}

export function isSynced(entity: string): entity is SyncedEntity {
  return targets.has(entity as SyncedEntity);
}

export function applyWorkspace(workspace: Workspace) {
  for (const [entity, target] of targets) target.replace(workspace[entity]);
}

export function applyChanges(changes: Change[]) {
  for (const change of changes) {
    const target = targets.get(change.entity);
    if (!target) continue;
    if (change.op === "upsert") target.receive(change.data);
    else target.forget(change.id);
  }
}
