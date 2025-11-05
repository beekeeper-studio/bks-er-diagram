<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import SchemaDiagram from "@/components/SchemaDiagram.vue";
import {
  type ColumnReference,
  useSchemaDiagram,
} from "@/composables/useSchemaDiagram";
import {
  addNotificationListener,
  removeNotificationListener,
} from "@beekeeperstudio/plugin";
import { useSchema } from "./composables/useSchema";

const diagram = useSchemaDiagram();
const { stream, progress } = useSchema();
const state = ref<"uninitialized" | "initializing" | "aborting" | "ready">(
  "uninitialized",
);

let abortController: AbortController | undefined;

function abort() {
  state.value = "aborting";
  abortController?.abort();
}

async function initialize() {
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

    const iter = stream({ signal: abortController.signal });

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
  } catch (e) {
    // FIXME show helpful error
    console.error(e);
  }

  state.value = "ready";
}

onMounted(() => {
  initialize();
  /** @ts-expect-error FIXME not fully typed */
  addNotificationListener("tablesChanged", initialize);
});

onUnmounted(() => {
  removeNotificationListener("tablesChanged", initialize);
});

function nothing() { }
</script>

<template>
  <div class="schema-diagram-container">
    <SchemaDiagram :disabled="state === 'initializing' || state === 'aborting'">
      <template #menu>
        <button @click="nothing()" style="height: 2rem; font-weight: 500" class="btn btn-flat">
          <span class="material-symbols-outlined">refresh</span>
          <span>Nothing yet</span>
        </button>
      </template>
    </SchemaDiagram>
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
  </div>
</template>
