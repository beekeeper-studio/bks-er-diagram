import { getColumns, getTables, request } from "@beekeeperstudio/plugin";
import {
  getHandleId,
  type Column,
  type ColumnReference,
  type ColumnStructure,
  type Entity,
  type EntityStructure,
  type SchemaEntity,
  type SchemaEntityStructure,
  type TableEntity,
  type TableEntityStructure,
} from "./useSchemaDiagram";
import { computed, shallowRef } from "vue";
import _ from "lodash";
import { defineStore } from "pinia";
import { entitiesEqual } from "@/utils/schema";

const defaultStreamOptions = {
  minBatchSize: 100,
} satisfies SchemaStreamOptions;

type ColumnName = string;
type EntityName = string;
type SchemaName = string;

type EntityStructureId = `${SchemaName}.${EntityName}` | `${EntityName}`;

type ColumnStructureId = `${EntityStructureId}.${ColumnName}`;

type BaseSchemaStreamOptions = {
  /**
   * If the sum of entities and keys in the batch is more than this value, it
   * will be yielded.
   *
   * @default 100
   */
  minBatchSize?: number;
  /**
   * The signal to cancel the stream.
   */
  signal?: AbortSignal;
};

export type SchemaStreamOptions =
  | (BaseSchemaStreamOptions & {
    /**
     * A specific table entity to stream.
     */
    table: TableEntity;
    /**
     * How many levels of related entities to include.
     *
     * - `0` = only the specified entity.
     * - `1` = include directly related entities (default).
     * - `>1` = include deeper relationships.
     *
     * Can only be specified if `entity` is provided.
     *
     * @default 1
     * @todo NOT IMPLEMENTED
     */
    depth?: number;
  })
  | (BaseSchemaStreamOptions & {
    /**
     * Stream all entities in this schema if specified.
     */
    schema?: SchemaEntity;
  });

function getColumnStructureId(
  table: TableEntity,
  column: string,
): ColumnStructureId {
  return `${getEntityStructureId("table", table)}.${column}`;
}

function getEntityStructureId(
  type: "table",
  entity: TableEntity,
): EntityStructureId;
function getEntityStructureId(
  type: "schema",
  entity: SchemaEntity,
): EntityStructureId;
function getEntityStructureId(
  type: "table" | "schema",
  entity: Entity,
): EntityStructureId {
  if (type === "schema") {
    return entity.name;
  }
  // @ts-expect-error
  return entity.schema ? `${entity.schema}.${entity.name}` : entity.name;
}

export const useSchema = defineStore("schema", () => {
  const progress = shallowRef(0);
  const isStreaming = shallowRef(false);
  const columnStructureMap = shallowRef(
    new Map<ColumnStructureId, ColumnStructure>(),
  );
  const entityStructureMap = shallowRef(
    new Map<EntityStructureId, EntityStructure>(),
  );

  function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
  }

  /** Load entities and keys in batches.  */
  async function* stream(options?: SchemaStreamOptions): AsyncGenerator<{
    entities: EntityStructure[];
    keys: ColumnReference[];
  }> {
    throwIfAborted(options?.signal);

    let entityBatch: EntityStructure[] = [];
    let referenceBatch: ColumnReference[] = [];

    options = _.merge(defaultStreamOptions, options);

    isStreaming.value = true;

    try {
      let tables: TableEntity[];

      if ("table" in options) {
        tables = [
          {
            name: options.table.name,
            schema: options.table.schema,
          },
        ];
      } else {
        tables = await getTables(options.schema?.name);
      }

      for (let i = 0; i < tables.length; i++) {
        throwIfAborted(options?.signal);

        const table: EntityStructure = {
          name: tables[i]!.name,
          schema: tables[i]!.schema,
          type: "table",
          columns: [],
          isComposite: false,
        };

        let schema: SchemaEntityStructure | undefined;

        if (table.schema) {
          const foundSchema = findEntityStructure("schema", {
            name: table.schema,
          });

          if (!foundSchema) {
            schema = {
              name: table.schema,
              type: "schema",
              entities: [],
            };
            entityBatch.push(schema);
            entityStructureMap.value.set(
              getEntityStructureId("schema", schema),
              schema,
            );
          } else {
            schema = foundSchema;
          }
        }

        try {
          await fillEntityStructureWithColumns(table);
        } catch (error) {
          // TODO show helpful error here
          console.error(error);
        }

        progress.value = (i + 0.33) / tables.length;

        throwIfAborted(options?.signal);

        let references: ColumnReference[] = [];

        try {
          references = await findReferencesAndUpdateEntity(table);
          referenceBatch.push(...references);
        } catch (error) {
          // TODO show helpful error here
          console.error(error);
        }

        entityBatch.push(table);
        entityStructureMap.value.set(
          getEntityStructureId("table", table),
          table,
        );
        if (schema) {
          schema.entities.push(table);
        }

        progress.value = (i + 0.66) / tables.length;

        try {
          if ("entity" in options) {
            for (const reference of references) {
              if (!entitiesEqual(reference.from.entity, table)) {
                const fromEntity: EntityStructure = {
                  ...reference.from.entity,
                  type: "table",
                  columns: [],
                  isComposite: false,
                };
                await fillEntityStructureWithColumns(fromEntity);
                await findReferencesAndUpdateEntity(fromEntity);
                entityBatch.push(fromEntity);
              } else if (!entitiesEqual(reference.to.entity, table)) {
                const toEntity: EntityStructure = {
                  ...reference.to.entity,
                  type: "table",
                  columns: [],
                  isComposite: false,
                };
                await fillEntityStructureWithColumns(toEntity);
                await findReferencesAndUpdateEntity(toEntity);
                entityBatch.push(toEntity);
              }
            }
          }
        } catch (error) {
          // TODO show helpful error here
          console.error(error);
        }

        progress.value = (i + 1) / tables.length;

        if (
          entityBatch.length + referenceBatch.length >=
          options.minBatchSize!
        ) {
          yield {
            entities: entityBatch,
            keys: referenceBatch,
          };

          entityBatch = [];
          referenceBatch = [];
        }
      }
      if (entityBatch.length + referenceBatch.length > 0) {
        yield {
          entities: entityBatch,
          keys: referenceBatch,
        };
      }
    } catch (error) {
      throw error;
    } finally {
      isStreaming.value = false;
    }
  }

  /** Mutate `entity` structure by filling the `columns` array and setting the `columnStructureMap`. */
  async function fillEntityStructureWithColumns(entity: TableEntityStructure) {
    const columns = await getColumns(entity.name, entity.schema);

    columns.forEach((column) => {
      const columnStructure: ColumnStructure = {
        entity,
        name: column.name,
        type: column.type,
        handleId: getHandleId({
          entity,
          name: column.name,
        }),
        hasReferences: false,
        // @ts-expect-error not fully typed
        ordinalPosition: column.ordinalPosition,
        primaryKey: false,
        foreignKey: false,
        uniqueKey: false,
        // @ts-expect-error not fully typed
        nullable: column.nullable ?? false,
      };
      columnStructureMap.value.set(
        getColumnStructureId(entity, column.name),
        columnStructure,
      );
      entity.columns.push(columnStructure);
    });

    // FIXME make a new function in plugin lib
    const indexes = await request({
      name: "getTableIndexes",
      args: {
        table: entity.name,
        schema: entity.schema,
      },
    });
    let pkCount = 0;
    indexes.forEach((index: any) => {
      index.columns.forEach((c: any) => {
        const column = findColumnStrucuture({
          entity,
          name: c.name,
        });
        if (column) {
          column.primaryKey = index.primary;
          column.uniqueKey = index.unique;
          if (index.primary) {
            pkCount++;
          }
        }
      });
    });

    if (pkCount > 1) {
      entity.isComposite = true;
    }

    // HACK: the demo.db file in beekeeper studio somehow does not have indexes?
    // FIXME make a new function in plugin lib
    const pks = await request({
      name: "getPrimaryKeys",
      args: {
        table: entity.name,
        schema: entity.schema,
      },
    });
    if (pks.length > 1) {
      entity.isComposite = true;
    }
    pks.forEach((pk: any) => {
      const column = findColumnStrucuture({
        entity,
        name: pk.name,
      });
      if (column) {
        column.primaryKey = true;
      }
    });
  }

  /** Mutate `entity` structure by filling the `hasReferences` and `foreignKey` properties. */
  async function findReferencesAndUpdateEntity(entity: TableEntityStructure) {
    const references: ColumnReference[] = [];
    const incomingKeys = await request({
      name: "getIncomingKeys",
      args: {
        table: entity.name,
        schema: entity.schema,
      },
    });
    for (const key of incomingKeys) {
      const cKey: ColumnReference = {
        from: {
          entity: {
            name: key.fromTable,
            schema: key.fromSchema,
          },
          // FIXME composite key is untested
          name: key.fromColumn.toString(),
        },
        to: {
          entity: {
            name: key.toTable,
            schema: key.toSchema,
          },
          // FIXME composite key is untested
          name: key.toColumn.toString(),
        },
      };
      const thisTableColumn = cKey.to.name;
      const thisColumn = findColumnStrucuture({
        entity,
        name: thisTableColumn,
      });
      if (thisColumn) {
        thisColumn.hasReferences = true;
        references.push(cKey);
      }
    }
    const outgoingKeys = await request({
      name: "getOutgoingKeys",
      args: {
        table: entity.name,
        schema: entity.schema,
      },
    });
    console.log({entity, outgoingKeys, incomingKeys})
    for (const key of outgoingKeys) {
      const cKey: ColumnReference = {
        from: {
          entity: {
            name: key.fromTable,
            schema: key.fromSchema,
          },
          // FIXME composite key is untested
          name: key.fromColumn.toString(),
        },
        to: {
          entity: {
            name: key.toTable,
            schema: key.toSchema,
          },
          // FIXME composite key is untested
          name: key.toColumn.toString(),
        },
      };
      const thisTableColumn = cKey.from.name;
      const thisColumn = findColumnStrucuture({
        entity,
        name: thisTableColumn,
      });
      if (thisColumn) {
        thisColumn.hasReferences = true;
        references.push(cKey);
      }

      const fromColumns = Array.isArray(key.fromColumn)
        ? key.fromColumn
        : [key.fromColumn];
      fromColumns.forEach((column) => {
        const columnStructure = findColumnStrucuture({
          entity,
          name: column,
        });
        if (columnStructure) {
          columnStructure.foreignKey = true;
        }
      });
    }
    return references;
  }

  function findColumnStrucuture(column: Column) {
    return columnStructureMap.value.get(
      getColumnStructureId(column.entity, column.name),
    );
  }

  function findEntityStructure(
    type: "table",
    entity: TableEntity,
  ): TableEntityStructure;
  function findEntityStructure(
    type: "schema",
    entity: SchemaEntity,
  ): SchemaEntityStructure;
  function findEntityStructure(
    type: "table" | "schema",
    entity: Entity,
  ): EntityStructure | undefined {
    if (type === "schema") {
      return entityStructureMap.value.get(
        getEntityStructureId("schema", entity),
      );
    }
    return entityStructureMap.value.get(getEntityStructureId("table", entity));
  }

  return {
    stream,
    progress: computed(() => progress.value),
    isStreaming: computed(() => isStreaming.value),
    findColumnStrucuture,
    findEntityStructure,
    columnStructureMap,
  };
});
