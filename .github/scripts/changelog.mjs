// Reads and rewrites CHANGELOG.md for a release. PRs add lines under "## Próxima versión";
// releasing moves the ones that shipped into a section of their own.
//
//   node changelog.mjs notes <changelog>
//     prints what's under "## Próxima versión"
//   node changelog.mjs release <changelog> <version> <date> <shipped notes file>
//     moves the shipped lines from "## Próxima versión" to "## <version> (<date>)", in place
import { readFileSync, writeFileSync } from "node:fs";

const NEXT = "## Próxima versión";

function split(text) {
  const lines = text.split("\n");
  const start = lines.indexOf(NEXT);
  if (start === -1) throw new Error(`CHANGELOG.md has no "${NEXT}" heading`);
  let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  if (end === -1) end = lines.length;
  return { before: lines.slice(0, start), next: lines.slice(start + 1, end), after: lines.slice(end) };
}

const trim = (lines) => {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out.at(-1).trim()) out.pop();
  return out;
};

const [command, file, ...args] = process.argv.slice(2);
const { before, next, after } = split(readFileSync(file, "utf8"));

if (command === "notes") {
  const notes = trim(next);
  if (notes.length) process.stdout.write(notes.join("\n") + "\n");
} else if (command === "release") {
  const [version, date, shippedFile] = args;
  // Lines merged after the promoted commit stay for the next version
  const shipped = new Set(trim(readFileSync(shippedFile, "utf8").split("\n")).filter((l) => l.trim()));
  const kept = trim(next.filter((line) => line.trim() && !shipped.has(line)));
  const released = trim(next.filter((line) => !line.trim() || shipped.has(line)));
  const section = released.some((l) => l.trim()) ? released : ["Correcciones y mejoras internas."];
  const out = [
    ...trim(before),
    "",
    NEXT,
    "",
    ...(kept.length ? [...kept, ""] : []),
    `## ${version} (${date})`,
    "",
    ...section,
    ...(after.length ? ["", ...after] : [""]),
  ];
  writeFileSync(file, out.join("\n").replace(/\n*$/, "\n"));
} else {
  throw new Error(`Unknown command: ${command}`);
}
