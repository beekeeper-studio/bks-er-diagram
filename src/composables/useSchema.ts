import {
  getColumns,
  getTableKeys,
  getTables,
  request,
} from "@beekeeperstudio/plugin";
import {
  getHandleId,
  type Column,
  type ColumnReference,
  type ColumnStructure,
  type Entity,
  type EntityStructure,
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

type ColumnStructureId =
  | `${SchemaName}.${EntityName}.${ColumnName}`
  | `${EntityName}.${ColumnName}`;

type BaseSchemaStreamOptions = {
  /**
   * If the sum of entities and keys in the batch is more than this value, it
   * will be yielded.
   *
   * @default 100
   */
  minBatchSize?: number;
  /**
   * Name of the schema to stream.
   *
   * If omitted, the default schema will be used.
   */
  schema?: string;
  /**
   * The signal to cancel the stream.
   */
  signal?: AbortSignal;
};

export type SchemaStreamOptions =
  | BaseSchemaStreamOptions
  | (BaseSchemaStreamOptions & {
    /**
     * The name of a specific entity to stream.
     *
     * If omitted, all entities in the schema will be streamed.
     * If provided, only that entity and its related entities
     * (based on `depth`) will be streamed.
     *
     * @todo NOT IMPLEMENTED
     */
    entity: string;
    /**
     * How many levels of related entities to include.
     *
     * - `0` = only the specified entity.
     * - `1` = include directly related entities (default).
     * - `2+` = include deeper relationships.
     *
     * Can only be specified if `entity` is provided.
     *
     * @default 1
     * @todo NOT IMPLEMENTED
     */
    depth?: number;
  });

function getColumnStructureId(
  entity: Entity,
  column: string,
): ColumnStructureId {
  return entity.schema
    ? (`${entity.schema}.${entity.name}.${column}` as const)
    : (`${entity.name}.${column}` as const);
}

export const useSchema = defineStore("schema", () => {
  const progress = shallowRef(0);
  const isStreaming = shallowRef(false);
  const columnStructureMap = shallowRef(
    new Map<ColumnStructureId, ColumnStructure>(),
  );

  function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
  }

  /** Use this to load the entities and keys in batches.  */
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
      let tables: Entity[];

      if ("entity" in options) {
        tables = [
          {
            name: options.entity,
            schema: options.schema,
          },
        ];
      } else {
        tables = await getTables(options.schema);
      }

      for (let i = 0; i < tables.length; i++) {
        throwIfAborted(options?.signal);

        const entity: EntityStructure = {
          name: tables[i]!.name,
          schema: tables[i]!.schema,
          type: "table",
          columns: [],
        };

        try {
          await fillEntityStructureWithColumns(entity);
        } catch (error) {
          // TODO show helpful error here
          console.error(error);
        }

        progress.value = (i + 0.33) / tables.length;

        throwIfAborted(options?.signal);

        let references: ColumnReference[] = [];

        try {
          references = await findReferencesAndUpdateEntity(entity);
          referenceBatch.push(...references);
        } catch (error) {
          // TODO show helpful error here
          console.error(error);
        }

        entityBatch.push(entity);

        progress.value = (i + 0.66) / tables.length;

        try {
          if ("entity" in options) {
            for (const reference of references) {
              if (!entitiesEqual(reference.from.entity, entity)) {
                const fromEntity: EntityStructure = {
                  ...reference.from.entity,
                  type: "table",
                  columns: [],
                };
                await fillEntityStructureWithColumns(fromEntity);
                await findReferencesAndUpdateEntity(fromEntity);
                entityBatch.push(fromEntity);
              } else if (!entitiesEqual(reference.to.entity, entity)) {
                const toEntity: EntityStructure = {
                  ...reference.to.entity,
                  type: "table",
                  columns: [],
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
  async function fillEntityStructureWithColumns(entity: EntityStructure) {
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
        ordinalPosition: column.ordinalPosition,
        primaryKey: false,
        foreignKey: false,
        uniqueKey: false,
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
    indexes.forEach((index) => {
      index.columns.forEach((c) => {
        const column = findColumnStrucuture({
          entity,
          name: c.name,
        });
        if (column) {
          column.primaryKey = index.primary;
          column.uniqueKey = index.unique;
        }
      });
    });

    // HACK: the demo.db file in beekeeper studio somehow does not have indexes?
    // FIXME make a new function in plugin lib
    const pks = await request({
      name: "getPrimaryKeys",
      args: {
        table: entity.name,
        schema: entity.schema,
      },
    });
    pks.forEach((pk) => {
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
  async function findReferencesAndUpdateEntity(entity: EntityStructure) {
    const references: ColumnReference[] = [];
    const keys = await getTableKeys(entity.name, entity.schema);
    for (const key of keys) {
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
      const thisTableColumn =
        key.direction === "incoming" ? cKey.to.name : cKey.from.name;
      const thisColumn = findColumnStrucuture({
        entity,
        name: thisTableColumn,
      });
      if (thisColumn) {
        thisColumn.hasReferences = true;
        references.push(cKey);
      }

      if (key.direction === "outgoing") {
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
    }
    return references;
  }

  function findColumnStrucuture(column: Column) {
    return columnStructureMap.value.get(
      getColumnStructureId(column.entity, column.name),
    );
  }

  return {
    stream,
    progress: computed(() => progress.value),
    isStreaming: computed(() => isStreaming.value),
    findColumnStrucuture,
    columnStructureMap,
  };
});
