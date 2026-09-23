// Runtime smoke test for a built image: starts a container against disposable
// mounts, then exercises setup, library creation, scanning, page and cover
// serving, the auth boundary, and two-step deletion.
//
//   node scripts/smoke.mjs [image]      (default: mangayomi:dev)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const image = process.argv[2] ?? "mangayomi:dev";
const name = `mangayomi-smoke-${process.pid}`;
const port = Number(process.env.SMOKE_PORT ?? 18765);
const base = `http://127.0.0.1:${port}`;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangayomi-smoke-"));
const configDir = path.join(root, "config");
const dataDir = path.join(root, "data");
let cookie = "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function check(condition, message) {
  if (!condition) throw new Error(`smoke check failed: ${message}`);
  console.log(`ok - ${message}`);
}

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  return res;
}

async function json(method, url, body) {
  const res = await call(method, url, body);
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.chmodSync(root, 0o755);
  fs.chmodSync(dataDir, 0o777);
  execFileSync("go", ["run", "./cmd/sampledata", path.join(dataDir, "sample")], { cwd: repositoryRoot, stdio: "inherit" });

  const uid = process.getuid?.() ?? 1000;
  const gid = process.getgid?.() ?? 1000;
  docker(
    "run", "-d", "--name", name,
    "-p", `127.0.0.1:${port}:7652`,
    "-e", `PUID=${uid}`, "-e", `PGID=${gid}`,
    "-v", `${configDir}:/config`, "-v", `${dataDir}:/data`,
    image,
  );

  let healthy = false;
  for (let i = 0; i < 60 && !healthy; i++) {
    healthy = await fetch(`${base}/api/health`).then((r) => r.ok, () => false);
    if (!healthy) await sleep(1000);
  }
  check(healthy, "container answers /api/health");

  check((await call("GET", "/")).status === 200, "web UI is served");
  check((await call("GET", "/api/works")).status === 401, "API requires sign-in");
  check((await json("GET", "/api/auth/status")).setupRequired, "fresh instance asks for setup");
  await json("POST", "/api/auth/setup", { password: "synthetic-password" });
  check((await json("GET", "/api/auth/status")).authenticated, "setup signs the user in");

  const lib = await json("POST", "/api/libraries", {
    path: "/data/sample",
    pattern: "{author}/{series}",
    excludes: ["_drafts"],
    readingDirection: "rtl",
    scanInterval: 0,
  });
  for (let i = 0; i < 60; i++) {
    const { scans } = await json("GET", "/api/scan/status");
    const scan = scans.find((s) => s.libraryId === lib.id);
    if (scan && !scan.running) {
      check(!scan.error, `scan finished without error (${scan.added} added)`);
      break;
    }
    await sleep(500);
  }

  const { works, total } = await json("GET", "/api/works?limit=100");
  check(total === 10, `scan indexed the 10 sample works (got ${total})`);
  check(!works.some((w) => w.relPath.startsWith("_drafts")), "excluded folder is not indexed");
  const series = await json("GET", "/api/series");
  check(series.series.some((s) => s.author === "Author A" && s.series === "Series Alpha"), "folder pattern yields author and series");

  const work = works.find((w) => w.title === "Vol 01");
  const page = await call("GET", `/api/works/${work.id}/pages/0`);
  check(page.status === 200 && page.headers.get("content-type") === "image/jpeg", "archive page is served");
  const cover = await call("GET", `/api/works/${work.id}/cover`);
  check(cover.status === 200 && cover.headers.get("content-type") === "image/jpeg", "cover thumbnail is generated");

  const victim = works.find((w) => w.title === "Oneshot");
  const plan = await json("POST", "/api/delete/preview", { workIds: [victim.id] });
  check(plan.items.length === 1 && plan.token, "delete preview lists exactly the selected work");
  const result = await json("POST", "/api/delete/confirm", { token: plan.token });
  check(result.deleted.includes(victim.id), "confirmed deletion reports the work");
  check(!fs.existsSync(path.join(dataDir, "sample", "Author A", "Oneshot.zip")), "deleted file is gone from disk");
  check((await call("POST", "/api/delete/confirm", { token: plan.token })).status === 410, "delete token is single use");
}

try {
  await main();
  console.log("smoke test passed");
} catch (err) {
  console.error(err.message);
  try {
    console.error(docker("logs", "--tail", "50", name));
  } catch {
    // container may not exist
  }
  process.exitCode = 1;
} finally {
  try {
    docker("rm", "-f", name);
  } catch {
    // already gone
  }
  fs.rmSync(root, { recursive: true, force: true });
}
