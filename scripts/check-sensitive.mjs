// Privacy scan for files that would be committed: tracked files plus
// untracked files that are not ignored. It flags runtime data (databases,
// media), personal paths, e-mail addresses, and credential-shaped strings.
//
// A finding that is intentionally public belongs in
// scripts/sensitive-allowlist.json as { "path": "...", "rule": "...", "reason": "..." }.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const self = "scripts/check-sensitive.mjs";
const allowlistPath = path.join(repositoryRoot, "scripts", "sensitive-allowlist.json");
const allowlist = fs.existsSync(allowlistPath) ? JSON.parse(fs.readFileSync(allowlistPath, "utf8")) : [];

const imageDirs = ["web/public/", "docs/assets/"];
const fileRules = [
  { rule: "database", test: (p) => /\.(db|sqlite3?)(-wal|-shm|-journal)?$/iu.test(p) },
  { rule: "media-archive", test: (p) => /\.(zip|cbz|cbr|rar|7z|cb7)$/iu.test(p) },
  { rule: "image-outside-assets", test: (p) => /\.(jpe?g|png|gif|webp|avif|bmp)$/iu.test(p) && !imageDirs.some((d) => p.startsWith(d)) },
  { rule: "env-file", test: (p) => /(^|\/)\.env(\..+)?$/u.test(p) && !p.endsWith(".env.example") },
];

const reservedEmailDomains = /@(example\.(com|org|net|invalid)|users\.noreply\.github\.com)$/iu;
const contentRules = [
  { rule: "windows-user-path", pattern: /\b[A-Za-z]:[\\/]+Users[\\/]+(?!Public\b)[^\\/\s"'`<>]+/gu },
  { rule: "unix-home-path", pattern: /(?<![\w.])\/(?:home|Users)\/[A-Za-z0-9._-]+\//gu },
  { rule: "nas-volume-path", pattern: /(?<![\w.])\/volume\d+\//gu },
  { rule: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gu, ignore: (m) => reservedEmailDomains.test(m) },
  { rule: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu },
  { rule: "github-token", pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{20,}/gu },
  { rule: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
  { rule: "api-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}/gu },
  { rule: "bcrypt-hash", pattern: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/gu },
];

function candidateFiles() {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\0").filter(Boolean);
}

function allowed(file, rule) {
  return allowlist.some((entry) => entry.rule === rule && entry.path === file);
}

function isBinary(buf) {
  return buf.subarray(0, 8000).includes(0);
}

const findings = [];
for (const file of candidateFiles()) {
  const full = path.join(repositoryRoot, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;

  for (const { rule, test } of fileRules) {
    if (test(file) && !allowed(file, rule)) findings.push({ file, rule, line: 0, match: "" });
  }
  if (file === self) continue;

  const buf = fs.readFileSync(full);
  if (buf.length > 4 * 1024 * 1024 || isBinary(buf)) continue;
  const lines = buf.toString("utf8").split(/\r?\n/u);
  lines.forEach((text, i) => {
    for (const { rule, pattern, ignore } of contentRules) {
      for (const match of text.matchAll(pattern)) {
        if (ignore?.(match[0]) || allowed(file, rule)) continue;
        findings.push({ file, rule, line: i + 1, match: match[0].slice(0, 80) });
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`Found ${findings.length} potential sensitive item(s):`);
  for (const f of findings) {
    console.error(`- ${f.file}${f.line ? `:${f.line}` : ""} [${f.rule}]${f.match ? ` ${f.match}` : ""}`);
  }
  console.error("Remove the data, or add a reviewed entry to scripts/sensitive-allowlist.json.");
  process.exitCode = 1;
} else {
  console.log("Privacy scan found nothing to review.");
}
