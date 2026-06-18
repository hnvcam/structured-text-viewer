import path from "path";
import fs from "fs";

const buildDir = process.env.ELECTROBUN_BUILD_DIR;
const os = process.env.ELECTROBUN_OS;
const appName = process.env.ELECTROBUN_APP_NAME;

console.log(`[post-build] Build dir: ${buildDir}`);
console.log(`[post-build] OS: ${os}`);
console.log(`[post-build] App name: ${appName}`);

if (!buildDir || os !== "linux") {
  console.log("[post-build] Not a Linux build or no build dir, skipping");
  process.exit(0);
}

const desktopSrc = path.join(import.meta.dir, "..", "src", "StructuredTextViewer.desktop");
if (!fs.existsSync(desktopSrc)) {
  console.log("[post-build] No desktop file found at", desktopSrc);
  process.exit(0);
}

// List top-level items in build dir
console.log("[post-build] Build dir contents:");
for (const entry of fs.readdirSync(buildDir)) {
  const stat = fs.statSync(path.join(buildDir, entry));
  console.log(`  ${stat.isDirectory() ? "[dir]" : "[file]"} ${entry}`);
}

// Find the app bundle directory in the build dir
const entries = fs.readdirSync(buildDir).filter(e => {
  try {
    return fs.statSync(path.join(buildDir, e)).isDirectory();
  } catch {
    return false;
  }
});

const appBundleDir = entries.find(e => !e.startsWith(".")) || entries[0];

if (appBundleDir) {
  const desktopDest = path.join(buildDir, appBundleDir, `${appBundleDir}.desktop`);
  fs.copyFileSync(desktopSrc, desktopDest);
  console.log(`[post-build] Added ${appBundleDir}.desktop to ${path.join(buildDir, appBundleDir)}`);
} else {
  console.log("[post-build] No app bundle directory found in build dir");
  process.exit(1);
}
