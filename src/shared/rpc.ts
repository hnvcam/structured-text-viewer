import type { RPCSchema } from "electrobun/bun";

export interface FileTreeItem {
  id: string;
  name: string;
  type: 'folder' | 'markdown' | 'mermaid' | 'svg' | 'html' | 'json';
  path: string;
  children?: FileTreeItem[];
}

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getRecentDirectories: { params: {}; response: string[] };
      getLastDirectory: { params: {}; response: string | null };
      getWorkspaces: { params: {}; response: { directories: string[]; active: string | null } };
      setWorkspaces: { params: { directories: string[]; active: string | null }; response: void };
      readFile: { params: { filePath: string }; response: { content: string; error?: string } };
      getFileStats: { params: { filePath: string }; response: { size: number; modified: string; error?: string } };
      scanDirectory: { params: { dirPath: string }; response: FileTreeItem[] };
      openExternal: { params: { url: string }; response: void };
      getExpandedState: { params: {}; response: Record<string, boolean> };
      setExpandedState: { params: { state: Record<string, boolean> }; response: void };
      getFontSize: { params: {}; response: number | null };
      setFontSize: { params: { size: number }; response: void };
      resolveImage: { params: { markdownPath: string; src: string }; response: { dataUrl?: string; error?: string } };
      copyToClipboard: { params: { text: string }; response: boolean };
    };
    messages: {
      openDirectoryDialog: {};
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      directorySelected: { dirPath: string | null };
    };
  }>;
};
