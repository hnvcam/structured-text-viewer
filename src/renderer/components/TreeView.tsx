import { Tree, NodeApi, TreeApi } from 'react-arborist';
import { FileText, FileCode, ChevronRight, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileTreeItem } from '@/types';
import { useState, useEffect, useCallback, useRef } from 'react';

interface TreeViewProps {
  items: FileTreeItem[];
  selectedFile: string | null;
  onSelectFile: (path: string, type: 'markdown' | 'mermaid') => void;
  expandedState: Record<string, boolean>;
  onExpandStateChange: (state: Record<string, boolean>) => void;
}

type TreeNode = FileTreeItem;

function FileIcon({ type }: { type: 'folder' | 'markdown' | 'mermaid' }) {
  switch (type) {
    case 'folder':
      return <FolderOpen className="h-4 w-4 text-yellow-500" />;
    case 'markdown':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'mermaid':
      return <FileCode className="h-4 w-4 text-purple-500" />;
  }
}

interface RowProps {
  node: NodeApi<TreeNode>;
  style: React.CSSProperties;
  dragHandle?: React.Ref<HTMLDivElement>;
}

function TreeNodeComponent({ node, style, dragHandle }: RowProps) {
  const data = node.data;
  const isFolder = data.type === 'folder';
  const isSelected = node.isSelected;
  const isExpanded = node.isOpen;

  return (
    <div
      ref={dragHandle as React.Ref<HTMLDivElement>}
      style={style}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-accent',
        isSelected && 'bg-accent'
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (isFolder) {
          node.toggle();
        } else {
          node.select();
        }
      }}
    >
      <div
        className={cn(
          'flex items-center justify-center w-4 h-4 transition-transform',
          !isFolder && 'invisible'
        )}
        style={{
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
      >
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
      </div>
      <FileIcon type={data.type} />
      <span className="truncate text-sm">{data.name}</span>
    </div>
  );
}

export function TreeView({
  items,
  selectedFile,
  onSelectFile,
  expandedState,
  onExpandStateChange,
}: TreeViewProps) {
  const treeRef = useRef<TreeApi<TreeNode>>(null);
  const prevExpandedStateRef = useRef<Record<string, boolean>>({});

  // Sync expanded state with tree (only when it actually changes)
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;

    // Check if expanded state actually changed
    const prevExpanded = prevExpandedStateRef.current;
    const hasChanges = Object.keys(expandedState).some(
      key => prevExpanded[key] !== expandedState[key]
    );

    if (hasChanges) {
      Object.entries(expandedState).forEach(([id, isOpen]) => {
        const node = tree.get(id);
        if (node && node.data.type === 'folder') {
          if (isOpen && !node.isOpen) {
            node.open();
          } else if (!isOpen && node.isOpen) {
            node.close();
          }
        }
      });
      prevExpandedStateRef.current = { ...expandedState };
    }
  }, [expandedState]);

  const handleSelect = useCallback(
    (selection: NodeApi<TreeNode>[]) => {
      if (selection.length > 0) {
        const node = selection[0];
        if (node && node.data.type !== 'folder') {
          onSelectFile(node.data.path, node.data.type as 'markdown' | 'mermaid');
        }
      }
    },
    [onSelectFile]
  );

  const handleToggle = useCallback(
    (id: string) => {
      const tree = treeRef.current;
      if (!tree) return;

      const node = tree.get(id);
      if (!node || node.data.type !== 'folder') return;

      const isOpen = node.isOpen;
      const newExpandedState = { ...expandedState };
      newExpandedState[id] = !isOpen;
      onExpandStateChange(newExpandedState);
    },
    [expandedState, onExpandStateChange]
  );

  // Select the current file in tree when it changes
  useEffect(() => {
    const tree = treeRef.current;
    if (tree && selectedFile) {
      tree.select(selectedFile);
      // Expand parent folders
      let node = tree.get(selectedFile);
      while (node && node.parent) {
        const parent = node.parent;
        if (parent && parent.data.type === 'folder') {
          parent.open();
        }
        node = parent;
      }
    }
  }, [selectedFile]);

  return (
    <div className="h-full w-full">
      <Tree<TreeNode>
        ref={treeRef}
        data={items}
        width="100%"
        rowHeight={28}
        indent={16}
        onSelect={handleSelect}
        onToggle={handleToggle}
      >
        {TreeNodeComponent}
      </Tree>
    </div>
  );
}
