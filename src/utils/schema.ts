import type { Entity } from "@/composables/useSchemaDiagram";

export function entitiesEqual(a: Entity, b: Entity) {
  const aSchema = a.schema || "";
  const bSchema = b.schema || "";
  return aSchema === bSchema && a.name === b.name;
}
