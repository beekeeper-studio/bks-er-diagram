<template>
  <ul class="columns">
    <li v-for="column in columns" :key="column.name" :class="{
      'primary-key': column.primaryKey,
      'foreign-key': column.foreignKey,
    }">
      <div class="column-content">
        <span class="column-icon-container">
          <span v-if="column.primaryKey || column.foreignKey" class="material-symbols-outlined key-icon">
            vpn_key
          </span>
        </span>
        <span class="column-name">
          {{ column.name }}
        </span>
        <span class="column-type">
          {{ column.type }}
        </span>
      </div>
      <template v-if="column.hasReferences">
        <Handle type="source" :position="Position.Right" :id="`${Position.Right}-${column.handleId}`"
          :connectable="false" />
        <Handle type="source" :position="Position.Left" :id="`${Position.Left}-${column.handleId}`"
          :connectable="false" />
      </template>
    </li>
  </ul>
</template>

<script lang="ts">
import type { ColumnStructure } from "@/composables/useSchemaDiagram";
import { Handle, Position } from "@vue-flow/core";
import { defineComponent, type PropType } from "vue";

export default defineComponent({
  components: {
    Handle,
  },
  props: {
    columns: {
      type: Array as PropType<ColumnStructure[]>,
      required: true,
    },
  },

  setup() {
    return {
      Position,
    };
  },
});
</script>
