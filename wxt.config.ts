import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    manifest_version: 3,
    name: 'Grass Pass',
    version: '0.1.0',
    description: 'Blocks doomscroll sites until a real-world challenge is completed.',
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'webNavigation', 'tabs', 'notifications'],
    host_permissions: [],
    optional_host_permissions: ['http://127.0.0.1:11434/*', 'http://localhost:11434/*'],
    action: {
      default_title: 'Grass Pass',
      default_popup: 'popup.html',
    },
    background: {
      service_worker: 'background.js',
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    web_accessible_resources: [
      { resources: ['ort/**/*', 'selftest/**/*'], matches: ['<all_urls>'] },
    ],
  },
});
