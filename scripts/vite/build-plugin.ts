import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Copies the hosting binding config and the D1 migrations into dist/.hosting after a build.
export function sites(_options: { mockAuth?: boolean } = {}): Plugin {
  let root = process.cwd();
  let command: "build" | "serve" = "serve";
  return {
    name: "portal-build-output",
    configResolved(config) {
      root = config.root;
      command = config.command;
    },
    async closeBundle() {
      if (command !== "build") return;
      const outputDirectory = resolve(root, "dist", ".hosting");
      const hostingConfig = resolve(root, ".hosting", "config.json");
      const drizzleSource = resolve(root, "drizzle");
      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });
      await cp(hostingConfig, resolve(outputDirectory, "config.json"));
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), { recursive: true });
      }
    },
  };
}
