import type { RPCSchema } from "electrobun/bun";

export interface FileTreeItem {
  id: string;
  name: string;
  type: 'folder' | 'markdown' | 'mermaid';
  path: string;
  children?: FileTreeItem[];
}

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      selectDirectory: { params: {}; response: string | null };
      getRecentDirectories: { params: {}; response: string[] };
      getLastDirectory: { params: {}; response: string | null };
      readFile: { params: { filePath: string }; response: { content: string; error?: string } };
      getFileStats: { params: { filePath: string }; response: { size: number; modified: string; error?: string } };
      scanDirectory: { params: { dirPath: string }; response: FileTreeItem[] };
      openExternal: { params: { url: string }; response: void };
      getExpandedState: { params: {}; response: Record<string, boolean> };
      setExpandedState: { params: { state: Record<string, boolean> }; response: void };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
