export type TableEntity = {
  name: string;
  schema?: string;
};

export type SchemaEntity = {
  name: string;
};

export type Entity = TableEntity | SchemaEntity;

export type Column = {
  entity: TableEntity;
  name: string;
};

export type ColumnStructure = Column & {
  type?: string;
  handleId: string;
  hasReferences: boolean;
  primaryKey: boolean;
  foreignKey: boolean;
  uniqueKey: boolean;
  nullable: boolean;
  ordinalPosition: number;
};

export type EntityStructure = TableEntityStructure | SchemaEntityStructure;

export type TableEntityStructure = TableEntity & {
  type: "table";
  columns: ColumnStructure[];
  isComposite: boolean;
};

export type SchemaEntityStructure = SchemaEntity & {
  type: "schema";
  entities: EntityStructure[];
};

export type ColumnReference = {
  from: Column;
  to: Column;
};

export function entitiesEqual(a: Entity, b: Entity) {
  // @ts-expect-error
  const aSchema = a.schema || "";
  // @ts-expect-error
  const bSchema = b.schema || "";
  return aSchema === bSchema && a.name === b.name;
}
