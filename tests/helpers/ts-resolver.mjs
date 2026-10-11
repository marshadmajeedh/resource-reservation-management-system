import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Custom ESM resolver for Node 24 test runner.
 * Enables:
 * 1. Extensionless relative imports within Prisma generated client (e.g., ./enums -> ./enums.ts).
 * 2. Next.js "@/..." path alias resolution to "./src/...".
 * 3. Mocking "server-only" to an empty module so server-only modules can be tested in Node.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      format: "module",
      shortCircuit: true,
      url: "data:text/javascript,export default {};",
    };
  }

  // Handle @/ alias
  if (specifier.startsWith("@/")) {
    const relativeSubpath = specifier.slice(2);
    const resolvedPath = path.resolve(process.cwd(), "src", relativeSubpath);
    if (fs.existsSync(resolvedPath + ".ts")) {
      return nextResolve(pathToFileURL(resolvedPath + ".ts").href, context);
    }
    if (fs.existsSync(resolvedPath)) {
      return nextResolve(pathToFileURL(resolvedPath).href, context);
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      err &&
      err.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      const parentDir = context.parentURL
        ? path.dirname(fileURLToPath(context.parentURL))
        : process.cwd();
      const targetPath = path.resolve(parentDir, specifier);

      if (fs.existsSync(targetPath + ".ts")) {
        return nextResolve(pathToFileURL(targetPath + ".ts").href, context);
      }
      if (fs.existsSync(path.join(targetPath, "index.ts"))) {
        return nextResolve(
          pathToFileURL(path.join(targetPath, "index.ts")).href,
          context
        );
      }
    }
    throw err;
  }
}
