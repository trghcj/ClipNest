import React from 'react';
import { X, BookOpen } from 'lucide-react';
import type { Bookmark } from '../services/bookmarks';

interface ReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({ isOpen, onClose, bookmark }) => {
  if (!isOpen || !bookmark) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-6">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col border border-border overflow-hidden">
        
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground truncate max-w-xl">
              {bookmark.title || 'Reader Mode'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-12">
          {bookmark.content ? (
            <div 
              className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: bookmark.content }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-4 opacity-20" />
              <p>No article content could be extracted for this page.</p>
              <a 
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 text-primary hover:underline text-sm font-medium"
              >
                Open original link
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
