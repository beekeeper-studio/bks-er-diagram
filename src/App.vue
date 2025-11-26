<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useTemplateRef,
} from "vue";
import SchemaDiagram from "@/components/SchemaDiagram.vue";
import { useSchemaDiagram, type DiagramState } from "@/composables/useSchemaDiagram";
import type { ColumnReference } from "@/utils/schema";
import {
  addNotificationListener,
  getConnectionInfo,
  getData,
  getViewContext,
  removeNotificationListener,
  request,
  setData,
  setTabTitle as rawSetTabTitle,
  type PluginViewContext,
  getAppInfo,
} from "@beekeeperstudio/plugin";
import { useSchema, type SchemaStreamOptions } from "./composables/useSchema";
import { useDebug } from "./composables/useDebug";
import type { MenuItem } from "primevue/menuitem";
import ContextMenuContainer from "@/components/ContextMenuContainer.vue";
import { isDevMode, isSupportedDatabase, isSystemSchema } from "./config";
import DiagramScrollbar from "./components/DiagramScrollbar.vue";
import Dialog from "primevue/dialog";
import ExportDialog from "@/components/ExportDialog.vue";
import AboutDialog from "@/components/AboutDialog.vue";
import lt from "semver/functions/lt";
import manifest from "../manifest.json";

async function setTabTitle(title: string) {
  await rawSetTabTitle(title.trimEnd() + " - ERD");
}

const diagram = useSchemaDiagram();
const schemaStore = useSchema();
const state = ref<"uninitialized" | "initializing" | "aborting" | "ready">(
  "uninitialized",
);
const exportDialogVisible = shallowRef(false);
const aboutDialogVisible = shallowRef(false);
const warningDialogVisible = shallowRef(false);
const debug = useDebug();
const totalSchema = shallowRef(1);
const loadingSchemaIndex = shallowRef(0);
const progress = computed(
  () =>
    loadingSchemaIndex.value / totalSchema.value +
    (1 / totalSchema.value) * schemaStore.progress,
);

let abortController: AbortController | undefined;
let viewContext: PluginViewContext | undefined;
// FIXME add a new type from @beekeeperstudio/plugin
let connection: Awaited<ReturnType<typeof getConnectionInfo>>;

function abort() {
  state.value = "aborting";
  abortController?.abort();
}

async function loadDiagram(options?: {
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

  diagram.initialize();

  try {
    const allKeys: ColumnReference[] = [];
    abortController = new AbortController();

    async function processStream(iter: ReturnType<typeof schemaStore.stream>) {
      for await (const { entities, keys } of iter) {
        allKeys.push(...keys);
        diagram.addEntities(entities);
        await nextTick();
        diagram.layout();
      }
    }

    if (options?.schemas) {
      totalSchema.value = options.schemas.length;
      for (let i = 0; i < options.schemas.length; i++) {
        loadingSchemaIndex.value = i;
        await processStream(
          schemaStore.stream({
            signal: abortController.signal,
            schema: {
              name: options.schemas[i]!,
            },
            ...options.streamOptions,
          }),
        );
      }
    } else {
      totalSchema.value = 1;
      loadingSchemaIndex.value = 0;
      await processStream(
        schemaStore.stream({
          signal: abortController.signal,
          ...options?.streamOptions,
        }),
      );
    }

    diagram.addKeys(allKeys);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 250));

    const diagramState = await getDiagramState();
    if (diagramState) {
      diagram.setDiagramState(diagramState);
    } else {
      diagram.layout();
      await nextTick();
      diagram.layoutSchema();
    }

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

/** Unlike onMounted(), this can be called multiple times via reload(). */
async function initialize() {
  const databaseType = connection.databaseType;

  if (!isSupportedDatabase(databaseType)) {
    return;
  }

  diagram.emitter.on("position-changed", saveDiagramState);
  diagram.emitter.on("nodes-updated-hidden", saveDiagramState);

  if (viewContext!.command === "showOneTable") {
    await loadDiagram({
      streamOptions: {
        table: {
          // @ts-expect-error
          schema: viewContext.params.entity.schema,
          // @ts-expect-error
          name: viewContext.params.entity.name,
        },
      },
    });
  } else if (viewContext!.command === "showOneSchema") {
    // @ts-expect-error
    await loadDiagram({ schemas: [viewContext?.params?.entity.name] });
  } else {
    const schemas = await request({ name: "getSchemas" }).then((ss) =>
      ss
        .filter((schema: string) => schema !== connection.defaultSchema)
        .filter((schema: string) => !isSystemSchema(databaseType, schema)),
    );
    await loadDiagram({ schemas: [connection.defaultSchema, ...schemas] });
  }
}

function reload() {
  diagram.emitter.off("position-changed", saveDiagramState);
  diagram.emitter.off("nodes-updated-hidden", saveDiagramState);
  diagram.$reset();
  schemaStore.$reset();
  nextTick(() => initialize());
}

let diagramStateId: string;

async function saveDiagramState() {
  return await setData(`diagram-state-${diagramStateId}`, diagram.getDiagramState());
}

async function getDiagramState(): Promise<DiagramState | null> {
  const data = await getData(`diagram-state-${diagramStateId}`);
  if (data && typeof data === 'object' && 'version' in data && 'entities' in data) {
    return data as DiagramState;
  }
  return null;
}

/** Everyhing that should be done once goes here */
onMounted(async () => {
  // Check version compatibility
  if (!import.meta.env.DEV) {
    try {
      const appInfo = await getAppInfo()
      if (lt(appInfo.version, "5.5.0")) {
        warningDialogVisible.value = true;
      }
    } catch (e) {
      console.warn("FAILED to compare app version");
      console.error(e);
    }
  }

  connection = await getConnectionInfo();
  viewContext = await getViewContext();

  const connectionId = `${connection.id}:${connection.workspaceId}` as const;
  let viewId = "default";

  if (viewContext.command === "showOneTable") {
    // @ts-expect-error
    setTabTitle(viewContext.params.entity.name);
    // @ts-expect-error
    viewId = `${viewContext.params.entity.type}:${viewContext.params.entity.schema}:${viewContext.params.entity.name}` as const;
  } else if (viewContext.command === "showOneSchema") {
    // @ts-expect-error
    setTabTitle(viewContext.params.entity.name);
  } else {
    setTabTitle(connection.databaseName);
  }

  diagramStateId = `${connectionId}:${viewId}`;

  await initialize();

  const el = container.value;
  containerWidth.value = el!.clientWidth;
  containerHeight.value = el!.clientHeight;

  /** @ts-expect-error FIXME not fully typed */
  addNotificationListener("tablesChanged", reload);
});

onUnmounted(() => {
  removeNotificationListener("tablesChanged", reload);
});

const menuItems = computed(
  () =>
    [
      {
        label: "Auto Layout",
        icon: "auto_awesome_mosaic",
        async command() {
          diagram.layout();
          await nextTick();
          diagram.layoutSchema();
          await nextTick();
          saveDiagramState();
        },
      },
      {
        label: "Fit to Screen",
        icon: "fit_screen",
        command() {
          diagram.fitView();
        },
      },
      { separator: true },
      {
        label: "Reload Schema",
        icon: "refresh",
        command() {
          reload();
        },
      },
      {
        label: diagram.showAllColumns ? "Show Keys Only" : "Show All Columns",
        command() {
          diagram.toggleShowAllColumns();
        },
      },
      {
        label: "Export as Image",
        icon: "download",
        command() {
          exportDialogVisible.value = true;
        },
      },
      { separator: true },
      {
        label: "About",
        icon: "info",
        command() {
          aboutDialogVisible.value = true;
        },
      },
      ...(isDevMode
        ? ([
          { separator: true },
          {
            label: "[DEV] Toggle Debug UI",
            command() {
              debug.toggleDebugUI();
            },
            icon: debug.isDebuggingUI ? "check" : "",
          },
        ] as MenuItem[])
        : []),
    ] as MenuItem[],
);
</script>

<template>
  <div class="schema-diagram-container" ref="container">
    <SchemaDiagram :menu-items="menuItems" ref="schemaDiagram">
      <!-- <template #panel-bottom-right-end> -->
      <!--   <button class="btn btn-fab btn-flat" @click="aboutDialogVisible = true"> -->
      <!--     <span class="material-symbols-outlined">help</span> -->
      <!--     <span class="title-popup">Help</span> -->
      <!--   </button> -->
      <!-- </template> -->
    </SchemaDiagram>

    <div class="diagram-blur-overlay" v-if="state === 'initializing' || state === 'aborting'" />

    <Dialog v-model:visible="warningDialogVisible" :closable="false" position="top" :modal="true" :draggable="false" dismissable-mask>
      {{ manifest.name }} requires Beekeeper Studio <strong>5.5.0+</strong>. Please upgrade.
      <template #footer>
        <button class="btn" @click="warningDialogVisible = false">OK</button>
      </template>
    </Dialog>

    <ExportDialog v-model:visible="exportDialogVisible" />
    <AboutDialog v-model:visible="aboutDialogVisible" />

    <Dialog :visible="state === 'initializing' || state === 'aborting'" :closable="false" header="Loading schema...">
      <div class="loading-progress" :style="{ '--width': `${progress * 100}%` }" />
      <template #footer>
        <button @click="abort" :disabled="state === 'aborting'" class="btn">
          {{ state === "aborting" ? "Cancelling" : "Cancel" }}
        </button>
      </template>
    </Dialog>

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
