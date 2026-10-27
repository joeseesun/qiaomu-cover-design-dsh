import {nativeHost} from '../../../harness-ui';
import { apiFetch } from "./api-transport";
import { permitsEmptyKey, validateApiUrl } from "./api-providers";
import { accountText as t } from "../i18n/accounts";
import { getRuntimeRequire } from "./runtime-require";
import { accountObject } from "./account-json";

export const MAGPIE_BASE = "http://127.0.0.1:3425/v1";
/** Only public gateway settings; never read or modify Magpie's account/key files. */
export async function magpieAddress():Promise<string>{return nativeHost().magpie();}

export async function detectMagpie(base: string, key: string, signal: AbortSignal): Promise<string> {
  const url = new URL(validateApiUrl(base));
  const local = permitsEmptyKey({ provider: "magpie", baseUrl: base, model: "", secretId: "" });
  if (!key && !local) throw new Error(t("gatewayKeyRequired"));
  // Preserve a reverse proxy prefix: /magpie/v1 -> /magpie/api/hello.
  url.pathname = `${url.pathname.replace(/\/+$/, "").replace(/\/v1$/, "")}/api/hello`;
  try {
    const response = await apiFetch(url.href, { headers: { Authorization: `Bearer ${key || "magpie-qiaomu-agent"}` }, redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
    if (!response.ok) throw new Error();
    const data = accountObject(await response.json() as unknown);
    if (data.name !== "magpie") throw new Error();
    return typeof data.version === "string" ? data.version : "";
  } catch { signal.throwIfAborted(); throw new Error(t("notMagpie")); }
}
