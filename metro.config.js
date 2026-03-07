const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
// The pnpm workspace root — expo's symlink resolves to
// ../node_modules/.pnpm/... which lives here.
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// pnpm uses a virtual store (.pnpm) where packages only get their own
// declared dependencies. The `expo` symlink in Express-Store/node_modules
// points into the workspace-root .pnpm store, so Metro must watch the
// workspace root and resolve modules from both node_modules trees.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Block Metro from watching native-only directories and non-bundled assets
const BLOCKLIST_RE = [
  // Native source trees inside the pnpm virtual store
  /node_modules[/\\]\.pnpm[/\\].*[/\\]node_modules[/\\].*[/\\](android|ios|\.gradle)[/\\]/,
  // Top-level android directory and gradle build outputs
  /Express-Store[/\\]android[/\\]/,
  // Supabase edge functions and migrations
  /\/supabase\/functions\/.*/,
  /\/supabase\/migrations\/.*/,
];

config.resolver.blockList = [
  ...(config.resolver.blockList ? [].concat(config.resolver.blockList) : []),
  ...BLOCKLIST_RE,
];

module.exports = config;
