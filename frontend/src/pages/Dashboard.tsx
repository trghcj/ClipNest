import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { logoutUser } from '../services/firebase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBookmarks, createBookmark, extractMetadata, deleteBookmark, updateBookmark } from '../services/bookmarks';
import { getCollections, getCollectionBookmarks, addBookmarkToCollection } from '../services/collections';
import { createTag, addTagToBookmark } from '../services/tags';
import type { Bookmark } from '../services/bookmarks';
import { Link as LinkIcon, Plus, Trash2, ExternalLink, Loader2, Edit2, Tag as TagIcon, Sparkles } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCollectionId = searchParams.get('collectionId');
  const searchQuery = searchParams.get('q')?.toLowerCase() || '';
  
  const [isModalOpen, setIsModalOpen] = useState(() => {
    return !!searchParams.get('saveUrl');
  });
  const [newUrl, setNewUrl] = useState(() => {
    return searchParams.get('saveUrl') || '';
  });
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);

  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editTags, setEditTags] = useState('');

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: getCollections,
  });

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ['bookmarks', currentCollectionId],
    queryFn: () => currentCollectionId ? getCollectionBookmarks(currentCollectionId) : getBookmarks(),
  });

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesQuery = !searchQuery || 
      (b.title?.toLowerCase().includes(searchQuery) || false) || 
      (b.description?.toLowerCase().includes(searchQuery) || false) ||
      (b.summary?.toLowerCase().includes(searchQuery) || false) ||
      (b.tags?.some((t: any) => t.name.toLowerCase().includes(searchQuery)) || false);
      
    const aiMatchesParam = searchParams.get('aiMatches');
    const matchesAi = !aiMatchesParam || aiMatchesParam.split(',').includes(b.id);

    return matchesQuery && matchesAi;
  });

  const aiQuery = searchParams.get('aiQuery');

  const addBookmarkMutation = useMutation({
    mutationFn: createBookmark,
    onSuccess: async (data) => {
      if (selectedCollectionId) {
        try {
          await addBookmarkToCollection(selectedCollectionId, data.id);
        } catch (error) {
          console.error("Failed to add to collection", error);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setIsModalOpen(false);
      setNewUrl('');
      setSelectedCollectionId('');
      setIsExtracting(false);
      
      if (searchParams.has('saveUrl')) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('saveUrl');
        window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
      }
    },
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: deleteBookmark,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  const updateBookmarkMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Bookmark> }) => updateBookmark(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setEditingBookmark(null);
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

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this bookmark?")) {
      deleteBookmarkMutation.mutate(id);
    }
  };

  const openEditModal = (e: React.MouseEvent, bookmark: Bookmark) => {
    e.stopPropagation();
    setEditingBookmark(bookmark);
    setEditTitle(bookmark.title || '');
    setEditDescription(bookmark.description || '');
    setEditUrl(bookmark.url);
    setEditTags(bookmark.tags?.map((t: any) => t.name).join(', ') || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookmark) return;
    
    // First update the bookmark details
    updateBookmarkMutation.mutate({
      id: editingBookmark.id,
      updates: {
        title: editTitle,
        description: editDescription,
        url: editUrl,
      }
    });

    // Then handle tags if they changed
    const tagNames = editTags.split(',').map(t => t.trim()).filter(t => t);
    if (tagNames.length > 0) {
      for (const tagName of tagNames) {
        try {
          const tag = await createTag({ name: tagName });
          await addTagToBookmark(tag.id, editingBookmark.id);
        } catch (error) {
          console.error("Failed to add tag", error);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
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
            onClick={() => {
              setSelectedCollectionId(currentCollectionId || '');
              setIsModalOpen(true);
            }}
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
          <div className="text-3xl font-bold text-foreground">{filteredBookmarks.length}</div>
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
          <div className="text-3xl font-bold text-foreground">{collections.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            AI Tags
          </div>
          <div className="text-3xl font-bold text-foreground">0</div>
        </div>
      </div>

      {aiQuery && (
        <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Showing AI Results for: <span className="font-bold text-foreground">"{aiQuery}"</span></span>
          </div>
          <button 
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('aiQuery');
              newParams.delete('aiMatches');
              navigate({ search: newParams.toString() });
            }}
            className="text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors"
          >
            Clear Search
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center bg-muted/30">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <LinkIcon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-foreground">Your library is empty</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add your first bookmark to start organizing your digital knowledge base.
          </p>
          <button 
            onClick={() => {
              setSelectedCollectionId(currentCollectionId || '');
              setIsModalOpen(true);
            }}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90 transition-colors font-medium text-sm"
          >
            Add Bookmark
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBookmarks.map((bookmark) => (
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
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {bookmark.description}
                  </p>
                )}
                
                {bookmark.summary && (
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-2.5 mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      {bookmark.url.includes('youtube.com') || bookmark.url.includes('youtu.be') ? (
                        <>
                          <div className="w-3.5 h-3.5 flex items-center justify-center bg-red-500 rounded-sm text-white">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 ml-0.5">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">YouTube Summary</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">AI Summary</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {bookmark.summary}
                    </p>
                  </div>
                )}
                
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4 mt-auto">
                    {bookmark.tags.map((tag: any) => (
                      <span key={tag.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <TagIcon className="w-3 h-3" />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className={`mt-auto flex items-center justify-between pt-4 border-t border-border/50 ${(!bookmark.tags || bookmark.tags.length === 0) && !bookmark.description ? 'mt-auto' : ''}`}>
                  <span className="text-xs text-muted-foreground">
                    {new Date(bookmark.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => openEditModal(e, bookmark)}
                      className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(e, bookmark.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <a 
                      href={bookmark.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Open Link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
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
                {collections.length > 0 && (
                  <div>
                    <label htmlFor="collection" className="block text-sm font-medium text-foreground mb-1">
                      Collection (Optional)
                    </label>
                    <select
                      id="collection"
                      value={selectedCollectionId}
                      onChange={(e) => setSelectedCollectionId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">No Collection</option>
                      {collections.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
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

      {/* Edit Bookmark Modal */}
      {editingBookmark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Edit Bookmark</h3>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">URL</label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. react, ui, tutorial"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBookmark(null)}
                  className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBookmarkMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors rounded-md text-sm font-medium flex items-center gap-2 shadow-sm"
                >
                  {updateBookmarkMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save Changes'
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
