import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBookmarks, createBookmark, extractMetadata, deleteBookmark, updateBookmark } from '../services/bookmarks';
import { getCollections, getCollectionBookmarks, addBookmarkToCollection } from '../services/collections';
import type { Bookmark } from '../services/bookmarks';
import { Bookmark as BookmarkIcon, Plus, Loader2, Sparkles, BookOpen, Clock, Folder, Tag as TagIcon, TrendingUp, Star, Archive } from 'lucide-react';
import { ReaderModal } from '../components/ReaderModal';
import { AnnotationsModal } from '../components/AnnotationsModal';
import { BookmarkCard } from '../components/BookmarkCard';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCollectionId = searchParams.get('collectionId');
  const searchQuery = searchParams.get('q')?.toLowerCase() || '';
  
  const [isModalOpen, setIsModalOpen] = useState(() => !!searchParams.get('saveUrl'));
  const [newUrl, setNewUrl] = useState(() => searchParams.get('saveUrl') || '');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);

  const [readerBookmark, setReaderBookmark] = useState<Bookmark | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  
  const [annotationsBookmark, setAnnotationsBookmark] = useState<Bookmark | null>(null);
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false);

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: getCollections,
  });

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ['bookmarks', currentCollectionId],
    queryFn: () => currentCollectionId ? getCollectionBookmarks(currentCollectionId) : getBookmarks(),
  });

  const filteredBookmarks = bookmarks.filter((b) => {
    const isArchiveView = searchParams.get('view') === 'archive';
    const matchesArchive = isArchiveView ? b.is_archived : !b.is_archived;

    const matchesQuery = !searchQuery || 
      (b.title?.toLowerCase().includes(searchQuery) || false) || 
      (b.description?.toLowerCase().includes(searchQuery) || false) ||
      (b.summary?.toLowerCase().includes(searchQuery) || false) ||
      (b.tags?.some((t: any) => t.name.toLowerCase().includes(searchQuery)) || false);
      
    const aiMatchesParam = searchParams.get('aiMatches');
    const matchesAi = !aiMatchesParam || aiMatchesParam.split(',').includes(b.id);

    return matchesArchive && matchesQuery && matchesAi;
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
    },
  });

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsExtracting(true);
    try {
      const metadata = await extractMetadata(newUrl);
      await addBookmarkMutation.mutateAsync({
        url: newUrl,
        title: metadata.title,
        description: metadata.description,
        thumbnail_url: metadata.image_url,
        favicon_url: metadata.favicon_url,
        content: metadata.content,
      });
    } catch (error) {
      console.error("Failed to add bookmark", error);
      setIsExtracting(false);
    }
  };

  // Trend Data Calculations
  const now = new Date();
  const activeBookmarks = bookmarks.filter(b => !b.is_archived);
  const thisWeekBookmarks = activeBookmarks.filter(b => (now.getTime() - new Date(b.created_at).getTime()) / (1000 * 3600 * 24) <= 7).length;
  const unreadCount = activeBookmarks.filter(b => b.status === 'unread' || !b.status).length;
  const uniqueTags = new Set(bookmarks.flatMap(b => b.tags?.map(t => t.name) || [])).size;

  const isMainDashboard = !currentCollectionId && !searchQuery && !searchParams.get('view') && !aiQuery;

  // Render Horizontal Section
  const renderSection = (title: string, icon: React.ReactNode, items: Bookmark[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">{title}</h3>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar snap-x">
          {items.map((bookmark) => (
            <div key={bookmark.id} className="min-w-[280px] sm:min-w-[320px] max-w-[320px] shrink-0 snap-start h-[340px]">
              <BookmarkCard 
                bookmark={bookmark}
                onToggleFavorite={(id, curr) => updateBookmarkMutation.mutate({ id, updates: { is_favorite: !curr } })}
                onToggleArchive={(id, curr) => updateBookmarkMutation.mutate({ id, updates: { is_archived: !curr } })}
                onDelete={(id) => window.confirm("Delete this bookmark?") && deleteBookmarkMutation.mutate(id)}
                onClick={(b) => { setReaderBookmark(b); setIsReaderOpen(true); }}
                onHighlightClick={(b) => { setAnnotationsBookmark(b); setIsAnnotationsOpen(true); }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-end justify-between pb-4 border-b border-border/50">
        <div>
          <h2 className="text-[42px] font-display font-bold tracking-tight text-foreground leading-tight">
            My Library
          </h2>
          <p className="text-lg font-medium text-foreground-secondary mt-1">
            Welcome back, {user?.displayName || user?.email?.split('@')[0]}
          </p>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <button 
            onClick={() => {
              setSelectedCollectionId(currentCollectionId || '');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white hover:bg-primary-hover transition-colors rounded-lg text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Bookmark
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 text-sm font-semibold text-foreground-secondary mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <BookmarkIcon className="w-4 h-4" />
            </div>
            Bookmarks
          </div>
          <div className="text-3xl font-display font-bold text-foreground mb-2">
            {activeBookmarks.length}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <TrendingUp className="w-3.5 h-3.5" />
            +{thisWeekBookmarks} this week
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 text-sm font-semibold text-foreground-secondary mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <BookOpen className="w-4 h-4" />
            </div>
            Unread
          </div>
          <div className="text-3xl font-display font-bold text-foreground mb-2">
            {unreadCount}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary">
            <Clock className="w-3.5 h-3.5" />
            Requires attention
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 text-sm font-semibold text-foreground-secondary mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600">
              <Folder className="w-4 h-4" />
            </div>
            Collections
          </div>
          <div className="text-3xl font-display font-bold text-foreground mb-2">
            {collections.length}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary">
            <Archive className="w-3.5 h-3.5" />
            Highly organized
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 text-sm font-semibold text-foreground-secondary mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
              <TagIcon className="w-4 h-4" />
            </div>
            Total Tags
          </div>
          <div className="text-3xl font-display font-bold text-foreground mb-2">
            {uniqueTags}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary">
            <TagIcon className="w-3.5 h-3.5" />
            Across library
          </div>
        </motion.div>
      </div>

      {aiQuery && (
        <div className="bg-primary/10 border border-primary/20 text-primary px-5 py-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
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
            className="text-xs font-bold uppercase tracking-wider hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-primary/10"
          >
            Clear Search
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : activeBookmarks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-16 text-center flex flex-col items-center justify-center bg-card shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-sm">
            <BookmarkIcon className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">Your library is empty</h3>
          <p className="text-base text-foreground-secondary mt-2 max-w-sm">
            Add your first bookmark to start organizing your digital knowledge base.
          </p>
          <button 
            onClick={() => {
              setSelectedCollectionId(currentCollectionId || '');
              setIsModalOpen(true);
            }}
            className="mt-8 px-6 py-3 bg-primary text-white rounded-lg shadow-sm hover:bg-primary-hover transition-colors font-semibold text-sm"
          >
            Add Bookmark
          </button>
        </div>
      ) : isMainDashboard ? (
        <div className="space-y-4">
          {renderSection("Continue Reading", <BookOpen className="w-5 h-5" />, activeBookmarks.filter(b => b.status === 'reading' || b.status === 'unread').slice(0, 8))}
          {renderSection("Recently Saved", <Clock className="w-5 h-5" />, [...activeBookmarks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8))}
          {renderSection("Favorites", <Star className="w-5 h-5" />, activeBookmarks.filter(b => b.is_favorite))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBookmarks.map((bookmark) => (
            <div key={bookmark.id} className="h-[340px]">
              <BookmarkCard 
                bookmark={bookmark}
                onToggleFavorite={(id, curr) => updateBookmarkMutation.mutate({ id, updates: { is_favorite: !curr } })}
                onToggleArchive={(id, curr) => updateBookmarkMutation.mutate({ id, updates: { is_archived: !curr } })}
                onDelete={(id) => window.confirm("Are you sure you want to delete this bookmark?") && deleteBookmarkMutation.mutate(id)}
                onClick={(b) => { setReaderBookmark(b); setIsReaderOpen(true); }}
                onHighlightClick={(b) => { setAnnotationsBookmark(b); setIsAnnotationsOpen(true); }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Bookmark Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden"
          >
            <div className="p-6 border-b border-border/50 bg-secondary/30">
              <h3 className="text-xl font-display font-bold text-foreground">Save to Library</h3>
            </div>
            <form onSubmit={handleAddBookmark} className="p-6">
              <div className="space-y-5">
                <div>
                  <label htmlFor="url" className="block text-sm font-semibold text-foreground mb-1.5">
                    URL Link
                  </label>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://example.com/article"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 shadow-sm transition-all"
                  />
                </div>
                {collections.length > 0 && (
                  <div>
                    <label htmlFor="collection" className="block text-sm font-semibold text-foreground mb-1.5">
                      Collection (Optional)
                    </label>
                    <select
                      id="collection"
                      value={selectedCollectionId}
                      onChange={(e) => setSelectedCollectionId(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 shadow-sm transition-all appearance-none"
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
                  className="px-5 py-2.5 text-sm font-semibold text-foreground-secondary hover:bg-secondary rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExtracting || !newUrl}
                  className="px-5 py-2.5 bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
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
          </motion.div>
        </div>
      )}
      
      <ReaderModal 
        isOpen={isReaderOpen}
        onClose={() => setIsReaderOpen(false)}
        bookmark={readerBookmark}
      />
      
      <AnnotationsModal 
        isOpen={isAnnotationsOpen}
        onClose={() => setIsAnnotationsOpen(false)}
        bookmark={annotationsBookmark}
      />
    </div>
  );
};

export default Dashboard;
