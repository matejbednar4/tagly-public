import { UID_PREFIX, UidEntity } from "@tagly/models/shared";

const PREFIX_TO_ENTITY: Record<string, UidEntity> = Object.entries(
  UID_PREFIX
).reduce(
  (acc, [entity, prefix]) => {
    acc[prefix] = entity as UidEntity;
    return acc;
  },
  {} as Record<string, UidEntity>
);

export function getEntityFromUid(uid: string): UidEntity | null {
  if (!uid) return null;

  const prefix = uid.split("-")[0];
  return PREFIX_TO_ENTITY[prefix] ?? null;
}
