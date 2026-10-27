import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/host.js
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import path3 from "node:path";
import { homedir as homedir2 } from "node:os";

// src/storage.js
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
var StateStore = class {
  constructor(directory) {
    this.file = path.join(directory, "state.json");
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      const raw = JSON.parse(await readFile(this.file, "utf8"));
      if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !raw.data || typeof raw.data !== "object" || Array.isArray(raw.data))
        throw Error("Invalid saved data");
      return raw;
    } catch (e) {
      if (e.code === "ENOENT") return { revision: 0, data: {} };
      throw Error("Saved data could not be read. Original file preserved.", {
        cause: e
      });
    }
  }
  save(input) {
    const task = this.queue.catch(() => {
    }).then(async () => {
      if (!input || !Number.isSafeInteger(input.revision) || !input.data || typeof input.data !== "object" || Array.isArray(input.data))
        throw Error("Invalid state");
      const current = await this.load();
      if (input.revision !== current.revision)
        throw Error(
          "Another window saved changes. Reopen this panel before saving."
        );
      const next = { revision: current.revision + 1, data: input.data };
      const text = JSON.stringify(next);
      if (Buffer.byteLength(text) > 8 * 1024 * 1024)
        throw Error(
          "Saved project exceeds 8 MB. Export it as a file instead."
        );
      await mkdir(path.dirname(this.file), { recursive: true, mode: 448 });
      const temp = this.file + "." + randomUUID() + ".tmp";
      await writeFile(temp, text, { mode: 384 });
      await rename(temp, this.file);
      return next;
    });
    this.queue = task;
    return task;
  }
};

// src/meta.js
var NAME = "qiaomu-cover-design-dsh";
var SERVICE = "qiaomuCoverDesign";

// src/workspace-store.js
import { mkdir as mkdir2, readdir, lstat, readFile as readFile2, writeFile as writeFile2, rename as rename2, unlink, realpath, open, link } from "node:fs/promises";
import path2 from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID as randomUUID2 } from "node:crypto";
var LIMIT = 64 * 1024 * 1024;
var digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
var CoverWorkspace = class {
  constructor(root) {
    this.root = path2.resolve(root);
    this.lane = Promise.resolve();
    this.ready = mkdir2(this.root, { recursive: true, mode: 448 }).then(() => realpath(this.root)).then((value) => this.root = value);
  }
  async resolve(relative) {
    await this.ready;
    if (typeof relative !== "string" || relative.includes("\0") || path2.isAbsolute(relative) || relative.split(/[\\/]/).some((p) => p === ".." || p.startsWith("."))) throw Error("Choose a relative path within the cover workspace");
    const target = path2.resolve(this.root, relative);
    if (target !== this.root && !target.startsWith(this.root + path2.sep)) throw Error("Path outside workspace");
    let current = this.root;
    for (const part of path2.relative(this.root, target).split(path2.sep).filter(Boolean)) {
      current = path2.join(current, part);
      try {
        if ((await lstat(current)).isSymbolicLink()) throw Error("Symbolic links are not followed");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    return target;
  }
  serial(fn) {
    const task = this.lane.catch(() => {
    }).then(fn);
    this.lane = task;
    return task;
  }
  async stat(relative) {
    try {
      const stat = await lstat(await this.resolve(relative));
      return { type: stat.isDirectory() ? "folder" : "file", size: stat.size, mtime: stat.mtimeMs, ctime: stat.birthtimeMs };
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  async list(relative = "") {
    const folder = await this.resolve(relative);
    const out = { files: [], folders: [] };
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const name = [relative, entry.name].filter(Boolean).join("/");
      if (entry.isDirectory()) out.folders.push(name);
      else if (entry.isFile()) out.files.push(name);
    }
    return out;
  }
  async inventory() {
    const files = [], folders = [];
    const visit = async (dir, depth) => {
      if (depth > 24) throw Error("Workspace nesting limit exceeded");
      const entries = await this.list(dir);
      for (const folder of entries.folders) {
        folders.push({ path: folder, stat: await this.stat(folder) });
        await visit(folder, depth + 1);
      }
      for (const file of entries.files) {
        if (files.length >= 2e4) throw Error("Workspace exceeds 20000 files");
        files.push({ path: file, stat: await this.stat(file) });
      }
    };
    await visit("", 0);
    return { root: this.root, files, folders };
  }
  async read(relative, binary = false) {
    const file = await this.resolve(relative), stat = await lstat(file);
    if (!stat.isFile() || stat.size > LIMIT) throw Error("File exceeds 64 MB or is not a regular file");
    const bytes = await readFile2(file);
    return { path: relative, ...binary ? { base64: bytes.toString("base64") } : { text: bytes.toString("utf8") }, etag: digest(bytes), stat: await this.stat(relative) };
  }
  write(request) {
    return this.serial(async () => {
      const { path: relative, etag, expected, exclusive = false } = request;
      const file = await this.resolve(relative);
      let bytes;
      if (typeof request.text === "string") bytes = Buffer.from(request.text);
      else if (typeof request.base64 === "string" && request.base64.length <= 90 * 1024 * 1024 && /^[A-Za-z0-9+/]*={0,2}$/.test(request.base64)) bytes = Buffer.from(request.base64, "base64");
      else throw Error("Invalid file data");
      if (bytes.length > LIMIT) throw Error("File exceeds 64 MB");
      let current;
      try {
        current = await readFile2(file);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (exclusive && current) throw Error("File already exists");
      if (etag !== void 0 && (current ? digest(current) : null) !== etag) throw Error("File changed in another editor");
      if (expected !== void 0 && current?.toString("utf8") !== expected) throw Error("File changed in another editor");
      await mkdir2(path2.dirname(file), { recursive: true, mode: 448 });
      await this.resolve(relative);
      const temp = path2.join(path2.dirname(file), ".qcover-" + randomUUID2());
      try {
        await writeFile2(temp, bytes, { flag: "wx", mode: 384 });
        if (exclusive) {
          await link(temp, file);
          await unlink(temp);
        } else await rename2(temp, file);
      } finally {
        await unlink(temp).catch(() => {
        });
      }
      return { path: relative, etag: digest(bytes), stat: await this.stat(relative) };
    });
  }
  mkdir(relative) {
    return this.serial(async () => {
      await mkdir2(await this.resolve(relative), { recursive: true, mode: 448 });
      return { path: relative, stat: await this.stat(relative) };
    });
  }
  rename(request) {
    return this.serial(async () => {
      const from = await this.resolve(request.path), to = await this.resolve(request.to);
      if (from === to) return { path: request.to, stat: await this.stat(request.to) };
      try {
        await lstat(to);
        throw Error("Destination already exists");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (request.etag !== void 0) {
        const current = await this.read(request.path);
        if (current.etag !== request.etag) throw Error("File changed before rename");
      }
      await mkdir2(path2.dirname(to), { recursive: true, mode: 448 });
      await this.resolve(request.to);
      if ((await lstat(from)).isFile()) {
        await link(from, to);
        try {
          await unlink(from);
        } catch (error) {
          await unlink(to).catch(() => {
          });
          throw error;
        }
      } else await rename2(from, to);
      return { path: request.to, stat: await this.stat(request.to) };
    });
  }
  trash(relative) {
    return this.serial(async () => {
      if (!relative) throw Error("Cannot remove workspace root");
      const source = await this.resolve(relative);
      const trash = path2.join(this.root, ".trash");
      await mkdir2(trash, { recursive: true, mode: 448 });
      if ((await lstat(trash)).isSymbolicLink()) throw Error("Invalid recovery directory");
      const target = path2.join(trash, Date.now() + "-" + randomUUID2() + "-" + path2.basename(source));
      await rename2(source, target);
      return { recoveryPath: target };
    });
  }
};
async function writeSystemFile(directory, filename, base64) {
  if (typeof directory === "string" && (directory === "~" || /^~[\\/]/.test(directory))) directory = path2.join(homedir(), directory.slice(2));
  if (typeof directory !== "string" || !path2.isAbsolute(directory) || typeof filename !== "string" || filename !== path2.basename(filename) || !filename || filename.startsWith(".")) throw Error("Choose an absolute directory and a filename");
  if (typeof base64 !== "string" || base64.length > 90 * 1024 * 1024) throw Error("Export exceeds limit");
  const data = Buffer.from(base64, "base64");
  if (data.length > LIMIT) throw Error("Export exceeds 64 MB");
  await mkdir2(directory, { recursive: true });
  const root = await realpath(directory), ext = path2.extname(filename), stem = path2.basename(filename, ext);
  for (let i = 0; i < 1e3; i++) {
    const target = path2.join(root, stem + (i ? " " + i : "") + ext);
    try {
      await writeFile2(target, data, { flag: "wx", mode: 384 });
      return target;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  throw Error("Too many duplicate export filenames");
}

// src/secure-settings.js
import { createHash as createHash2 } from "node:crypto";
var SecureSettings = class {
  constructor(store, credentials) {
    this.store = store;
    this.credentials = credentials;
    this.lane = Promise.resolve();
  }
  async transform(settings, restore = false) {
    const output = structuredClone(settings || {}), ai = output.ai;
    if (!ai) return output;
    const entries = [["active", ai], ...(ai.chats || []).map((p) => ["chat-" + p.id, p.snap]), ...(ai.images || []).map((p) => ["image-" + p.id, p.snap])];
    for (const [name, snap] of entries) {
      if (!snap) continue;
      for (const field of ["apiKey", "imageKey"]) {
        if (typeof snap[field] !== "string") continue;
        if (field === "apiKey" && snap.preset === "chatgpt") continue;
        const value = snap[field];
        if (restore) {
          if (value.startsWith("credential:")) snap[field] = await this.credentials.get(value.slice(11));
        } else if (value) {
          const id = "provider-" + createHash2("sha256").update(name + "-" + field + "-" + value).digest("hex").slice(0, 32);
          await this.credentials.set(id, value);
          snap[field] = "credential:" + id;
        }
      }
    }
    return output;
  }
  async load() {
    const saved = await this.store.load();
    const settings = await this.transform(saved.data.settings, true);
    const ids = /* @__PURE__ */ new Set([settings.unsplashSecret, "qiaomu-cover-design-oauth-host"]);
    for (const snap of [settings.ai, ...(settings.ai?.chats || []).map((p) => p.snap)]) if (snap?.preset === "chatgpt" && snap.apiKey) ids.add(snap.apiKey);
    const secrets = {};
    for (const id of ids) if (id) secrets[id] = await this.credentials.get(id);
    return { ...saved, data: { ...saved.data, settings }, secrets };
  }
  save(request) {
    const task = this.lane.catch(() => {
    }).then(async () => {
      const current = await this.store.load();
      if (request.revision !== current.revision) throw Error("Another window saved changes. Reopen the panel.");
      const settings = await this.transform(request.data?.settings);
      const result = await this.store.save({ revision: request.revision, data: { settings, workspace: { openFiles: Array.isArray(request.data?.workspace?.openFiles) ? request.data.workspace.openFiles.filter((p) => typeof p === "string").slice(0, 30) : [], activeFile: typeof request.data?.workspace?.activeFile === "string" ? request.data.workspace.activeFile : "" } } });
      return { revision: result.revision };
    });
    this.lane = task;
    return task;
  }
};

// src/host-services/jobs.ts
import { randomUUID as randomUUID3 } from "node:crypto";

// src/host-services/oauth-loopback.ts
import { createRequire } from "node:module";
var getRuntimeRequire = () => createRequire(import.meta.url);
var t = (key) => ({ complete: "Connected. You can return to Qiaomu Cover.", failed: "Account connection failed" })[key] || key;
async function listenOAuth(state, signal, tokenDance = false) {
  const require2 = getRuntimeRequire();
  if (!require2) throw new Error(t("desktop"));
  const http = require2("node:http");
  signal.throwIfAborted();
  let resolve, reject;
  const result = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  void result.catch(() => {
  });
  let redirect = "", settled = false;
  const close = () => {
    server?.close();
    server?.closeAllConnections();
    signal.removeEventListener("abort", abort);
  };
  const fail = (error) => {
    if (!settled) {
      settled = true;
      reject(error);
    }
    close();
  };
  const abort = () => fail(signal.reason);
  const server = http.createServer((req, res) => {
    const invalid = () => {
      res.writeHead(400, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      res.end("Invalid callback");
    };
    if (!redirect) {
      invalid();
      return;
    }
    const expected = new URL(redirect);
    let url;
    try {
      url = new URL(req.url ?? "/", expected.origin);
    } catch {
      invalid();
      return;
    }
    if (req.method !== "GET" || req.headers.host !== expected.host || url.origin !== expected.origin || url.pathname !== expected.pathname || url.searchParams.getAll("state").length !== 1 || url.searchParams.get("state") !== state || settled) {
      invalid();
      return;
    }
    settled = true;
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'" });
    res.end(t("complete"));
    res.once("finish", close);
    if (url.searchParams.has("error") || url.searchParams.getAll("code").length !== 1) reject(new Error(t("failed")));
    else resolve(url);
  });
  await new Promise((res, rej) => {
    server.once("error", rej);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", rej);
      res();
    });
  }).catch((error) => {
    fail(error);
    throw error;
  });
  const port = server.address().port;
  redirect = `http://127.0.0.1:${port}/auth/callback${tokenDance ? `?state=${encodeURIComponent(state)}` : ""}`;
  server.on("error", fail);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  return { redirect, result, close };
}

// src/host-services/codex.ts
var codex_exports = {};
__export(codex_exports, {
  cancelCodexLogins: () => cancelCodexLogins,
  codexAccount: () => codexAccount,
  codexImage: () => codexImage,
  codexModels: () => codexModels,
  codexText: () => codexText,
  detectCodex: () => detectCodex,
  findCodex: () => findCodex,
  shutdownCodex: () => shutdownCodex,
  startCodexLogin: () => startCodexLogin,
  warmCodex: () => warmCodex
});
import { createRequire as createRequire2 } from "node:module";
var hostRequire = createRequire2(import.meta.url);
var nodeRequire = () => hostRequire;
function findCodex(custom) {
  const req = nodeRequire();
  const fs = req("fs");
  const os = req("os");
  const path4 = req("path");
  const home = os.homedir();
  const expand = (p) => p.replace(/^~(?=\/|\\|$)/, home);
  const candidates = [custom.trim() && expand(custom.trim()), path4.join(home, ".local/bin/codex"), "/opt/homebrew/bin/codex", "/usr/local/bin/codex", path4.join(home, ".codex/bin/codex"), path4.join(home, ".npm-global/bin/codex"), path4.join(home, ".bun/bin/codex")].filter((x) => !!x);
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
    }
  }
  try {
    const cp = req("child_process");
    const out = cp.execFileSync(process.env.SHELL || "/bin/zsh", ["-lc", "command -v codex"], { encoding: "utf8", timeout: 5e3 }).trim().split("\n").pop() ?? "";
    if (out && fs.existsSync(out)) return out;
  } catch {
  }
  throw new Error("codex-missing");
}
var Rpc = class {
  child;
  nextId = 1;
  buffer = "";
  err = "";
  closed = false;
  pending = /* @__PURE__ */ new Map();
  notes = /* @__PURE__ */ new Set();
  closers = /* @__PURE__ */ new Set();
  listen(fn) {
    this.notes.add(fn);
    return () => this.notes.delete(fn);
  }
  whenClosed(fn) {
    this.closers.add(fn);
    return () => this.closers.delete(fn);
  }
  constructor(bin, cwd) {
    const cp = nodeRequire()("child_process");
    this.child = cp.spawn(bin, ["app-server", "--listen", "stdio://"], { cwd, stdio: ["pipe", "pipe", "pipe"], env: process.env });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) this.handle(line);
    });
    this.child.stderr.on("data", (c) => {
      this.err = (this.err + c.toString()).slice(-600);
    });
    this.child.on("error", (e) => this.fail(new Error(`cannot start codex: ${e.message}`)));
    this.child.on("exit", (code) => this.fail(new Error(`codex exited (${code})${this.err ? `: ${this.err.trim()}` : ""}`)));
  }
  fail(e) {
    this.closed = true;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(e);
    }
    this.pending.clear();
    for (const f of [...this.closers]) f(e);
  }
  write(m) {
    if (!this.closed) this.child.stdin.write(`${JSON.stringify(m)}
`);
  }
  handle(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.id !== void 0 && !msg.method && (msg.result !== void 0 || msg.error)) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message || "codex request failed"));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method && msg.id !== void 0) {
      this.write({ id: msg.id, error: { code: -32601, message: "not supported" } });
      return;
    }
    if (msg.method) for (const f of [...this.notes]) f(msg.method, msg.params ?? {});
  }
  request(method, params, ms = 3e4) {
    if (this.closed) return Promise.reject(new Error("codex is not running"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, ms);
      this.pending.set(id, { resolve: (v) => resolve(v), reject, timer });
      this.write({ id, method, params });
    });
  }
  notify(method) {
    this.write({ method, params: {} });
  }
  stop() {
    this.closed = true;
    try {
      this.child.kill("SIGTERM");
    } catch {
    }
  }
};
var IDLE_MS = 10 * 60 * 1e3;
var shared;
function session(bin) {
  if (shared && (shared.rpc.closed || shared.bin !== bin)) shutdownCodex();
  if (shared) return shared;
  const os = nodeRequire()("os");
  const rpc = new Rpc(bin, os.tmpdir());
  const ready = (async () => {
    await rpc.request("initialize", { clientInfo: { name: "qiaomu_cover_design", title: "Qiaomu Design", version: "0.2.4" } }, 2e4);
    rpc.notify("initialized");
  })();
  const entry = { bin, rpc, ready, busy: 0 };
  ready.catch(() => {
    if (shared === entry) shutdownCodex();
  });
  shared = entry;
  return entry;
}
function shutdownCodex() {
  if (shared) {
    clearTimeout(shared.idle);
    shared.rpc.stop();
    shared = void 0;
  }
}
function warmCodex(bin) {
  try {
    void session(bin).ready.catch(() => void 0);
  } catch {
  }
}
async function runTurn(o, instructions, text, cwd, write, references = []) {
  const sess = session(o.bin);
  const { rpc } = sess;
  clearTimeout(sess.idle);
  sess.busy++;
  const items = [];
  let error;
  let threadId = "";
  let offClose;
  let finish;
  const done = new Promise((res, rej) => {
    finish = res;
    offClose = rpc.whenClosed(rej);
  });
  const offNote = rpc.listen((method, params) => {
    if (!threadId || params.threadId !== threadId) return;
    if (method === "item/completed") items.push(params.item ?? {});
    else if (method === "turn/completed") finish();
    else if (method === "error" && params.error) error = params.error.message ?? JSON.stringify(params.error);
  });
  const ms = Math.max(30, o.timeoutSec ?? 300) * 1e3;
  const timer = setTimeout(() => finish("timeout"), ms);
  try {
    await sess.ready;
    const thread = await rpc.request("thread/start", { cwd, approvalPolicy: "never", sandbox: write ? "workspace-write" : "read-only", ephemeral: true, serviceName: "qiaomu_cover_design", ...o.model ? { model: o.model } : {}, developerInstructions: instructions });
    threadId = thread.thread?.id ?? "";
    if (!threadId) throw new Error("codex did not return a thread id");
    await rpc.request("turn/start", { threadId, cwd, approvalPolicy: "never", sandboxPolicy: write ? { type: "workspaceWrite", writableRoots: [cwd], networkAccess: false } : { type: "readOnly" }, ...o.model ? { model: o.model } : {}, input: [{ type: "text", text, text_elements: [] }, ...references.map((url) => ({ type: "image", url }))] });
    if (await done === "timeout") throw new Error(`codex timed out after ${ms / 1e3}s`);
  } finally {
    clearTimeout(timer);
    offNote();
    offClose?.();
    if (--sess.busy <= 0 && shared === sess) sess.idle = setTimeout(shutdownCodex, IDLE_MS);
  }
  return { items, error };
}
var PLAN_GUARD = "\n\n\u4F60\u662F\u7EAF\u6587\u672C\u52A9\u624B\uFF1A\u4E0D\u8981\u8FD0\u884C\u547D\u4EE4\u3001\u8BFB\u5199\u6587\u4EF6\u6216\u8054\u7F51\uFF0C\u76F4\u63A5\u6309\u4E0A\u9762\u7684\u683C\u5F0F\u56DE\u7B54\u3002";
async function codexText(o, system, user) {
  const os = nodeRequire()("os");
  const { items, error } = await runTurn(o, system + PLAN_GUARD, user, os.tmpdir(), false);
  const reply = [...items].reverse().find((i) => i.type === "agentMessage" && i.text)?.text;
  if (!reply) throw new Error(error || "empty-reply");
  return reply;
}
var RELAY = "You are an image-generation relay. Call the built-in image generation tool exactly once for the user's request, then reply with one short sentence. Do not run shell commands, write code, browse, or ask questions.";
async function codexImage(o, prompt, references = []) {
  const req = nodeRequire();
  const fs = req("fs");
  const os = req("os");
  const path4 = req("path");
  const dir = await fs.promises.mkdtemp(path4.join(os.tmpdir(), "qc-codex-"));
  try {
    const { items, error } = await runTurn({ ...o, timeoutSec: o.timeoutSec ?? 600 }, RELAY, `${references.length ? "Edit the provided reference image(s) according to this instruction" : "Generate this image"}:
${prompt}`, dir, true, references);
    const img = items.find((i) => i.type === "imageGeneration");
    if (img?.failure) throw new Error(img.failure.message || "image generation failed");
    let buf;
    if (typeof img?.savedPath === "string" && img.savedPath) {
      let p = img.savedPath.replace(/^file:\/\//, "");
      try {
        p = decodeURIComponent(p);
      } catch {
      }
      try {
        buf = await fs.promises.readFile(p);
      } catch {
      }
    }
    if (!buf && typeof img?.result === "string" && img.result) buf = Buffer.from(img.result.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!buf) throw new Error(error || items.find((i) => i.type === "agentMessage")?.text || "empty-image");
    const type = buf[0] === 255 ? "image/jpeg" : buf.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : "image/png";
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), type };
  } finally {
    void fs.promises.rm(dir, { recursive: true, force: true }).catch(() => void 0);
  }
}
async function detectCodex(custom) {
  const path4 = findCodex(custom);
  const cp = nodeRequire()("child_process");
  const version = await new Promise((resolve) => {
    cp.execFile(path4, ["--version"], { timeout: 6e3 }, (err, out) => resolve(err ? void 0 : String(out).trim().replace(/^codex(-cli)?\s*/i, "")));
  });
  return { path: path4, version };
}
async function accountRequest(custom, method, params) {
  const sess = session(findCodex(custom));
  clearTimeout(sess.idle);
  sess.busy++;
  try {
    await sess.ready;
    return await sess.rpc.request(method, params);
  } finally {
    if (--sess.busy <= 0 && shared === sess) sess.idle = setTimeout(shutdownCodex, IDLE_MS);
  }
}
async function codexAccount(custom) {
  const reply = await accountRequest(custom, "account/read", { refreshToken: false });
  const account = reply.account;
  return { signedIn: !!account, label: account?.type === "chatgpt" ? account.email || "ChatGPT" : account?.type === "apiKey" ? "API key" : "" };
}
async function codexModels(custom) {
  const reply = await accountRequest(custom, "model/list", { limit: 100 });
  return (reply.data ?? []).filter((m) => !m.hidden).map((m) => ({ id: m.model, name: m.displayName }));
}
var loginCancels = /* @__PURE__ */ new Set();
function cancelCodexLogins() {
  for (const cancel of loginCancels) cancel();
}
async function startCodexLogin(custom) {
  const os = nodeRequire()("os");
  const rpc = new Rpc(findCodex(custom), os.tmpdir());
  let loginId = "";
  let settled = false;
  let timer;
  let resolve;
  let reject;
  const result = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  void result.catch(() => void 0);
  const clean = () => {
    clearTimeout(timer);
    offNote();
    offClose();
    loginCancels.delete(cancel);
    rpc.stop();
  };
  const finish = (error) => {
    if (settled) return;
    settled = true;
    clean();
    if (error) reject(new Error(error));
    else resolve();
  };
  const cancel = () => {
    if (settled) return;
    if (loginId) void rpc.request("account/login/cancel", { loginId }, 1e3).catch(() => void 0);
    finish("login-cancelled");
  };
  const offNote = rpc.listen((method, params) => {
    if (method === "account/login/completed" && params.loginId === loginId) finish(params.success ? void 0 : "login-failed");
  });
  const offClose = rpc.whenClosed(() => finish("login-process-closed"));
  loginCancels.add(cancel);
  try {
    await rpc.request("initialize", { clientInfo: { name: "qiaomu_cover_design", title: "Qiaomu Cover Design", version: "0.2.1" } });
    rpc.notify("initialized");
    const started = await rpc.request("account/login/start", { type: "chatgpt" });
    loginId = String(started.loginId ?? "");
    const url = String(started.authUrl ?? "");
    if (!loginId || !url.startsWith("https://auth.openai.com/")) throw new Error("login-invalid-url");
    timer = setTimeout(() => finish("login-timeout"), 5 * 6e4);
    return { url, result, cancel };
  } catch (error) {
    finish("login-failed");
    throw error;
  }
}

// src/host-services/jobs.ts
var NativeJobs = class {
  jobs = /* @__PURE__ */ new Map();
  add(promise, cancel) {
    if (this.jobs.size >= 20) throw Error("Too many pending operations");
    const id = randomUUID3();
    const job = { state: "pending", cancel };
    this.jobs.set(id, job);
    const timer = setTimeout(() => {
      cancel();
      this.jobs.delete(id);
    }, 11 * 6e4);
    timer.unref?.();
    job.timer = timer;
    promise.then((value) => {
      job.state = "done";
      job.value = value;
    }, (error) => {
      job.state = "error";
      job.error = error?.message || "Operation failed";
    });
    return id;
  }
  poll(id) {
    const job = this.jobs.get(id);
    if (!job) throw Error("Operation expired");
    if (job.state === "pending") return { state: "pending" };
    clearTimeout(job.timer);
    this.jobs.delete(id);
    return { state: job.state, value: job.value, error: job.error };
  }
  cancel(id) {
    const job = this.jobs.get(id);
    if (job) {
      clearTimeout(job.timer);
      job.cancel();
      this.jobs.delete(id);
    }
    return null;
  }
  async oauth(request) {
    if (this.jobs.size >= 20) throw Error("Too many pending operations");
    if (typeof request.state !== "string" || request.state.length > 200 || !request.state) throw Error("Invalid OAuth state");
    const controller = new AbortController();
    const listener = await listenOAuth(request.state, controller.signal, !!request.tokenDance);
    const id = this.add(listener.result.then((url) => url.href), () => {
      controller.abort();
      listener.close();
    });
    return { id, redirect: listener.redirect };
  }
  async login(request) {
    if (this.jobs.size >= 20) throw Error("Too many pending operations");
    const login = await startCodexLogin(String(request.bin || ""));
    const id = this.add(login.result, () => login.cancel());
    return { id, url: login.url };
  }
  async call(request) {
    const { method, args = [] } = request;
    const allowed = ["detectCodex", "codexAccount", "codexModels", "codexText", "codexImage", "warmCodex", "shutdownCodex"];
    if (!allowed.includes(method) || !Array.isArray(args)) throw Error("Unknown Codex operation");
    if (["codexText", "codexImage"].includes(method)) args[0] = { ...args[0], bin: findCodex(String(args[0]?.bin || "")) };
    if (method === "warmCodex") args[0] = findCodex(String(args[0] || ""));
    const result = await codex_exports[method](...args);
    if (method === "codexImage") return { base64: Buffer.from(result.data).toString("base64"), type: result.type };
    return result ?? null;
  }
  dispose() {
    for (const id of this.jobs.keys()) this.cancel(id);
    cancelCodexLogins();
    shutdownCodex();
  }
};

// src/host-services/gallery-folders.ts
async function runtime() {
  const req = typeof window === "undefined" ? void 0 : window.require;
  if (req) return { fs: req("fs"), path: req("path") };
  return { fs: await import("node:fs"), path: await import("node:path") };
}
var types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
async function folderImages(folder) {
  const { fs: module, path: path4 } = await runtime(), fs = module.promises;
  if (!path4.isAbsolute(folder)) throw Error("Choose an absolute folder");
  const dir = await fs.realpath(folder), entries = await fs.readdir(dir, { withFileTypes: true }), out = [];
  for (const e of entries) {
    const type = types[path4.extname(e.name).toLowerCase()];
    if (!e.isFile() || !type) continue;
    const file = path4.join(dir, e.name), stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 30 * 1024 * 1024 || !stat.size) continue;
    out.push({ name: e.name, path: file, type, size: stat.size, modified: stat.mtimeMs });
  }
  return out.sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name));
}
async function folderImageData(folder, image) {
  const { fs: module, path: path4 } = await runtime(), fs = module.promises;
  const dir = await fs.realpath(folder), file = path4.resolve(image.path);
  if (path4.dirname(file) !== dir || !types[path4.extname(file).toLowerCase()]) throw Error("Image outside folder");
  const handle = await fs.open(file, module.constants.O_RDONLY | module.constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !stat.size || stat.size > 30 * 1024 * 1024) throw Error("Image too large");
    const data = await handle.readFile();
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } finally {
    await handle.close();
  }
}

// src/host-services/magpie.ts
import { createRequire as createRequire3 } from "node:module";
var getRuntimeRequire2 = () => createRequire3(import.meta.url);
var accountObject = (value) => value && typeof value === "object" ? value : {};
var MAGPIE_BASE = "http://127.0.0.1:3425/v1";
async function magpieAddress() {
  const require2 = getRuntimeRequire2();
  if (!require2) return MAGPIE_BASE;
  try {
    const fs = require2("node:fs/promises");
    const os = require2("node:os");
    const path4 = require2("node:path");
    const runtime2 = require2("node:process");
    const root = runtime2.env.XDG_CONFIG_HOME || path4.join(os.homedir(), ".config");
    const config = accountObject(JSON.parse(await fs.readFile(path4.join(root, "magpie", "settings.json"), "utf8")));
    if (typeof config.port === "number" && Number.isInteger(config.port) && config.port > 0 && config.port < 65536) return `http://127.0.0.1:${config.port}/v1`;
  } catch {
  }
  return MAGPIE_BASE;
}

// src/platform-credentials.js
import { spawn } from "node:child_process";
var WINDOWS_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
try {
 Add-Type -AssemblyName System.Security
 $request=[Console]::In.ReadToEnd() | ConvertFrom-Json
 if ($request.id -notmatch '^[a-z0-9-]{1,100}$') {throw 'Invalid credential identifier'}
 $directory=Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Qiaomu/DeepSeekHarness/CoverDesign/Credentials'
 $path=Join-Path $directory ($request.id+'.bin')
 if ($request.operation -eq 'get') {
  if (Test-Path -LiteralPath $path) {
   $encrypted=[IO.File]::ReadAllBytes($path)
   $plain=[Security.Cryptography.ProtectedData]::Unprotect($encrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
   [Console]::Out.Write([Convert]::ToBase64String($plain))
  }
 } elseif ($request.operation -eq 'set') {
  if ($request.value -eq '') {if(Test-Path -LiteralPath $path){Remove-Item -LiteralPath $path -Force}} else {
   [IO.Directory]::CreateDirectory($directory) | Out-Null
   $plain=[Text.Encoding]::UTF8.GetBytes($request.value)
   $encrypted=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
   $temp=$path+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
   [IO.File]::WriteAllBytes($temp,$encrypted)
   Move-Item -LiteralPath $temp -Destination $path -Force
  }
 } else {throw 'Invalid operation'}
 exit 0
} catch {exit 1}
`;
function executeCredentialCommand(command, args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let output = "", settled = false;
    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(Error(message));
    };
    const timer = setTimeout(() => fail("Credential operation timed out"), 15e3);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 65536) fail("Credential response exceeds limit");
    });
    child.stderr.resume();
    child.once("error", () => fail("System credential storage is unavailable"));
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output });
    });
    child.stdin.on("error", () => {
    });
    child.stdin.end(input);
  });
}
function platformCredentials(platform, execute = executeCredentialCommand) {
  const service = "ai.qiaomu.cover.dsh";
  if (platform === "win32") return {
    async get(id) {
      const r = await execute("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(WINDOWS_SCRIPT, "utf16le").toString("base64")], JSON.stringify({ operation: "get", id }));
      if (r.code !== 0) throw Error("Could not read Windows protected credential");
      return Buffer.from(r.output.trim(), "base64").toString("utf8");
    },
    async set(id, value) {
      const r = await execute("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(WINDOWS_SCRIPT, "utf16le").toString("base64")], JSON.stringify({ operation: "set", id, value }));
      if (r.code !== 0) throw Error("Could not store Windows protected credential");
    }
  };
  if (platform === "linux") return {
    async get(id) {
      const r = await execute("secret-tool", ["lookup", "service", service, "account", id]);
      if (r.code === 1 && !r.output) return "";
      if (r.code !== 0) throw Error("Could not read Secret Service credential");
      return r.output.replace(/\r?\n$/, "");
    },
    async set(id, value) {
      const r = value ? await execute("secret-tool", ["store", "--label=Qiaomu Cover Design for DeepSeek Harness", "service", service, "account", id], value) : await execute("secret-tool", ["clear", "service", service, "account", id]);
      if (r.code !== 0 && !(r.code === 1 && !value)) throw Error("Could not store Secret Service credential");
    }
  };
  throw Error("System credential storage is unavailable on this platform");
}

// src/credential-store.js
import { spawn as spawn2 } from "node:child_process";
var SERVICE2 = "ai.qiaomu.cover.dsh";
var validId = (id) => typeof id === "string" && /^[a-z0-9-]{1,100}$/.test(id);
function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn2("/usr/bin/security", args, { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("Keychain operation timed out"));
    }, 15e3);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 131072) child.kill();
    });
    child.stderr.resume();
    child.once("error", () => {
      clearTimeout(timer);
      reject(Error("Keychain is unavailable"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
    child.stdin.on("error", () => {
    });
    child.stdin.end(input);
  });
}
var CredentialStore = class {
  constructor({ platform = process.platform, execute = run, executePlatform } = {}) {
    this.platform = platform;
    this.execute = execute;
    this.backend = platform === "darwin" ? null : platformCredentials(platform, executePlatform);
    this.lane = Promise.resolve();
  }
  validate(id) {
    if (!validId(id)) throw Error("Invalid credential identifier");
  }
  async get(id) {
    this.validate(id);
    if (this.backend) return this.backend.get(id);
    const result = await this.execute(["find-generic-password", "-a", id, "-s", SERVICE2, "-w"]);
    if (result.code === 44) return "";
    if (result.code !== 0) throw Error("Could not read credential from Keychain");
    const value = result.output.trim();
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw Error("Invalid credential encoding");
    return Buffer.from(value, "base64").toString("utf8");
  }
  set(id, value) {
    this.validate(id);
    if (typeof value !== "string" || Buffer.byteLength(value) > 65536) throw Error("Invalid credential");
    const task = this.lane.then(async () => {
      if (this.backend) {
        await this.backend.set(id, value);
        if (await this.backend.get(id) !== value) throw Error("System credential storage did not retain credential");
        return;
      }
      if (!value) {
        const r = await this.execute(["delete-generic-password", "-a", id, "-s", SERVICE2]);
        if (r.code !== 0 && r.code !== 44) throw Error("Could not remove credential");
        return;
      }
      const encoded = Buffer.from(value, "utf8").toString("base64");
      await this.execute(["-i"], `add-generic-password -U -a ${id} -s ${SERVICE2} -w ${encoded}
`);
      if (await this.get(id) !== value) throw Error("Keychain did not retain credential");
    });
    this.lane = task.catch(() => {
    });
    return task;
  }
};

// src/network.js
var LIMIT2 = 32 * 1024 * 1024;
async function boundedHttpRequest(request, { fetchImpl = fetch } = {}) {
  if (!request || typeof request.url !== "string") throw Error("Invalid HTTP request");
  let url = new URL(request.url);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("HTTP(S) URLs without embedded credentials are required");
  const method = String(request.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) throw Error("Unsupported HTTP method");
  const headers = new Headers(request.headers || {});
  if (request.contentType) headers.set("content-type", request.contentType);
  let body = request.base64 ? Buffer.from(request.base64, "base64") : request.body;
  if (body != null && (typeof body !== "string" && !Buffer.isBuffer(body))) throw Error("Invalid request body");
  if (body && Buffer.byteLength(body) > LIMIT2) throw Error("HTTP request exceeds 32 MB");
  const signal = AbortSignal.timeout(18e4);
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetchImpl(url, { method, headers, body: ["GET", "HEAD"].includes(method) ? void 0 : body, redirect: "manual", signal });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
      await response.body?.cancel();
      const target = new URL(response.headers.get("location"), url);
      if (target.origin !== url.origin || !["http:", "https:"].includes(target.protocol)) throw Error("Cross-origin HTTP redirect refused");
      if (method !== "GET" && method !== "HEAD") throw Error("Provider request redirect refused");
      url = target;
      continue;
    }
    if (Number(response.headers.get("content-length")) > LIMIT2) {
      await response.body?.cancel();
      throw Error("HTTP response exceeds 32 MB");
    }
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body || []) {
      total += chunk.length;
      if (total > LIMIT2) throw Error("HTTP response exceeds 32 MB");
      chunks.push(chunk);
    }
    return { status: response.status, headers: Object.fromEntries(response.headers), base64: Buffer.concat(chunks).toString("base64") };
  }
  throw Error("Too many HTTP redirects");
}

// src/host.js
var Config = {
  "~standard": {
    version: 1,
    vendor: NAME,
    validate(value) {
      if (value == null) return { value: {} };
      if (typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !["dataDir", "notesDir"].includes(k)) || value.notesDir !== void 0 && (typeof value.notesDir !== "string" || !path3.isAbsolute(value.notesDir)) || value.dataDir !== void 0 && (typeof value.dataDir !== "string" || !path3.isAbsolute(value.dataDir)))
        return {
          issues: [{ message: "dataDir must be an absolute directory" }]
        };
      return { value };
    }
  }
};
var PluginService = class extends TypertRemoteService {
  constructor(ctx, config = {}) {
    super(ctx, SERVICE);
    this.store = new StateStore(
      config.dataDir || path3.join(
        process.env.DSH_HOME || path3.join(homedir2(), ".dsh"),
        "qiaomu",
        NAME
      )
    );
    this.notes = new CoverWorkspace(config.notesDir || path3.join(path3.dirname(this.store.file), "workspace"));
    this.credentials = new CredentialStore();
    this.settings = new SecureSettings(this.store, this.credentials);
    this.jobs = new NativeJobs();
    ctx.effect(() => () => this.jobs.dispose());
  }
  load() {
    return this.settings.load();
  }
  save(request) {
    return this.settings.save(request);
  }
  info() {
    return { platform: process.platform, workspaceRoot: this.notes.root };
  }
  inventory() {
    return this.notes.inventory();
  }
  fileRead(request) {
    return this.notes.read(request.path, request.binary);
  }
  fileWrite(request) {
    return this.notes.write(request);
  }
  fileRename(request) {
    return this.notes.rename(request);
  }
  fileStat(request) {
    return this.notes.stat(request.path);
  }
  fileList(request) {
    return this.notes.list(request.path);
  }
  fileMkdir(request) {
    return this.notes.mkdir(request.path);
  }
  fileTrash(request) {
    return this.notes.trash(request.path);
  }
  exportFile(request) {
    return writeSystemFile(request.directory, request.filename, request.base64);
  }
  folderImages(request) {
    return folderImages(request.folder);
  }
  async folderImageData(request) {
    return { base64: Buffer.from(await folderImageData(request.folder, request.image)).toString("base64") };
  }
  magpie() {
    return magpieAddress();
  }
  request(request) {
    const url = new URL(request.url);
    if (url.hostname === "api.deepseek.com" && request.body) {
      let body;
      try {
        body = JSON.parse(request.body);
      } catch {
      }
      if (body?.model && body.model !== "deepseek-flash") throw Error("DeepSeek calls must use deepseek-flash");
    }
    return boundedHttpRequest(request);
  }
  secretGet(request) {
    return this.credentials.get(request.id);
  }
  secretSet(request) {
    return this.credentials.set(request.id, request.value);
  }
  oauthStart(request) {
    return this.jobs.oauth(request);
  }
  oauthPoll(request) {
    return this.jobs.poll(request.id);
  }
  oauthCancel(request) {
    return this.jobs.cancel(request.id);
  }
  codexCall(request) {
    return this.jobs.call(request);
  }
  codexLoginStart(request) {
    return this.jobs.login(request);
  }
  codexLoginPoll(request) {
    return this.jobs.poll(request.id);
  }
  codexLoginCancel(request) {
    return this.jobs.cancel(request.id);
  }
};
for (const name of ["load", "save", "info", "inventory", "fileRead", "fileWrite", "fileRename", "fileStat", "fileList", "fileMkdir", "fileTrash", "exportFile", "folderImages", "folderImageData", "magpie", "request", "secretGet", "secretSet", "oauthStart", "oauthPoll", "oauthCancel", "codexCall", "codexLoginStart", "codexLoginPoll", "codexLoginCancel"])
  Remote(name)(PluginService.prototype[name], {
    name,
    private: false,
    static: false,
    addInitializer(fn) {
      fn.call(Object.create(PluginService.prototype));
    }
  });
export {
  Config,
  PluginService as default
};
