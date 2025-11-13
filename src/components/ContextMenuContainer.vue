<template>
  <ContextMenu ref="menu" :model="items">
    <template #itemicon="{ item }">
      <span class="material-symbols-outlined menu-icon">{{ item.icon }}</span>
    </template>
  </ContextMenu>
</template>

<script lang="ts">
import { useContextMenu } from "@/composables/useContextMenu";
import { mapGetters } from "pinia";
import ContextMenu from "primevue/contextmenu";
import { defineComponent } from "vue";

export default defineComponent({
  components: {
    ContextMenu,
  },

  computed: {
    ...mapGetters(useContextMenu, ["items", "event"]),
  },

  watch: {
    event() {
      if (!event) {
        // @ts-expect-error
        this.$refs.menu.hide();
      } else {
        // @ts-expect-error
        this.$refs.menu.show(this.event);
      }
    },
  },
});
</script>
