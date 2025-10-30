<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import SchemaDiagram from "@/components/SchemaDiagram.vue";
import {
  type ColumnReference,
  type EntitySchema,
  getHandleId,
  useSchemaDiagram,
} from "@/composables/useSchemaDiagram";
import {
  getColumns,
  getConnectionInfo,
  getTableKeys,
  getTables,
} from "@beekeeperstudio/plugin";

const ENTITY_BATCH_SIZE = 20;

const diagram = useSchemaDiagram();
const progress = ref(0);

onMounted(async () => {
  const connection = await getConnectionInfo();
  const tables = await getTables(connection.defaultSchema);

  let entityBatch: EntitySchema[] = [];
  let referenceBatch: ColumnReference[] = [];

  async function flushEntities() {
    if (entityBatch.length === 0) {
      return;
    }
    await diagram.addEntities(entityBatch);
    await nextTick();
    diagram.layout();
    entityBatch = [];
  }

  async function flushReferences() {
    const availableReferences = referenceBatch;
    if (availableReferences.length === 0) {
      return;
    }
    await diagram.addReferences(availableReferences);
    await nextTick();
    diagram.layout();
    referenceBatch = referenceBatch.filter((reference) => {
      return !availableReferences.includes(reference);
    });
  }

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]!;

    const entity: EntitySchema = {
      name: table.name,
      schema: table.schema,
      type: "table",
      columns: [],
    };

    try {
      entity.columns = await getColumns(table.name, table.schema).then(
        (columns) => {
          return columns.map((column) => ({
            name: column.name,
            type: column.type,
            handleId: getHandleId({
              entity,
              column: {
                name: column.name,
              },
            }),
          }));
        },
      );
    } catch (error) {
      // TODO show helpful error here
      console.error(error);
    }

    entityBatch.push(entity);

    if (entityBatch.length >= ENTITY_BATCH_SIZE) {
      await flushEntities();
    }

    progress.value = Math.round(((i + 0.5) / tables.length) * 100);

    try {
      const keys = await getTableKeys(table.name, table.schema);
      for (const key of keys) {
        referenceBatch.push({
          from: {
            entity: {
              name: key.fromTable,
              schema: key.fromSchema,
            },
            // FIXME wont work for composite keys
            column: { name: key.fromColumn.toString() },
          },
          to: {
            entity: {
              name: key.toTable,
              schema: key.toSchema,
            },
            // FIXME wont work for composite keys
            column: { name: key.toColumn.toString() },
          },
        });
      }
    } catch (error) {
      // TODO show helpful error here
      console.error(error);
    }

    progress.value = Math.round(((i + 1) / tables.length) * 100);
  }

  await flushEntities();
  await flushReferences();
  await nextTick();

  diagram.layout();
});
</script>

<template>
  <div class="schema-diagram-container" style="position: relative">
    <SchemaDiagram />
    <div v-if="progress < 100" style="
        position: absolute;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        padding: 1rem;
        background-color: color-mix(
          in srgb,
          var(--theme-base) 10%,
          var(--query-editor-bg)
        );
        border-radius: 6px;
        box-shadow: 0 0 0.5rem var(--query-editor-bg);
      ">
      Loading {{ progress }}%
    </div>
  </div>
</template>
