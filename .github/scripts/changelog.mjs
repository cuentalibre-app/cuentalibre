// Adds a released version to CHANGELOG.md, newest first, from the release notes GitHub
// generated for it (one line per merged PR, plus new contributors).
//
//   node changelog.mjs release <changelog> <version> <date> <notes file>
import { readFileSync, writeFileSync } from "node:fs";

const [command, file, version, date, notesFile] = process.argv.slice(2);
if (command !== "release" || !notesFile) {
  throw new Error("usage: changelog.mjs release <changelog> <version> <date> <notes file>");
}

const notes = readFileSync(notesFile, "utf8")
  .split("\n")
  // The version heading already says what changed; the rest moves one level down under it
  .filter((line) => line.trim() !== "## What's Changed")
  .map((line) => (line.startsWith("## ") ? `#${line}` : line))
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const text = readFileSync(file, "utf8");
const lines = text.split("\n");
const first = lines.findIndex((line) => line.startsWith("## "));
const head = (first === -1 ? lines : lines.slice(0, first)).join("\n").trimEnd();
const rest = first === -1 ? "" : lines.slice(first).join("\n").trim();

const section = `## ${version} (${date})\n\n${notes}`;
writeFileSync(file, [head, section, rest].filter(Boolean).join("\n\n") + "\n");
