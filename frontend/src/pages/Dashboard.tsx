import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { logoutUser } from '../services/firebase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBookmarks, createBookmark, extractMetadata } from '../services/bookmarks';
// Bookmark type imported in case it's needed later, but not used directly in this scope
import { ExternalLink, Plus, Link as LinkIcon, Loader2 } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: getBookmarks,
  });

  const addBookmarkMutation = useMutation({
    mutationFn: createBookmark,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setIsModalOpen(false);
      setNewUrl('');
      setIsExtracting(false);
    },
  });

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsExtracting(true);
    try {
      // 1. Extract metadata from the URL
      const metadata = await extractMetadata(newUrl);
      
      // 2. Save bookmark with metadata
      await addBookmarkMutation.mutateAsync({
        url: newUrl,
        title: metadata.title,
        description: metadata.description,
        thumbnail_url: metadata.image_url,
        favicon_url: metadata.favicon_url,
      });
    } catch (error) {
      console.error("Failed to add bookmark", error);
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-8 relative min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Library</h2>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.displayName || user?.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-md text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Bookmark
          </button>
          <button 
            onClick={logoutUser}
            className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors rounded-md text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Stat Cards */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            Total Bookmarks
          </div>
          <div className="text-3xl font-bold text-foreground">{bookmarks.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            Unread
          </div>
          <div className="text-3xl font-bold text-foreground">0</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            Collections
          </div>
          <div className="text-3xl font-bold text-foreground">0</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            AI Tags
          </div>
          <div className="text-3xl font-bold text-foreground">0</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center bg-muted/30">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <LinkIcon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-foreground">Your library is empty</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add your first bookmark to start organizing your digital knowledge base.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90 transition-colors font-medium text-sm"
          >
            Add Bookmark
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bookmarks.map((bookmark) => (
            <div 
              key={bookmark.id} 
              onClick={() => window.open(bookmark.url, '_blank')}
              className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 duration-200"
            >
              {bookmark.thumbnail_url ? (
                <div className="h-40 w-full overflow-hidden bg-muted">
                  <img src={bookmark.thumbnail_url} alt={bookmark.title || 'Thumbnail'} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-40 w-full bg-muted/50 flex items-center justify-center border-b border-border">
                  <LinkIcon className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
              
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start gap-2 mb-2">
                  {bookmark.favicon_url && (
                    <img src={bookmark.favicon_url} alt="icon" className="w-4 h-4 mt-1 rounded-sm" />
                  )}
                  <h4 className="font-semibold text-foreground line-clamp-2 leading-tight">
                    {bookmark.title || bookmark.url}
                  </h4>
                </div>
                
                {bookmark.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                    {bookmark.description}
                  </p>
                )}
                
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    {new Date(bookmark.created_at).toLocaleDateString()}
                  </span>
                  <a 
                    href={bookmark.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Bookmark Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Save to Library</h3>
            </div>
            <form onSubmit={handleAddBookmark} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-foreground mb-1">
                    URL Link
                  </label>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://example.com/article"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExtracting || !newUrl}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors rounded-md text-sm font-medium flex items-center gap-2 shadow-sm"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Save Bookmark'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
