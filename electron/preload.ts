import { contextBridge, ipcRenderer } from 'electron';

// Expose IPC channels to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Directory operations
  selectDirectory: () => ipcRenderer.invoke('app:select-directory'),
  getRecentDirectories: () => ipcRenderer.invoke('app:get-recent-directories'),
  getLastDirectory: () => ipcRenderer.invoke('app:get-last-directory'),
  
  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  getFileStats: (filePath: string) => ipcRenderer.invoke('file:get-stats', filePath),
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('file:scan-directory', dirPath),
  scanSubdirectory: (dirPath: string) => ipcRenderer.invoke('file:scan-subdirectory', dirPath),
  
  // Shell operations
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  
  // Store operations
  getExpandedState: () => ipcRenderer.invoke('store:get-expanded-state'),
  setExpandedState: (state: Record<string, boolean>) => ipcRenderer.invoke('store:set-expanded-state', state),
  
  // Platform info
  platform: process.platform,
});

// Type definitions for the exposed API
export interface ElectronAPI {
  // Directory operations
  selectDirectory: () => Promise<string | null>;
  getRecentDirectories: () => Promise<string[]>;
  getLastDirectory: () => Promise<string | null>;
  
  // File operations
  readFile: (filePath: string) => Promise<{ content: string; error?: string }>;
  getFileStats: (filePath: string) => Promise<{ size: number; modified: string; error?: string }>;
  scanDirectory: (dirPath: string) => Promise<FileTreeItem[]>;
  scanSubdirectory: (dirPath: string) => Promise<FileTreeItem[]>;
  
  // Shell operations
  openExternal: (url: string) => Promise<void>;
  
  // Store operations
  getExpandedState: () => Promise<Record<string, boolean>>;
  setExpandedState: (state: Record<string, boolean>) => Promise<void>;
  
  // Platform info
  platform: NodeJS.Platform;
}

export interface FileTreeItem {
  id: string;
  name: string;
  type: 'folder' | 'markdown' | 'mermaid';
  path: string;
  children?: FileTreeItem[];
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
