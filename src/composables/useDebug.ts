import { defineStore } from "pinia";

export const useDebug = defineStore("debug", {
  state: () => ({
    debugUI: localStorage.getItem("debug-ui") === "true",
  }),

  getters: {
    isDevMode() {
      return import.meta.env.DEV;
    },
    isDebuggingUI(state) {
      if (!this.isDevMode) {
        return false;
      }
      return state.debugUI;
    },
  },

  actions: {
    toggleDebugUI() {
      this.debugUI = !this.debugUI;
      localStorage.setItem("debug-ui", this.debugUI.toString());
    },
  },
});
