// Monorepo-aware Metro config. `@dozari/shared` is consumed as TypeScript source and its files use
// ESM-style `./x.js` specifiers (needed by the Node packages); Metro must map those back to `./x.ts`.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through to the real .js file, if any
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
