import { defineStore } from "pinia";
import type { MenuItem } from "primevue/menuitem";

export const useContextMenu = defineStore('store', {
  state: () => ({
    items: [] as MenuItem[],
    event: null as MouseEvent | null,
  }),

  actions: {
    openMenu(event: MouseEvent, items: MenuItem[]) {
      this.items = items;
      this.event = event;
    },
  },
})
