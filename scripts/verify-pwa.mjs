import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const origin = "https://neuralequation.github.io";
const base = new URL("/studytrace/", origin);
const read = (path) => readFile(resolve(dist, path), "utf8");
const manifest = JSON.parse(await read("studytrace.webmanifest"));

// Emulate the browser's ID resolution: even './' would resolve to the host root.
const appId = new URL(manifest.id, origin + "/").href;
assert.equal(appId, base.href, "StudyTrace must have its own stable application ID");
assert.notEqual(appId, new URL("/essay/", origin).href);
assert.equal(new URL(manifest.scope, base).href, base.href);
assert.equal(new URL(manifest.start_url, base).href, new URL("index.html?launch=pwa", base).href);
assert.equal(manifest.display, "standalone");

for (const name of ["index.html", "install.html"]) {
  const html = await read(name);
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => match[0]);
  const link = links.find((tag) => /rel=["']manifest["']/.test(tag));
  assert.ok(link, `${name} must reference a manifest`);
  const href = link.match(/href=["']([^"']+)["']/)?.[1];
  assert.equal(new URL(href, base).href, new URL("studytrace.webmanifest", base).href);
}
await access(resolve(dist, "install.js"));
for (const size of [192, 512]) {
  const icon = manifest.icons.find((icon) => icon.sizes === `${size}x${size}` && icon.purpose === "any");
  assert.ok(icon, `Missing ${size}px install icon`);
  const bytes = await readFile(resolve(dist, icon.src));
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
}

// Inspect the generated worker through its Workbox API, without depending on minification.
let precache;
let navigation;
let forcedActivation = false;
const workbox = {
  precacheAndRoute(entries) { precache = entries; },
  registerRoute(route) { navigation = route; },
  createHandlerBoundToURL(url) { return url; },
  NavigationRoute: class {
    constructor(handler, options) { this.handler = handler; this.options = options; }
  },
};
const define = (_dependencies, factory) => factory(workbox);
runInNewContext(await read("sw.js"), {
  define,
  self: {
    define,
    addEventListener() {},
    skipWaiting() { forcedActivation = true; },
  },
});
assert.ok(precache?.some((entry) => entry.url === "index.html"), "App shell must remain available offline");
assert.ok(precache.some((entry) => entry.url === "studytrace.webmanifest"));
assert.ok(!precache.some((entry) => /(?:^|\/)install\.(?:html|js)$/.test(entry.url)), "Installer must use fresh network files");
assert.equal(navigation?.handler, "index.html");
assert.ok(navigation.options.denylist.some((pattern) => pattern.test("/studytrace/install.html")), "Installer must bypass the app shell fallback");
assert.ok(!navigation.options.denylist.some((pattern) => pattern.test("/studytrace/index.html")));
assert.equal(forcedActivation, false, "An update must not interrupt active study tabs");
for (const entry of precache) await access(resolve(dist, entry.url));

console.log("PWA verification passed: unique ID, shared manifest, launch URL, raster icons, offline shell, fresh installer, safe activation.");
