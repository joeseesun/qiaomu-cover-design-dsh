import {createRequire} from "node:module";
const getRuntimeRequire=()=>createRequire(import.meta.url);
const accountObject=(value:any)=>value&&typeof value==="object"?value:{};

export const MAGPIE_BASE = "http://127.0.0.1:3425/v1";
/** Only public gateway settings; never read or modify Magpie's account/key files. */
export async function magpieAddress(): Promise<string> {
  const require = getRuntimeRequire();
  if (!require) return MAGPIE_BASE;
  try {
    const fs = require("node:fs/promises") as typeof import("node:fs/promises");
    const os = require("node:os") as typeof import("node:os");
    const path = require("node:path") as typeof import("node:path");
    const runtime = require("node:process") as typeof import("node:process");
    const root = runtime.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    const config = accountObject(JSON.parse(await fs.readFile(path.join(root, "magpie", "settings.json"), "utf8")) as unknown);
    if (typeof config.port === "number" && Number.isInteger(config.port) && config.port > 0 && config.port < 65536) return `http://127.0.0.1:${config.port}/v1`;
  } catch { /* default address remains editable */ }
  return MAGPIE_BASE;
}

