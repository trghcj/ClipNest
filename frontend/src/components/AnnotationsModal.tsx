import React from 'react';
import { X, Highlighter, Trash2, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { Bookmark } from '../services/bookmarks';

interface AnnotationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
}

interface Annotation {
  id: string;
  highlight_text: string;
  note_text: string | null;
  created_at: string;
}

export const AnnotationsModal: React.FC<AnnotationsModalProps> = ({ isOpen, onClose, bookmark }) => {
  const queryClient = useQueryClient();

  const { data: annotations = [], isLoading } = useQuery({
    queryKey: ['annotations', bookmark?.id],
    queryFn: async () => {
      if (!bookmark) return [];
      const res = await apiClient.get(`bookmarks/${bookmark.id}/annotations`);
      return res.data as Annotation[];
    },
    enabled: !!bookmark && isOpen
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`annotations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', bookmark?.id] });
    }
  });

  if (!isOpen || !bookmark) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-6">
      <div className="bg-card w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-xl flex flex-col border border-border overflow-hidden">
        
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Highlighter className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-foreground truncate max-w-sm">
              Highlights for {bookmark.title || 'Bookmark'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : annotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <Highlighter className="w-12 h-12 mb-4 opacity-20" />
              <p>No highlights saved for this page.</p>
              <p className="text-sm mt-2">Use the Chrome extension to highlight text and save it!</p>
            </div>
          ) : (
            annotations.map(ann => (
              <div key={ann.id} className="relative group p-4 rounded-xl border border-border bg-background hover:border-yellow-500/50 transition-colors">
                <button 
                  onClick={() => {
                    if (window.confirm("Delete this highlight?")) deleteMutation.mutate(ann.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="pl-3 border-l-4 border-yellow-500 text-foreground italic text-sm md:text-base leading-relaxed">
                  "{ann.highlight_text}"
                </div>
                {ann.note_text && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium">Note:</span> {ann.note_text}
                  </div>
                )}
                <div className="mt-3 text-xs text-muted-foreground/60 flex items-center gap-1">
                  Saved on {new Date(ann.created_at).toLocaleDateString()}
                  <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="ml-2 hover:text-primary"><ExternalLink className="w-3 h-3" /></a>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
