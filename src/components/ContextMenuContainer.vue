<template>
  <ContextMenu ref="menu" :model="items" />
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
        this.$refs.menu.hide();
      } else {
        this.$refs.menu.show(this.event);
      }
    },
  },
});
</script>
