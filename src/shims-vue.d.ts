import type { PluginViewContext, openExternal } from "@beekeeperstudio/plugin";
import type pluralize from "pluralize";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $pluralize: typeof pluralize;
    $openExternal: typeof openExternal;
  }
}

export { }; // Important to make this a module
