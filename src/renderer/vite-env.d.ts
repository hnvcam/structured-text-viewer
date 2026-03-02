/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_SERVER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  getRecentDirectories: () => Promise<string[]>;
  getLastDirectory: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<{ content: string; error?: string }>;
  getFileStats: (filePath: string) => Promise<{ size: number; modified: string; error?: string }>;
  scanDirectory: (dirPath: string) => Promise<FileTreeItem[]>;
  scanSubdirectory: (dirPath: string) => Promise<FileTreeItem[]>;
  openExternal: (url: string) => Promise<void>;
  getExpandedState: () => Promise<Record<string, boolean>>;
  setExpandedState: (state: Record<string, boolean>) => Promise<void>;
  platform: NodeJS.Platform;
}

interface FileTreeItem {
  id: string;
  name: string;
  type: 'folder' | 'markdown' | 'mermaid';
  path: string;
  children?: FileTreeItem[];
}

interface Window {
  electronAPI: ElectronAPI;
}
