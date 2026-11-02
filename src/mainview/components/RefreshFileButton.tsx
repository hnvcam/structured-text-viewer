import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RefreshFileButtonProps {
  onRefresh: () => void;
  refreshing: boolean;
}

// Viewer-toolbar button that re-reads the open file from disk.
export function RefreshFileButton({ onRefresh, refreshing }: RefreshFileButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8"
      onClick={onRefresh}
      disabled={refreshing}
      title="Reload File (F5 / Ctrl+R / Cmd+R)"
    >
      <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
    </Button>
  );
}
