import type { JobAdapter } from "../types";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { remoteOkAdapter } from "./remoteok";

export const ADAPTERS: Record<string, JobAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  remoteok: remoteOkAdapter,
};
