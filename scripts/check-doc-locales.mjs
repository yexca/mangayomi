// Verifies that every user-guide locale has exactly the pages of the English
// source, and that every translated locale has a README.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userRoot = path.join(repositoryRoot, "docs", "user");
const manifest = JSON.parse(fs.readFileSync(path.join(userRoot, "translations.json"), "utf8"));
const failures = [];

const expected = manifest.documents.map((d) => d.source).sort();
for (const page of expected) {
  if (!fs.existsSync(path.join(userRoot, manifest.sourceLocale, page))) {
    failures.push(`missing English source: docs/user/${manifest.sourceLocale}/${page}`);
  }
}

for (const locale of manifest.locales) {
  const dir = path.join(userRoot, locale);
  if (!fs.existsSync(dir)) {
    failures.push(`missing locale directory: docs/user/${locale}`);
    continue;
  }
  const actual = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name);
  for (const page of expected) {
    if (!actual.includes(page)) failures.push(`missing ${locale} page: docs/user/${locale}/${page}`);
  }
  for (const page of actual) {
    if (!expected.includes(page)) failures.push(`unexpected ${locale} page: docs/user/${locale}/${page}`);
  }
  if (locale !== manifest.sourceLocale && !fs.existsSync(path.join(repositoryRoot, "docs", "readme", `README.${locale}.md`))) {
    failures.push(`missing translated README: docs/readme/README.${locale}.md`);
  }
}

if (failures.length > 0) {
  console.error(`Found ${failures.length} documentation locale issue(s):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${manifest.locales.length} documentation locales and ${expected.length} user pages.`);
}
