<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
} from "vue";
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
  request,
  setTabTitle,
} from "@beekeeperstudio/plugin";
import { useSchema, type SchemaStreamOptions } from "./composables/useSchema";
import { useDebug } from "./composables/useDebug";
import type { MenuItem } from "primevue/menuitem";
import ContextMenuContainer from "@/components/ContextMenuContainer.vue";
import { isDevMode, isSupportedDatabase, isSystemSchema } from "./config";
import DiagramScrollbar from "./components/DiagramScrollbar.vue";

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

async function initialize(options?: {
  schemas?: string[];
  streamOptions?: SchemaStreamOptions;
}) {
  if (state.value !== "uninitialized" && state.value !== "ready") {
    console.warn(
      "can only initialize when the state is `ready` or `uninitialized`.",
    );
    return;
  }

  state.value = "initializing";

  try {
    const allKeys: ColumnReference[] = [];
    abortController = new AbortController();

    async function processStream(iter: ReturnType<typeof stream>) {
      for await (const { entities, keys } of iter) {
        allKeys.push(...keys);
        await diagram.addEntities(entities);
        await nextTick();
        diagram.layout();
      }
    }

    if (options?.schemas) {
      for (const schema of options.schemas) {
        await processStream(
          stream({
            signal: abortController.signal,
            schema: {
              name: schema,
            },
            ...options.streamOptions,
          }),
        );
      }
    } else {
      await processStream(
        stream({
          signal: abortController.signal,
          ...options?.streamOptions,
        }),
      );
    }

    await diagram.addKeys(allKeys);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 250));
    diagram.layout();
    await nextTick();
    diagram.layoutSchema();
    await nextTick();
    diagram.fitView();
  } catch (e) {
    console.error(e);
  }

  state.value = "ready";
}

const container = useTemplateRef<HTMLElement>("container");
const containerWidth = ref(0);
const containerHeight = ref(0);

onMounted(async () => {
  const connection = await getConnectionInfo();
  const viewContext = await getViewContext();
  const databaseType = connection.databaseType;

  if (!isSupportedDatabase(databaseType)) {
    return;
  }

  if (viewContext.command === "openTableStructureSchema") {
    await initialize({
      streamOptions: {
        table: {
          // @ts-expect-error
          schema: viewContext.params.entity.schema,
          // @ts-expect-error
          name: viewContext.params.entity.name,
        },
      },
    });
    // @ts-expect-error
    await setTabTitle(viewContext.params.entity.name);
  } else {
    const schemas = await request({ name: "getSchemas" }).then((ss) =>
      ss
        .filter((schema: string) => schema !== connection.defaultSchema)
        .filter((schema: string) => !isSystemSchema(databaseType, schema)),
    );
    await initialize({ schemas: [connection.defaultSchema, ...schemas] });
  }

  const el = container.value;
  containerWidth.value = el!.clientWidth;
  containerHeight.value = el!.clientHeight;

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
      ...(isDevMode
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
  <div class="schema-diagram-container" ref="container">
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

    <div class="debug-panel" v-if="debug.isDebuggingUI">
      <h2>Debug Panel</h2>
      <section>
        <h3>Viewport</h3>
        <ul>
          <li>x={{ diagram.viewport.x }}</li>
          <li>y={{ diagram.viewport.y }}</li>
          <li>zoom={{ diagram.viewport.zoom }}</li>
        </ul>
      </section>
      <section>
        <h3>rectOfDiagram</h3>
        <ul>
          <li>x={{ diagram.rectOfDiagram.x }}</li>
          <li>y={{ diagram.rectOfDiagram.y }}</li>
          <li>width={{ diagram.rectOfDiagram.width }}</li>
          <li>height={{ diagram.rectOfDiagram.height }}</li>
        </ul>
      </section>
    </div>

    <DiagramScrollbar :container-width="containerWidth" :container-height="containerHeight" />
  </div>
  <ContextMenuContainer />
</template>
