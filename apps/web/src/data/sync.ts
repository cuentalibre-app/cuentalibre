import type { Change, SyncedEntity, Workspace } from "@fiscalia/contracts";
import type { Collection } from "./collection";

/*
 * The collections the server stores. Records the server sends (in the
 * workspace, in answer to commands, or in the change feed) are applied to them
 * without being sent back.
 */

interface Target {
  receive: (item: unknown) => void;
  forget: (id: string) => void;
  replace: (items: unknown[]) => void;
}

const targets = new Map<SyncedEntity, Target>();

/** Lets the server's records for `entity` reach the collection. */
export function syncCollection<T extends { id: string }>(entity: SyncedEntity, collection: Collection<T>) {
  targets.set(entity, {
    receive: (item) => collection.receive(item as T),
    forget: collection.forget,
    replace: (items) => collection.replace(items as T[]),
  });
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
