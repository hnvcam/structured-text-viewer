import { Tree, NodeApi, TreeApi } from 'react-arborist';
import { FileText, FileCode, FileImage, ChevronRight, FolderOpen, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileTreeItem, ViewableFileType } from '@/types';
import { useCallback, useRef, useState, useEffect } from 'react';

interface TreeViewProps {
  items: FileTreeItem[];
  selectedFile: string | null;
  onSelectFile: (path: string, type: ViewableFileType) => void;
  expandedState: Record<string, boolean>;
  onExpandStateChange: (state: Record<string, boolean>) => void;
}

type TreeNode = FileTreeItem;

export function FileIcon({ type, className = 'h-4 w-4' }: { type: FileTreeItem['type']; className?: string }) {
  switch (type) {
    case 'folder':
      return <FolderOpen className={cn(className, 'text-yellow-500')} />;
    case 'markdown':
      return <FileText className={cn(className, 'text-blue-500')} />;
    case 'mermaid':
      return <FileCode className={cn(className, 'text-purple-500')} />;
    case 'svg':
      return <FileImage className={cn(className, 'text-green-500')} />;
    case 'html':
      return <Globe className={cn(className, 'text-orange-500')} />;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(600);

  // Update tree height when container resizes
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setTreeHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    // Use ResizeObserver if available, otherwise fallback to window resize
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      if (containerRef.current) {
        observer.observe(containerRef.current);
      }
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, []);

  const handleSelect = useCallback(
    (selection: NodeApi<TreeNode>[]) => {
      if (selection.length > 0) {
        const node = selection[0];
        if (node && node.data.type !== 'folder') {
          onSelectFile(node.data.path, node.data.type as ViewableFileType);
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

      const newExpandedState = { ...expandedState };
      newExpandedState[id] = node.isOpen;

      onExpandStateChange(newExpandedState);
    },
    [expandedState, onExpandStateChange]
  );

  // Select the current file in tree when it changes and expand parents
  const hasExpandedParents = useRef(false);
  if (treeRef.current && selectedFile && !hasExpandedParents.current) {
    const tree = treeRef.current;
    let node = tree.get(selectedFile);
    while (node && node.parent) {
      const parent = node.parent;
      if (parent && parent.data.type === 'folder' && !parent.isOpen) {
        parent.open();
      }
      node = parent;
    }
    hasExpandedParents.current = true;
  }

  // Reset the ref when selectedFile changes
  if (selectedFile === null) {
    hasExpandedParents.current = false;
  }

  // keep the tree in sync with our external expandedState map
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;

    // iterate through every entry and open/close accordingly
    for (const [id, isOpen] of Object.entries(expandedState)) {
      const node = tree.get(id);
      if (!node || node.data.type !== 'folder') continue;

      if (isOpen && !node.isOpen) {
        node.open();
      } else if (!isOpen && node.isOpen) {
        node.close();
      }
    }
  }, [expandedState]);

  return (
    <div ref={containerRef} className="flex-1 w/full">
      {/* feed the filtered state to the tree initially, and keep it updated via effect */}
      <Tree<TreeNode>
        ref={treeRef}
        data={items}
        width="100%"
        height={treeHeight}
        rowHeight={28}
        indent={16}
        initialOpenState={
          Object.fromEntries(
            Object.entries(expandedState).filter(([, v]) => v)
          )
        }
        onSelect={handleSelect}
        onToggle={handleToggle}
      >
        {TreeNodeComponent}
      </Tree>
    </div>
  );
}
