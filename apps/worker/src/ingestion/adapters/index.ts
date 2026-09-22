import type { JobAdapter } from "../types.js";
import { greenhouseAdapter } from "./greenhouse.js";
import { leverAdapter } from "./lever.js";
import { remoteOkAdapter } from "./remoteok.js";

export const ADAPTERS: Record<string, JobAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  remoteok: remoteOkAdapter,
};
