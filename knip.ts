import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.ts'],
  // gi:// is a GJS-specific module scheme; knip extracts 'gi' as the package name
  ignoreDependencies: ['gi'],
  // Exported interfaces/types are used within their own files as type annotations
  ignoreExportsUsedInFile: {
    interface: true,
    type: true,
  },
};

export default config;
