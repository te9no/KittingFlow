import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("dist");
const testDirectory = resolve(outputDirectory, "test");

await mkdir(testDirectory, { recursive: true });
await Promise.all([
  cp(resolve(outputDirectory, "index.html"), resolve(testDirectory, "index.html")),
  cp(resolve(outputDirectory, "favicon.svg"), resolve(testDirectory, "favicon.svg")),
  cp(resolve(outputDirectory, "assets"), resolve(testDirectory, "assets"), { recursive: true })
]);

console.log("Prepared deployable app at /test/.");
