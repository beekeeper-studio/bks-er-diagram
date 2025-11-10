<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import SchemaDiagram from "@/components/SchemaDiagram.vue";
import {
  type ColumnReference,
  useSchemaDiagram,
} from "@/composables/useSchemaDiagram";
import {
  addNotificationListener,
  getConnectionInfo,
  getViewContext,
  removeNotificationListener,
  setTabTitle,
} from "@beekeeperstudio/plugin";
import { useSchema } from "./composables/useSchema";
import { useDebug } from "./composables/useDebug";
import type { MenuItem } from "primevue/menuitem";

const diagram = useSchemaDiagram();
const { stream, progress } = useSchema();
const state = ref<"uninitialized" | "initializing" | "aborting" | "ready">(
  "uninitialized",
);
const debug = useDebug();

let abortController: AbortController | undefined;

function abort() {
  state.value = "aborting";
  abortController?.abort();
}

async function initialize(options: { schema?: string; entity?: string }) {
  if (state.value !== "uninitialized" && state.value !== "ready") {
    console.warn(
      "Can only initialize when the state is `ready` or `uninitialized`.",
    );
    return;
  }

  state.value = "initializing";

  try {
    const allKeys: ColumnReference[] = [];

    abortController = new AbortController();

    const iter = stream({ signal: abortController.signal, ...options });

    for await (const { entities, keys } of iter) {
      allKeys.push(...keys);
      await diagram.addEntities(entities);
      await nextTick();
      diagram.layout();
    }

    await diagram.addKeys(allKeys);
    await nextTick();

    await new Promise((resolve) => setTimeout(resolve, 250));
    diagram.layout();

    await nextTick();
    diagram.fitView();
  } catch (e) {
    // FIXME show helpful error
    console.error(e);
  }

  state.value = "ready";
}

onMounted(async () => {
  const connection = await getConnectionInfo();
  const viewContext = await getViewContext();

  if (viewContext.command === "openTableStructureSchema") {
    await initialize({
      schema: viewContext.params.entity.schema,
      entity: viewContext.params.entity.name,
    });
    await setTabTitle(viewContext.params.entity.name);
  } else {
    await initialize({ schema: connection.defaultSchema });
  }

  /** @ts-expect-error FIXME not fully typed */
  addNotificationListener("tablesChanged", initialize);
});

onUnmounted(() => {
  removeNotificationListener("tablesChanged", initialize);
});

const menuItems = computed(
  () =>
    [
      {
        label: "Show all columns",
        command() {
          diagram.showAllColumns = !diagram.showAllColumns;
        },
        icon: diagram.showAllColumns ? "check" : "",
      },
      ...(debug.isDevMode
        ? [
          {
            label: "[DEV] Toggle Debug UI",
            command() {
              debug.toggleDebugUI();
            },
            icon: debug.isDebuggingUI ? "check" : "",
          },
        ]
        : []),
    ] as MenuItem[],
);
</script>

<template>
  <div class="schema-diagram-container">
    <SchemaDiagram :disabled="state === 'initializing' || state === 'aborting'" :menu-items="menuItems" />
    <div v-if="state === 'initializing' || state === 'aborting'" class="loading-progress"
      :style="{ width: `${progress * 100}%` }" />
    <div v-if="state === 'initializing' || state === 'aborting'" style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translateX(-50%) translateY(-50%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        background-color: color-mix(
          in srgb,
          var(--theme-base) 10%,
          var(--query-editor-bg)
        );
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 0 0.5rem var(--query-editor-bg);
      ">
      <span>Loading schema...</span>
      <button @click="abort" :disabled="state === 'aborting'" class="btn btn-flat">
        {{ state === "aborting" ? "Cancelling" : "Cancel" }}
      </button>
    </div>
    <div v-if="debug.isDebuggingUI" style="
        position: absolute;
        top: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      ">
      <div style="
          background-color: var(--query-editor-bg);
          border: 1px solid var(--border-color);
          padding: 0.5rem;
        ">
        <span v-if="diagram.selectedEntities.length === 0">Select an entity to inspect</span>
        <template v-for="entity in diagram.selectedEntities">
          <div>
            <div style="font-weight: bold; margin-bottom: 0.5rem">
              {{ entity.name }}
            </div>
            <ul>
              <li v-for="column in entity.columns" :key="column.name">
                {{ column.name }} {{ column.primaryKey ? "PK" : "" }}
                {{ column.foreignKey ? "FK" : "" }}
                {{ column.uniqueKey ? "UK" : "" }}
              </li>
              <li>Composite: {{ entity.isComposite ? "true" : "false" }}</li>
            </ul>
          </div>
        </template>
      </div>
      <div style="
          background-color: var(--query-editor-bg);
          border: 1px solid var(--border-color);
          padding: 0.5rem;
        ">
        <div style="font-weight: bold; margin-bottom: 0.5rem">
          Edge markers:
        </div>
        <ul>
          <li><span style="color: red">F</span> = From</li>
          <li><span style="color: red">T</span> = To</li>
        </ul>
      </div>
    </div>
  </div>
</template>
