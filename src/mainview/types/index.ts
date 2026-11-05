export interface FileTreeItem {
  id: string;
  name: string;
  type: 'folder' | 'markdown' | 'mermaid' | 'svg' | 'html';
  path: string;
  children?: FileTreeItem[];
}

export interface FileStats {
  size: number;
  modified: string;
  path: string;
}

// A file type the viewer can open (every tree item type except folders).
export type ViewableFileType = Exclude<FileTreeItem['type'], 'folder'>;

export type FileType = ViewableFileType | null;

export interface AppState {
  currentDirectory: string | null;
  selectedFile: string | null;
  sidebarOpen: boolean;
  sidebarWidth: number;
  zoom: number;
  theme: 'light' | 'dark' | 'system';
  expandedFolders: Record<string, boolean>;
}

// A folder open as a tab, with its own tree and open file.
export interface Workspace {
  dirPath: string;
  treeItems: FileTreeItem[];
  selectedFile: string | null;
  fileType: FileType;
  content: string | null;
  error: string | null;
  stats: { size: number; modified: string } | null;
}
