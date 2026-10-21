import type { Change, OrganizationSettings, SettingsSection, SyncedEntity, Workspace } from "@cuentalibre/contracts";
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

/**
 * A target for a list of records kept inside a bigger store, such as the
 * products of the catalog. `order` sorts the list after every change.
 */
export function listTarget<T extends { id: string }>(
  read: () => T[],
  write: (items: T[]) => void,
  order: (items: T[]) => T[] = (items) => items,
): SyncTarget<T> {
  return {
    receive(item) {
      const known = read().some((other) => other.id === item.id);
      write(order(known ? read().map((other) => (other.id === item.id ? item : other)) : [...read(), item]));
    },
    forget(id) {
      if (read().some((item) => item.id === id)) write(read().filter((item) => item.id !== id));
    },
    replace: (items) => write(order(items)),
  };
}

const settingsTargets = new Map<SettingsSection, (data: unknown) => void>();

/** Lets the server's version of a settings section reach the store that keeps it. */
export function syncSettings<S extends SettingsSection>(section: S, apply: (data: OrganizationSettings[S]) => void) {
  settingsTargets.set(section, apply as (data: unknown) => void);
}

export function isSynced(entity: string): entity is SyncedEntity {
  return targets.has(entity as SyncedEntity);
}

export function isSettingsSynced(section: string): section is SettingsSection {
  return settingsTargets.has(section as SettingsSection);
}

export function applyWorkspace(workspace: Workspace) {
  for (const [entity, target] of targets) target.replace(workspace[entity]);
  for (const [section, apply] of settingsTargets) apply(workspace.settings[section]);
}

export function applyChanges(changes: Change[]) {
  for (const change of changes) {
    if (change.entity === "settings") {
      if (change.op === "upsert") settingsTargets.get(change.data.section)?.(change.data.data);
      continue;
    }
    const target = targets.get(change.entity);
    if (!target) continue;
    if (change.op === "upsert") target.receive(change.data);
    else target.forget(change.id);
  }
}
