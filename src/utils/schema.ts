import type { Entity } from "@/composables/useSchemaDiagram";

export function entitiesEqual(a: Entity, b: Entity) {
  // @ts-expect-error
  const aSchema = a.schema || "";
  // @ts-expect-error
  const bSchema = b.schema || "";
  return aSchema === bSchema && a.name === b.name;
}
