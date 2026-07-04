import React, { useState } from 'react';
import { Sparkles, X, Loader2, Search } from 'lucide-react';
import { aiSearchBookmarks } from '../services/bookmarks';
import { useNavigate } from 'react-router-dom';

interface AISearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISearchModal: React.FC<AISearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const { matching_ids } = await aiSearchBookmarks(query);
      
      // Navigate to Dashboard with aiSearch filter
      const searchParams = new URLSearchParams();
      searchParams.set('aiQuery', query);
      searchParams.set('aiMatches', matching_ids.join(','));
      
      navigate({ search: searchParams.toString() });
      onClose();
    } catch (error) {
      console.error('AI Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh] px-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-primary/20 overflow-hidden transform transition-all">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-primary/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Chat with your Library</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="p-6">
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'Find me that article about React hooks' or 'What are the best tips for time management?'"
              className="w-full bg-muted/50 border border-input rounded-xl pl-4 pr-12 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground shadow-inner"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-primary text-primary-foreground rounded-lg flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Powered by Gemini AI. It understands semantics, concepts, and relationships in your saved bookmarks.
          </p>
        </form>
      </div>
    </div>
  );
};
