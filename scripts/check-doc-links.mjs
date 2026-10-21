// Verifies that every relative link in the public Markdown documentation
// resolves to an existing file. External URLs and in-page anchors are skipped.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRootFiles = ["README.md", "AGENTS.md", "CONTRIBUTING.md", "SECURITY.md", "PRIVACY.md"];
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
const htmlLink = /<(?:a|img)\b[^>]*?\b(?:href|src)\s*=\s*(["'])(.*?)\1/giu;

function markdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
  });
}

function linkTarget(raw) {
  const value = raw.trim();
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    return end > 1 ? value.slice(1, end) : value;
  }
  return value.split(/\s+/u, 1)[0];
}

function isExternal(target) {
  return target === "" || target.startsWith("#") || target.startsWith("//") || /^[a-z][a-z0-9+.-]*:/iu.test(target);
}

function resolveTarget(sourceFile, target) {
  let clean = target.split("#", 1)[0].split("?", 1)[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Report malformed escapes as missing paths.
  }
  const local = clean.split("/").join(path.sep);
  return local.startsWith(path.sep)
    ? path.resolve(repositoryRoot, local.slice(1))
    : path.resolve(path.dirname(sourceFile), local);
}

function checkFile(file) {
  // Blank out fenced code blocks but keep line numbers stable.
  let fence = null;
  const source = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .map((line) => {
      const match = line.trimStart().match(/^(`{3,}|~{3,})/u);
      if (match) {
        const marker = match[1][0];
        fence = fence === null ? marker : fence === marker ? null : fence;
        return "";
      }
      return fence === null ? line : "";
    })
    .join("\n");

  const links = [
    ...Array.from(source.matchAll(markdownLink), (m) => ({ index: m.index, target: linkTarget(m[1]) })),
    ...Array.from(source.matchAll(htmlLink), (m) => ({ index: m.index, target: m[2] })),
  ];
  return links
    .filter(({ target }) => !isExternal(target))
    .map(({ index, target }) => ({ file, target, line: source.slice(0, index).split("\n").length, resolved: resolveTarget(file, target) }))
    .filter(({ resolved }) => !fs.existsSync(resolved));
}

const files = [
  ...publicRootFiles.map((f) => path.join(repositoryRoot, f)).filter((f) => fs.existsSync(f)),
  ...markdownFiles(path.join(repositoryRoot, "docs")),
  ...markdownFiles(path.join(repositoryRoot, ".claude", "skills")),
];
const failures = files.flatMap(checkFile);

if (failures.length > 0) {
  console.error(`Found ${failures.length} broken Markdown link(s):`);
  for (const f of failures) {
    console.error(`- ${path.relative(repositoryRoot, f.file)}:${f.line} -> ${f.target}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} public Markdown files; all relative links resolve.`);
}
