import React from 'react';
import { ExternalLink, Star, Archive, Trash2, Clock, BookOpen, Highlighter, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface BookmarkCardProps {
  bookmark: any;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleArchive: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onClick: (bookmark: any) => void;
  onHighlightClick: (bookmark: any) => void;
  onEditClick: (bookmark: any) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  onClick,
  onHighlightClick,
  onEditClick
}) => {
  // Calculate reading time based on summary word count if content doesn't exist.
  // Standard reading speed is ~200 words per minute.
  const getReadingTime = () => {
    if (bookmark.url) {
      try {
        const hostname = new URL(bookmark.url).hostname.toLowerCase();
        if (
          hostname === 'youtube.com' ||
          hostname.endsWith('.youtube.com') ||
          hostname === 'youtu.be' ||
          hostname.endsWith('.youtu.be')
        ) {
          return "Video";
        }
      } catch {
        // Ignore malformed URLs and fall back to text-based reading time.
      }
    }
    const text = bookmark.content || bookmark.summary || bookmark.description || "";
    if (!text) return "1 min";
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min`;
  };

  const getDomain = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Format date natively
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    
    if (diffInDays === 0) return 'Saved today';
    if (diffInDays === 1) return 'Saved yesterday';
    if (diffInDays < 7) return `Saved ${diffInDays} days ago`;
    return `Saved ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 10px 40px -10px rgba(0,0,0,0.08)" }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(bookmark)}
      className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-hidden cursor-pointer h-full"
    >
      {/* Thumbnail */}
      <div className="h-40 w-full bg-secondary/50 relative overflow-hidden border-b border-border/50">
        {bookmark.thumbnail_url ? (
          <img 
            src={bookmark.thumbnail_url} 
            alt={bookmark.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/EEF2E6/607D4E?text=No+Preview';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-foreground-secondary opacity-50">
            <ExternalLink className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-medium uppercase tracking-widest">No Preview</span>
          </div>
        )}
        
        {/* Quick Action Overlay (shows on hover) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 translate-x-2 group-hover:translate-x-0 z-10">
          <button 
            onClick={(e) => { e.stopPropagation(); window.open(bookmark.url, '_blank'); }}
            className="w-7 h-7 rounded-full bg-card/90 backdrop-blur-sm shadow-sm flex items-center justify-center text-foreground hover:text-primary transition-colors hover:scale-110 active:scale-95"
            title="Open original link"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClick(bookmark); }}
            className="w-7 h-7 rounded-full bg-card/90 backdrop-blur-sm shadow-sm flex items-center justify-center text-foreground hover:text-primary transition-colors hover:scale-110 active:scale-95"
            title="Read Article"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onHighlightClick(bookmark); }}
            className="w-7 h-7 rounded-full bg-card/90 backdrop-blur-sm shadow-sm flex items-center justify-center text-foreground hover:text-primary transition-colors hover:scale-110 active:scale-95"
            title="View Highlights"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Status Badge */}
        {bookmark.status === 'completed' && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-success text-white text-[10px] font-bold tracking-widest uppercase rounded shadow-sm">
            Completed
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          {bookmark.favicon_url ? (
            <img src={bookmark.favicon_url} alt="" className="w-4 h-4 rounded-sm" />
          ) : (
            <div className="w-4 h-4 bg-muted rounded-sm" />
          )}
          <span className="text-xs font-semibold text-foreground-secondary truncate uppercase tracking-wider">
            {getDomain(bookmark.url)}
          </span>
        </div>
        
        <h3 className="font-display font-bold text-foreground leading-tight mb-2 line-clamp-2">
          {bookmark.title || bookmark.url}
        </h3>
        
        <p className="text-sm text-foreground-secondary line-clamp-2 mb-3 flex-1">
          {bookmark.summary || bookmark.description || "No description available."}
        </p>

        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {bookmark.tags.slice(0, 3).map((tag: any) => (
              <span key={tag.id} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded">
                {tag.name}
              </span>
            ))}
            {bookmark.tags.length > 3 && (
              <span className="px-2 py-0.5 bg-muted text-foreground-secondary text-[10px] font-bold uppercase tracking-wider rounded">
                +{bookmark.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs font-medium text-foreground-secondary/80">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {getReadingTime()}
            </span>
            <span>•</span>
            <span>{formatDate(bookmark.created_at)}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(bookmark.id, bookmark.is_favorite); }}
              className={`p-1.5 rounded-md transition-colors ${bookmark.is_favorite ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-foreground-secondary hover:text-yellow-500 hover:bg-yellow-500/10'}`}
              title="Toggle Favorite"
            >
              <Star className={`w-3.5 h-3.5 ${bookmark.is_favorite ? 'fill-current' : ''}`} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onEditClick(bookmark); }}
              className="p-1.5 text-foreground-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              title="Edit Bookmark"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleArchive(bookmark.id, bookmark.is_archive); }}
              className="p-1.5 text-foreground-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              title={bookmark.is_archived ? "Unarchive" : "Archive"}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(bookmark.id); }}
              className="p-1.5 text-foreground-secondary hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
