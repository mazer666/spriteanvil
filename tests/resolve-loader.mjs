import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

async function fileExists(url) {
  try {
    await access(fileURLToPath(url));
    return true;
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, defaultResolve) {
  try {
    const resolved = await defaultResolve(specifier, context);
    if (resolved.url.endsWith(".js")) {
      return resolved;
    }

    const withJs = `${resolved.url}.js`;
    if (withJs.startsWith("file:") && await fileExists(withJs)) {
      return { url: withJs };
    }

    return resolved;
  } catch (error) {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      const parentUrl = context.parentURL ?? pathToFileURL(process.cwd() + "/").href;
      const candidate = new URL(specifier, parentUrl);
      const withJs = `${candidate.href}.js`;
      if (withJs.startsWith("file:") && await fileExists(withJs)) {
        return { url: withJs };
      }
    }
    throw error;
  }
}

export async function load(url, context, defaultLoad) {
  return defaultLoad(url, context);
}
