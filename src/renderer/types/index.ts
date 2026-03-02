export interface FileTreeItem {
  id: string;
  name: string;
  type: 'folder' | 'markdown' | 'mermaid';
  path: string;
  children?: FileTreeItem[];
}

export interface FileStats {
  size: number;
  modified: string;
  path: string;
}

export type FileType = 'markdown' | 'mermaid' | 'folder';

export interface AppState {
  currentDirectory: string | null;
  selectedFile: string | null;
  sidebarOpen: boolean;
  sidebarWidth: number;
  zoom: number;
  theme: 'light' | 'dark' | 'system';
  expandedFolders: Record<string, boolean>;
}
