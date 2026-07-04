import { X, Tag as TagIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

interface TagsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TagsModal({ isOpen, onClose }: TagsModalProps) {
  const navigate = useNavigate();
  
  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: async () => {
      const response = await apiClient.get('/bookmarks');
      return response.data;
    }
  });

  if (!isOpen) return null;

  // Extract unique tags and count them
  const tagCounts = new Map<string, number>();
  bookmarks.forEach((b: any) => {
    b.tags?.forEach((t: any) => {
      tagCounts.set(t.name, (tagCounts.get(t.name) || 0) + 1);
    });
  });

  const uniqueTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <TagIcon className="w-5 h-5 text-primary" />
            <h2>Your AI Tags</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {uniqueTags.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No tags generated yet.</p>
              <p className="text-sm mt-1">Save some bookmarks to see AI tags here!</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {uniqueTags.map(([tagName, count]) => (
                <button
                  key={tagName}
                  onClick={() => {
                    navigate(`/?q=${encodeURIComponent(tagName)}`);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <TagIcon className="w-3.5 h-3.5" />
                  {tagName}
                  <span className="opacity-70 text-xs ml-1">({count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
