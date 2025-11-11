import { isDevMode } from "@/config";
import { defineStore } from "pinia";

export const useDebug = defineStore("debug", {
  state: () => ({
    debugUI: localStorage.getItem("debug-ui") === "true",
  }),

  getters: {
    isDebuggingUI(state) {
      if (!isDevMode) {
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
