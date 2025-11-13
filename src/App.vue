<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
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

/* =========================================================
   HORIZONTAL SCROLLBAR (elastic)
   ========================================================= */
const worldWidthScreen = computed(
  () => diagram.rectOfDiagram.width * diagram.viewport.zoom,
);
const containerWidthScreen = containerWidth;
const rectLeftScreen = computed(
  () => diagram.rectOfDiagram.x * diagram.viewport.zoom,
);
const maxScrollScreenX = computed(() =>
  Math.max(0, worldWidthScreen.value - containerWidthScreen.value),
);
const baseMaxViewportX = computed(() => rectLeftScreen.value);
const baseMinViewportX = computed(
  () => rectLeftScreen.value - maxScrollScreenX.value,
);
const dynamicMaxViewportX = computed(() =>
  Math.max(baseMaxViewportX.value, diagram.viewport.x),
);
const dynamicMinViewportX = computed(() =>
  Math.min(baseMinViewportX.value, diagram.viewport.x),
);
const scrollRangeScreenX = computed(() => {
  const range = dynamicMaxViewportX.value - dynamicMinViewportX.value;
  return range <= 0 ? containerWidthScreen.value || 1 : range;
});
const scrolledScreenX = computed(
  () => dynamicMaxViewportX.value - diagram.viewport.x,
);
const scrollFracX = computed(() => {
  return scrolledScreenX.value / scrollRangeScreenX.value;
});
const hThumbStyle = computed(() => {
  const total = scrollRangeScreenX.value;
  const visible = containerWidthScreen.value || 1;
  let thumbPercent = (visible / total) * 100;
  thumbPercent = Math.max(5, Math.min(thumbPercent, 100));
  const leftPercent = scrollFracX.value * (100 - thumbPercent);
  return {
    width: thumbPercent + "%",
    left: leftPercent + "%",
  };
});
const dragH = reactive({
  active: false,
  startX: 0,
  startFrac: 0,
  startMax: 0,
  startMin: 0,
});
function startHDrag(e: MouseEvent) {
  dragH.active = true;
  dragH.startX = e.clientX;
  dragH.startFrac = scrollFracX.value;
  dragH.startMax = dynamicMaxViewportX.value;
  dragH.startMin = dynamicMinViewportX.value;
  window.addEventListener("mousemove", onHDrag);
  window.addEventListener("mouseup", stopHDrag);
}
function onHDrag(e: MouseEvent) {
  if (!dragH.active) return;
  const trackPx = containerWidth.value;
  if (!trackPx) return;
  const range = dragH.startMax - dragH.startMin;
  const effectiveRange = range <= 0 ? trackPx : range;

  const ratio = Math.min(1, trackPx / effectiveRange);
  const thumbPx = trackPx * ratio;
  const movablePx = trackPx - thumbPx;
  if (movablePx <= 0) return;

  const dx = e.clientX - dragH.startX;
  let nextFrac = dragH.startFrac + dx / movablePx;
  nextFrac = Math.max(0, Math.min(1, nextFrac));

  const nextScrolledScreenX = nextFrac * effectiveRange;
  const nextViewportX = dragH.startMax - nextScrolledScreenX;

  diagram.setViewport({ ...diagram.viewport, x: nextViewportX });
  diagram.viewport.x = nextViewportX;
}
function stopHDrag() {
  dragH.active = false;
  window.removeEventListener("mousemove", onHDrag);
  window.removeEventListener("mouseup", stopHDrag);
}

/* =========================================================
   VERTICAL SCROLLBAR (elastic) — same idea
   ========================================================= */

// world height in SCREEN px
const worldHeightScreen = computed(
  () => diagram.rectOfDiagram.height * diagram.viewport.zoom,
);
const containerHeightScreen = containerHeight;
// top of diagram in SCREEN px
const rectTopScreen = computed(
  () => diagram.rectOfDiagram.y * diagram.viewport.zoom,
);
// how much we can scroll normally (SCREEN px)
const maxScrollScreenY = computed(() =>
  Math.max(0, worldHeightScreen.value - containerHeightScreen.value),
);
// base range
const baseMaxViewportY = computed(() => rectTopScreen.value); // topmost
const baseMinViewportY = computed(
  () => rectTopScreen.value - maxScrollScreenY.value,
); // bottom-most (likely negative)
// extend to include overshoot
const dynamicMaxViewportY = computed(() =>
  Math.max(baseMaxViewportY.value, diagram.viewport.y),
);
const dynamicMinViewportY = computed(() =>
  Math.min(baseMinViewportY.value, diagram.viewport.y),
);
// total range
const scrollRangeScreenY = computed(() => {
  const range = dynamicMaxViewportY.value - dynamicMinViewportY.value;
  return range <= 0 ? containerHeightScreen.value || 1 : range;
});
// how far we’ve scrolled down, in SCREEN px
const scrolledScreenY = computed(
  () => dynamicMaxViewportY.value - diagram.viewport.y,
);
// fraction
const scrollFracY = computed(() => {
  return scrolledScreenY.value / scrollRangeScreenY.value;
});
// thumb style
const vThumbStyle = computed(() => {
  const total = scrollRangeScreenY.value;
  const visible = containerHeightScreen.value || 1;
  let thumbPercent = (visible / total) * 100;
  thumbPercent = Math.max(5, Math.min(thumbPercent, 100));
  const topPercent = scrollFracY.value * (100 - thumbPercent);
  return {
    height: thumbPercent + "%",
    top: topPercent + "%",
  };
});
const showVerticalScrollbar = computed(() => {
  const total = scrollRangeScreenY.value;
  const visible = containerHeightScreen.value || 1;
  return total > visible;
});
const showHorizontalScrollbar = computed(() => {
  const total = scrollRangeScreenX.value;
  const visible = containerWidthScreen.value || 1;
  return total > visible;
});
// drag state for vertical
const dragV = reactive({
  active: false,
  startY: 0,
  startFrac: 0,
  startMax: 0,
  startMin: 0,
});
function startVDrag(e: MouseEvent) {
  dragV.active = true;
  dragV.startY = e.clientY;
  dragV.startFrac = scrollFracY.value;
  dragV.startMax = dynamicMaxViewportY.value;
  dragV.startMin = dynamicMinViewportY.value;
  window.addEventListener("mousemove", onVDrag);
  window.addEventListener("mouseup", stopVDrag);
}
function onVDrag(e: MouseEvent) {
  if (!dragV.active) return;
  const trackPx = containerHeight.value;
  if (!trackPx) return;
  const range = dragV.startMax - dragV.startMin;
  const effectiveRange = range <= 0 ? trackPx : range;

  const ratio = Math.min(1, trackPx / effectiveRange);
  const thumbPx = trackPx * ratio;
  const movablePx = trackPx - thumbPx;
  if (movablePx <= 0) return;

  const dy = e.clientY - dragV.startY;
  let nextFrac = dragV.startFrac + dy / movablePx;
  nextFrac = Math.max(0, Math.min(1, nextFrac));

  const nextScrolledScreenY = nextFrac * effectiveRange;
  const nextViewportY = dragV.startMax - nextScrolledScreenY;

  diagram.setViewport({ ...diagram.viewport, y: nextViewportY });
  diagram.viewport.y = nextViewportY;
}
function stopVDrag() {
  dragV.active = false;
  window.removeEventListener("mousemove", onVDrag);
  window.removeEventListener("mouseup", stopVDrag);
}
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

    <!-- horizontal scrollbar -->
    <div class="scrollbar-h" style="
        position: absolute;
        left: 4px;
        right: 12px;
        bottom: 4px;
        height: 12px;
        background-color: var(--theme-scrollbar-track);
        user-select: none;
      " v-show="showHorizontalScrollbar">
      <div class="thumb" :style="hThumbStyle" @mousedown="startHDrag" style="
          position: absolute;
          background-color: var(--theme-scrollbar-thumb);
          border-radius: 3px;
          cursor: pointer;
          height: 100%;
        "></div>
    </div>

    <!-- vertical scrollbar -->
    <div class="scrollbar-v" style="
        position: absolute;
        top: 4px;
        bottom: 12px;
        right: 4px;
        width: 12px;
        background-color: var(--theme-scrollbar-track);
        user-select: none;
      " v-show="showVerticalScrollbar">
      <div class="thumb" :style="vThumbStyle" @mousedown="startVDrag" style="
          position: absolute;
          background-color: var(--theme-scrollbar-thumb);
          border-radius: 3px;
          cursor: pointer;
          width: 100%;
        "></div>
    </div>
  </div>
  <ContextMenuContainer />
</template>
