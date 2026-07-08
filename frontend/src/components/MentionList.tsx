import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Bookmark } from '../services/bookmarks';
import { BookOpen } from 'lucide-react';

export interface MentionListProps {
  items: Bookmark[];
  command: (props: { id: string; label: string; url: string }) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.title || item.url, url: item.url });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return (
      <div className="bg-popover text-popover-foreground rounded-lg border border-border shadow-md p-2 text-sm">
        No results found
      </div>
    );
  }

  return (
    <div className="bg-popover rounded-lg border border-border shadow-md p-1 min-w-[200px] max-w-[300px] max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col z-50">
      {props.items.map((item, index) => (
        <button
          key={index}
          className={`flex items-center gap-2 w-full text-left p-2 text-sm rounded-md transition-colors ${
            index === selectedIndex ? 'bg-primary/10 text-primary font-medium' : 'text-popover-foreground hover:bg-muted'
          }`}
          onClick={() => selectItem(index)}
          type="button"
        >
          <BookOpen className="w-4 h-4 flex-shrink-0 opacity-50" />
          <span className="truncate">{item.title || item.url}</span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';
