import {
  getColumns,
  getConnectionInfo,
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

const defaultStreamOptions = {
  minBatchSize: 100,
} satisfies SchemaStreamOptions;

type ColumnName = string;
type EntityName = string;
type SchemaName = string;

type ColumnStructureId =
  | `${SchemaName}.${EntityName}.${ColumnName}`
  | `${EntityName}.${ColumnName}`;

export type SchemaStreamOptions = {
  /**
   * If the sum of entities and keys in the batch is more than this value, it
   * will be yielded.
   *
   * @default 100
   */
  minBatchSize?: number;
  /**
   * The schema to stream. If not provided, the default schema will be used.
   */
  schema?: string;
  /**
   * The signal to abort the stream.
   */
  signal?: AbortSignal;
};

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
  const columnStructureMap = new Map<ColumnStructureId, ColumnStructure>();

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

    const mergedOptions = _.merge(defaultStreamOptions, options);

    isStreaming.value = true;

    try {
      if (!mergedOptions.schema) {
        const connection = await getConnectionInfo();
        mergedOptions.schema = connection.defaultSchema;
      }

      const tables = await getTables(mergedOptions.schema);

      for (let i = 0; i < tables.length; i++) {
        throwIfAborted(options?.signal);

        const entity = tables[i]!;

        const structureId = getColumnStructureId.bind(null, entity);

        const structure: EntityStructure = {
          name: entity.name,
          schema: entity.schema,
          type: "table",
          columns: [],
        };

        try {
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
            };
            columnStructureMap.set(structureId(column.name), columnStructure);
            structure.columns.push(columnStructure);
          });

          const pks = await request({
            name: "getPrimaryKeys",
            args: {
              table: entity.name,
              schema: entity.schema,
            },
          });
          pks.forEach((pk) => {
            const column = columnStructureMap.get(structureId(pk.name));
            if (column) {
              column.primaryKey = true;
            }
          });
        } catch (error) {
          // TODO show helpful error here
          console.error(error);
        }

        progress.value = (i + 0.5) / tables.length;

        throwIfAborted(options?.signal);

        try {
          const keys = await getTableKeys(entity.name, entity.schema);
          for (const key of keys) {
            const cKey: ColumnReference = {
              from: {
                entity: {
                  name: key.fromTable,
                  schema: key.fromSchema,
                },
                // FIXME wont work for composite keys
                name: key.fromColumn.toString(),
              },
              to: {
                entity: {
                  name: key.toTable,
                  schema: key.toSchema,
                },
                // FIXME wont work for composite keys
                name: key.toColumn.toString(),
              },
            };
            const thisTableColumn =
              key.direction === "incoming" ? cKey.to.name : cKey.from.name;
            const thisColumn = columnStructureMap.get(
              structureId(thisTableColumn),
            );
            if (thisColumn) {
              thisColumn.hasReferences = true;
            }
            referenceBatch.push(cKey);

            if (key.direction === "outgoing") {
              const fromColumns = Array.isArray(key.fromColumn)
                ? key.fromColumn
                : [key.fromColumn];
              fromColumns.forEach((column) => {
                const columnStructure = columnStructureMap.get(
                  structureId(column),
                );
                if (columnStructure) {
                  columnStructure.foreignKey = true;
                }
              });
            }
          }
        } catch (error) {
          // TODO show helpful error here
          console.error(error);
        }

        entityBatch.push(structure);

        progress.value = (i + 1) / tables.length;

        if (
          entityBatch.length + referenceBatch.length >=
          mergedOptions.minBatchSize
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

  function findColumnStrucuture(column: Column) {
    return columnStructureMap.get(
      getColumnStructureId(column.entity, column.name),
    );
  }

  return {
    stream,
    progress: computed(() => progress.value),
    isStreaming: computed(() => isStreaming.value),
    findColumnStrucuture,
  };
});
