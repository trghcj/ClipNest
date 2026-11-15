import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBookmarks, createBookmark, deleteBookmark, updateBookmark, uploadPdfBookmark, backfillAI } from '../services/bookmarks';
import { getCollections, getCollectionBookmarks, addBookmarkToCollection } from '../services/collections';
import type { Bookmark, BookmarkUpdate } from '../services/bookmarks';
import { Bookmark as BookmarkIcon, Plus, Loader2, Sparkles, BookOpen, Clock, Folder, Tag as TagIcon, TrendingUp, Star, Archive } from 'lucide-react';
import { BookmarkCard } from '../components/BookmarkCard';
import { motion } from 'framer-motion';

// The reader pulls in the rich-text editor (Tiptap) — load it only when a bookmark is opened.
const ReaderModal = lazy(() => import('../components/ReaderModal').then((m) => ({ default: m.ReaderModal })));
const AnnotationsModal = lazy(() => import('../components/AnnotationsModal').then((m) => ({ default: m.AnnotationsModal })));

// AI summary/tags/collection are generated in the background after saving; refresh once they're likely ready.
const AI_REFRESH_DELAY_MS = 12_000;

const Dashboard = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCollectionId = searchParams.get('collectionId');
  const searchQuery = searchParams.get('q')?.toLowerCase() || '';
  const viewParam = searchParams.get('view');
  const aiQuery = searchParams.get('aiQuery');
  const aiMatchesParam = searchParams.get('aiMatches');

  const [isModalOpen, setIsModalOpen] = useState(() => !!searchParams.get('saveUrl'));
  const [newUrl, setNewUrl] = useState(() => searchParams.get('saveUrl') || '');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [showCollectionArchived, setShowCollectionArchived] = useState(false);
  const [addMode, setAddMode] = useState<'url' | 'pdf'>('url');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [readerBookmark, setReaderBookmark] = useState<Bookmark | null>(null);
  const [annotationsBookmark, setAnnotationsBookmark] = useState<Bookmark | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editTags, setEditTags] = useState('');

  const openEditModal = useCallback((bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setEditTitle(bookmark.title || '');
    setEditDescription(bookmark.description || '');
    setEditUrl(bookmark.url || '');
    setEditTags(bookmark.tags?.map((t) => t.name).join(', ') || '');
  }, []);

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: getCollections,
  });

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ['bookmarks', currentCollectionId],
    queryFn: () => currentCollectionId ? getCollectionBookmarks(currentCollectionId) : getBookmarks(),
  });

  // ---- Cache helpers: patch every cached bookmark list in place instead of refetching the library.
  const patchCachedBookmarks = useCallback((fn: (list: Bookmark[]) => Bookmark[]) => {
    queryClient.setQueriesData<Bookmark[]>({ queryKey: ['bookmarks'] }, (old) => (Array.isArray(old) ? fn(old) : old));
  }, [queryClient]);

  const snapshotBookmarks = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
    return queryClient.getQueriesData<Bookmark[]>({ queryKey: ['bookmarks'] });
  }, [queryClient]);

  const restoreBookmarks = useCallback((snapshot?: [readonly unknown[], Bookmark[] | undefined][]) => {
    snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
  }, [queryClient]);

  const updateBookmarkMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: BookmarkUpdate }) => updateBookmark(id, updates),
    onMutate: async ({ id, updates }) => {
      const snapshot = await snapshotBookmarks();
      const { tags: _tags, ...fields } = updates; // tags are resolved server-side
      patchCachedBookmarks((list) => list.map((b) => (b.id === id ? { ...b, ...fields } : b)));
      return { snapshot };
    },
    onError: (_err, _vars, context) => restoreBookmarks(context?.snapshot),
    onSuccess: (saved) => {
      patchCachedBookmarks((list) => list.map((b) => (b.id === saved.id ? saved : b)));
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: deleteBookmark,
    onMutate: async (id: string) => {
      const snapshot = await snapshotBookmarks();
      patchCachedBookmarks((list) => list.filter((b) => b.id !== id));
      return { snapshot };
    },
    onError: (_err, _id, context) => restoreBookmarks(context?.snapshot),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analytics'] }),
  });

  // Stable handlers so memoised cards don't re-render on every Dashboard render.
  const { mutate: updateMutate } = updateBookmarkMutation;
  const { mutate: deleteMutate } = deleteBookmarkMutation;
  const handleToggleFavorite = useCallback((id: string, curr: boolean) => updateMutate({ id, updates: { is_favorite: !curr } }), [updateMutate]);
  const handleToggleArchive = useCallback((id: string, curr: boolean) => updateMutate({ id, updates: { is_archived: !curr } }), [updateMutate]);
  const handleDelete = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this bookmark?')) deleteMutate(id);
  }, [deleteMutate]);
  const handleOpenReader = useCallback((b: Bookmark) => setReaderBookmark(b), []);
  const handleOpenAnnotations = useCallback((b: Bookmark) => setAnnotationsBookmark(b), []);

  const renderCard = (bookmark: Bookmark) => (
    <BookmarkCard
      bookmark={bookmark}
      onToggleFavorite={handleToggleFavorite}
      onToggleArchive={handleToggleArchive}
      onDelete={handleDelete}
      onClick={handleOpenReader}
      onHighlightClick={handleOpenAnnotations}
      onEditClick={openEditModal}
    />
  );

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookmark) return;

    const tagNames = editTags.split(',').map(t => t.trim()).filter(t => t);

    await updateBookmarkMutation.mutateAsync({
      id: editingBookmark.id,
      updates: {
        title: editTitle,
        description: editDescription,
        url: editUrl,
        tags: tagNames
      }
    });
    setEditingBookmark(null);
  };

  const filteredBookmarks = useMemo(() => {
    const isArchiveView = viewParam === 'archive';
    const aiMatches = aiMatchesParam ? new Set(aiMatchesParam.split(',')) : null;
    return bookmarks.filter((b) => {
      let matchesArchive: boolean;
      if (isArchiveView) {
        matchesArchive = b.is_archived;
      } else if (currentCollectionId) {
        matchesArchive = showCollectionArchived ? b.is_archived : !b.is_archived;
      } else {
        matchesArchive = !b.is_archived;
      }

      const matchesQuery = !searchQuery ||
        (b.title?.toLowerCase().includes(searchQuery) || false) ||
        (b.description?.toLowerCase().includes(searchQuery) || false) ||
        (b.summary?.toLowerCase().includes(searchQuery) || false) ||
        (b.tags?.some((t) => t.name.toLowerCase().includes(searchQuery)) || false);

      const matchesAi = !aiMatches || aiMatches.has(b.id);
      return matchesArchive && matchesQuery && matchesAi;
    });
  }, [bookmarks, viewParam, aiMatchesParam, currentCollectionId, showCollectionArchived, searchQuery]);

  const addBookmarkMutation = useMutation({
    mutationFn: createBookmark,
  });

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === 'url' && !newUrl) return;
    if (addMode === 'pdf' && !pdfFile) return;

    setIsExtracting(true);
    try {
      // The server fetches the page and extracts title/description/content in one step.
      const data: Bookmark & { already_saved?: boolean } = addMode === 'pdf' && pdfFile
        ? await uploadPdfBookmark(pdfFile)
        : await addBookmarkMutation.mutateAsync({ url: newUrl });
      if (selectedCollectionId) {
        try {
          await addBookmarkToCollection(selectedCollectionId, data.id);
        } catch (error) {
          console.error("Failed to add to collection", error);
        }
      }
      setIsModalOpen(false);
      setNewUrl('');
      setPdfFile(null);
      setSelectedCollectionId('');
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      if (data.already_saved) {
        alert(selectedCollectionId
          ? 'This link is already in your library, so it was added to the collection instead.'
          : 'This link is already in your library.');
      } else {
        window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
          queryClient.invalidateQueries({ queryKey: ['collections'] });
        }, AI_REFRESH_DELAY_MS);
      }

      if (searchParams.has('saveUrl')) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('saveUrl');
        window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
      }
    } catch (error) {
      console.error("Failed to add bookmark", error);
      alert(error instanceof Error && error.message ? error.message : "Failed to save. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Trend Data Calculations
  const { activeBookmarks, thisWeekBookmarks, unreadCount, uniqueTags, manualTagNames, missingSummaryCount } = useMemo(() => {
    const now = Date.now();
    const active = bookmarks.filter(b => !b.is_archived);
    return {
      // Older than 2 minutes, so bookmarks whose AI step is still running aren't counted.
      missingSummaryCount: bookmarks.filter(b => !b.summary && now - new Date(b.created_at).getTime() > 120_000).length,
      activeBookmarks: active,
      thisWeekBookmarks: active.filter(b => (now - new Date(b.created_at).getTime()) / (1000 * 3600 * 24) <= 7).length,
      unreadCount: active.filter(b => b.status !== 'completed').length,
      uniqueTags: new Set(bookmarks.flatMap(b => b.tags?.map(t => t.name) || [])).size,
      manualTagNames: Array.from(new Set(bookmarks.flatMap(b => b.tags?.filter(t => !t.is_ai_generated).map(t => t.name) || []))).sort(),
    };
  }, [bookmarks]);

  const isMainDashboard = !currentCollectionId && !searchQuery && !viewParam && !aiQuery;

  // "Generate missing AI summaries" (bookmarks whose AI step was lost to a restart, or that
  // were saved while the page couldn't be fetched).
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const handleBackfill = async () => {
    setIsBackfilling(true);
    try {
      const { queued, remaining } = await backfillAI();
      setBackfillMessage(queued
        ? `Generating summaries for ${queued} bookmark${queued === 1 ? '' : 's'}${remaining ? ` (${remaining} more after this batch)` : ''}. They'll appear over the next few minutes.`
        : 'Nothing to generate.');
      // Processed one at a time in the background; refresh a few times as they land.
      [20_000, 60_000, 120_000, 240_000].forEach((ms) =>
        window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }), ms));
    } catch (error) {
      setBackfillMessage(error instanceof Error ? error.message : 'Could not start generating summaries.');
    } finally {
      setIsBackfilling(false);
    }
  };

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
              {renderCard(bookmark)}
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
          {currentCollectionId && (
            <button 
              onClick={() => setShowCollectionArchived(!showCollectionArchived)}
              className={`flex items-center gap-2 px-4 py-2.5 transition-colors rounded-lg text-sm font-semibold shadow-sm border ${showCollectionArchived ? 'bg-primary/10 text-primary border-primary/20' : 'bg-card text-foreground-secondary hover:text-foreground border-border hover:border-border/80'}`}
            >
              <Archive className="w-4 h-4" />
              {showCollectionArchived ? 'View Active' : 'View Archived'}
            </button>
          )}
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

      {isMainDashboard && (missingSummaryCount > 0 || backfillMessage) && (
        <div className="bg-card border border-border px-5 py-4 rounded-xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-foreground-secondary">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <span>
              {backfillMessage ?? `${missingSummaryCount} bookmark${missingSummaryCount === 1 ? " doesn't" : "s don't"} have an AI summary yet.`}
            </span>
          </div>
          {!backfillMessage && (
            <button
              onClick={handleBackfill}
              disabled={isBackfilling}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors rounded-lg text-sm font-semibold"
            >
              {isBackfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate summaries
            </button>
          )}
        </div>
      )}

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
        <div className="space-y-8">
          <div className="space-y-4">
            {renderSection("Continue Reading", <BookOpen className="w-5 h-5" />, [
              ...activeBookmarks.filter(b => b.status === 'reading'),
              ...activeBookmarks.filter(b => !b.status || b.status === 'unread'),
            ].slice(0, 8))}
            {renderSection("Favorites", <Star className="w-5 h-5" />, activeBookmarks.filter(b => b.is_favorite))}
          </div>

          {activeBookmarks.filter(b => !b.is_favorite).length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <BookmarkIcon className="w-4 h-4" />
                </div>
                <h3 className="text-xl font-display font-bold text-foreground">All Items</h3>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activeBookmarks.filter(b => !b.is_favorite).map((bookmark) => (
                  <div key={bookmark.id} className="h-[340px]">
                    {renderCard(bookmark)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {currentCollectionId && !aiQuery && searchParams.get('view') !== 'archive' && !searchParams.get('tag') && (
            renderSection("Favorites", <Star className="w-5 h-5" />, filteredBookmarks.filter(b => b.is_favorite))
          )}
          {filteredBookmarks.filter(b => !(currentCollectionId && !aiQuery && searchParams.get('view') !== 'archive' && !searchParams.get('tag') && b.is_favorite)).length > 0 && (
            <div className="mt-8">
              {currentCollectionId && !aiQuery && searchParams.get('view') !== 'archive' && !searchParams.get('tag') && filteredBookmarks.filter(b => b.is_favorite).length > 0 && (
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <BookmarkIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-foreground">All Items</h3>
                </div>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredBookmarks
                  .filter(b => !(currentCollectionId && !aiQuery && searchParams.get('view') !== 'archive' && !searchParams.get('tag') && b.is_favorite))
                  .map((bookmark) => (
                  <div key={bookmark.id} className="h-[340px]">
                    {renderCard(bookmark)}
                  </div>
                ))}
              </div>
            </div>
          )}
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
              <div className="flex gap-2 mb-6 p-1 bg-secondary rounded-lg">
                <button type="button" onClick={() => setAddMode('url')} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${addMode === 'url' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>URL Link</button>
                <button type="button" onClick={() => setAddMode('pdf')} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${addMode === 'pdf' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>Upload PDF</button>
              </div>
              
              <div className="space-y-5">
                {addMode === 'url' ? (
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
                ) : (
                  <div>
                    <label htmlFor="pdf" className="block text-sm font-semibold text-foreground mb-1.5">
                      PDF File
                    </label>
                    <input
                      id="pdf"
                      type="file"
                      accept="application/pdf"
                      required
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer"
                    />
                  </div>
                )}
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
                  disabled={isExtracting || (addMode === 'url' ? !newUrl : !pdfFile)}
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
      
      <Suspense fallback={null}>
        {readerBookmark && (
          <ReaderModal
            key={readerBookmark.id}
            isOpen
            onClose={() => setReaderBookmark(null)}
            bookmark={readerBookmark}
          />
        )}
        
        {annotationsBookmark && (
          <AnnotationsModal 
            isOpen
            onClose={() => setAnnotationsBookmark(null)}
            bookmark={annotationsBookmark}
          />
        )}
      </Suspense>

      {/* Edit Modal */}
      {editingBookmark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg p-6 bg-card rounded-2xl shadow-xl border border-border"
          >
            <h3 className="text-xl font-display font-bold text-foreground mb-4">Edit Bookmark</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary min-h-[120px] custom-scrollbar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1">URL</label>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="e.g. productivity, reading, tech"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto custom-scrollbar">
                  {manualTagNames.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const currentTags = editTags.split(',').map(t => t.trim()).filter(Boolean);
                        if (!currentTags.includes(tag)) {
                          setEditTags(currentTags.length > 0 ? `${currentTags.join(', ')}, ${tag}` : tag);
                        }
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-secondary/60 hover:bg-primary/10 text-foreground-secondary hover:text-primary rounded-md transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setEditingBookmark(null)}
                  className="px-4 py-2 text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
