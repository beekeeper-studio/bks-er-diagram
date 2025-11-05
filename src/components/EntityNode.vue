<script setup lang="ts">
import type { EntityStructure } from "@/composables/useSchemaDiagram";
import { Handle, Position, type NodeProps } from "@vue-flow/core";

// Avoid vue flow from adding unneeded attributes to the root element
defineOptions({
  inheritAttrs: false,
});

defineProps<NodeProps<EntityStructure>>();
</script>

<template>
  <div style="
      background-color: color-mix(
        in srgb,
        var(--theme-base) 10%,
        var(--query-editor-bg)
      );
      color: var(--text);
      border-radius: 6px;
      padding-block: 1rem;
    ">
    <Handle type="source" :position="Position.Top" :connectable="false" />
    <Handle type="source" :position="Position.Bottom" :connectable="false" />
    <div style="
        font-weight: bold;
        text-align: center;
        margin-bottom: 0.75rem;
        margin-inline: 1rem;
      ">
      {{ data.name }}
    </div>
    <div>
      <ul style="margin: 0; padding: 0; list-style: none">
        <li v-for="column in data.columns" :key="column.name" style="
            position: relative;
            display: flex;
            justify-content: space-between;
            margin: 0;
            padding: 0;
            line-height: 2;
            padding-inline: 1rem;
          ">
          <span style="margin-right: 0.5rem">
            {{ column.name }}
          </span>
          <span style="color: var(--text-muted-2)">
            {{ column.type }}
          </span>
          <template v-if="column.hasReferences">
            <Handle type="source" :position="Position.Right" :id="`${Position.Right}-${column.handleId}`" :connectable="false" />
            <Handle type="source" :position="Position.Left" :id="`${Position.Left}-${column.handleId}`" :connectable="false" />
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>
