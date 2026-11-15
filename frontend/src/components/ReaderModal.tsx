import React from 'react';
import DOMPurify from 'dompurify';
import { X, BookOpen, Save, Loader2, Maximize2, Minimize2, SplitSquareHorizontal, FileText, Edit3, CheckCircle2, Circle } from 'lucide-react';
import { clsx } from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBookmark, updateBookmark } from '../services/bookmarks';
import type { Bookmark, BookmarkStatus } from '../services/bookmarks';
import { getNote, upsertNote } from '../services/notes';
import { RichTextEditor } from './RichTextEditor';
import { useDebounce } from '../hooks/useDebounce';

// Saved page content is third-party HTML: sanitize it before rendering. The only iframes
// allowed are YouTube embeds (used for saved videos); links always open in a new tab.
const YOUTUBE_EMBED = /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//;
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'iframe' && !YOUTUBE_EMBED.test((node as Element).getAttribute('src') || '')) {
    node.parentNode?.removeChild(node);
  }
});
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});
const sanitize = (html: string) =>
  DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'target'],
  });

interface ReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({ isOpen, onClose, bookmark }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<'content' | 'notes' | 'split'>('content');
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [noteContent, setNoteContent] = React.useState('');
  const [noteState, setNoteState] = React.useState<'idle' | 'loading' | 'ready'>('idle');
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [status, setStatus] = React.useState<BookmarkStatus>(bookmark?.status || 'unread');

  const bookmarkId = bookmark?.id;
  const debouncedNoteContent = useDebounce(noteContent, 1000);
  // Latest unsaved note text; flushed on close so the last second of typing isn't lost.
  const pendingNote = React.useRef<string | null>(null);

  // The list doesn't carry page content; load the full bookmark when the reader opens.
  const { data: detail, isLoading: isLoadingContent } = useQuery({
    queryKey: ['bookmark', bookmarkId],
    queryFn: () => getBookmark(bookmarkId!),
    enabled: isOpen && !!bookmarkId,
  });
  const safeContent = React.useMemo(() => (detail?.content ? sanitize(detail.content) : ''), [detail?.content]);

  const setBookmarkStatus = React.useCallback(async (next: BookmarkStatus) => {
    if (!bookmarkId) return;
    setStatus(next);
    try {
      const saved = await updateBookmark(bookmarkId, { status: next });
      queryClient.setQueriesData<Bookmark[]>({ queryKey: ['bookmarks'] }, (old) =>
        Array.isArray(old) ? old.map((b) => (b.id === saved.id ? saved : b)) : old);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    } catch (error) {
      console.error('Failed to update reading status', error);
    }
  }, [bookmarkId, queryClient]);

  // Opening an unread bookmark moves it to "reading" (drives Continue Reading / Unread).
  React.useEffect(() => {
    if (isOpen && bookmark && (!bookmark.status || bookmark.status === 'unread')) {
      setBookmarkStatus('reading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bookmarkId]);

  // Load the note once per bookmark, the first time the notes pane is shown.
  React.useEffect(() => {
    if (!isOpen || !bookmarkId || activeTab === 'content' || noteState !== 'idle') return;
    let cancelled = false;
    setNoteState('loading');
    getNote(bookmarkId)
      .then((note) => { if (!cancelled) setNoteContent(note?.content ?? ''); })
      .catch((error) => console.error('Failed to load note', error))
      .finally(() => { if (!cancelled) setNoteState('ready'); });
    return () => { cancelled = true; };
  }, [isOpen, bookmarkId, activeTab, noteState]);

  const saveNote = React.useCallback(async (content: string) => {
    if (!bookmarkId) return;
    setSaveStatus('saving');
    try {
      await upsertNote(bookmarkId, content);
      if (pendingNote.current === content) pendingNote.current = null;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save note', error);
      setSaveStatus('idle');
    }
  }, [bookmarkId]);

  React.useEffect(() => {
    if (pendingNote.current !== null && pendingNote.current === debouncedNoteContent) {
      saveNote(debouncedNoteContent);
    }
  }, [debouncedNoteContent, saveNote]);

  // Flush an unsaved note when the reader closes/unmounts.
  React.useEffect(() => () => {
    if (pendingNote.current !== null && bookmarkId) {
      upsertNote(bookmarkId, pendingNote.current).catch((e) => console.error('Failed to save note', e));
      pendingNote.current = null;
    }
  }, [bookmarkId]);

  const handleNoteChange = (content: string) => {
    if (noteState !== 'ready') return; // ignore the editor's initial onChange while loading
    pendingNote.current = content;
    setNoteContent(content);
    setSaveStatus('saving'); // Show saving immediately when typing starts
  };

  const renderArticle = () => {
    if (isLoadingContent) {
      return (
        <div className="flex items-center justify-center h-full py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
        </div>
      );
    }
    return safeContent ? (
      <div
        className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-xl"
        dangerouslySetInnerHTML={{ __html: safeContent }}
      />
    ) : (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
        <BookOpen className="w-12 h-12 mb-4 opacity-20" />
        <p>No article content could be extracted for this page.</p>
        <a
          href={bookmark?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-primary hover:underline text-sm font-medium"
        >
          Open original link
        </a>
      </div>
    );
  };

  const renderNotes = () => {
    return (
      <div className="flex flex-col h-full min-h-[300px]">
        {noteState !== 'ready' ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-4">
            <RichTextEditor
              content={noteContent}
              onChange={handleNoteChange}
              placeholder="Write your notes here... (Auto-saves as you type)"
            />
            <div className="flex justify-end items-center h-6">
              {saveStatus === 'saving' && (
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-xs font-medium text-success flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Saved to cloud
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen || !bookmark) return null;

  const isCompleted = status === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-6">
      <div
        className={clsx(
          "bg-card flex flex-col border border-border overflow-hidden transition-all duration-300 shadow-xl",
          isExpanded ? "w-full h-full rounded-none" : "w-full max-w-5xl max-h-[90vh] rounded-2xl"
        )}
      >

        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
            <h2 className="text-lg font-semibold text-foreground truncate max-w-xl">
              {bookmark.title || 'Reader Mode'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setBookmarkStatus(isCompleted ? 'reading' : 'completed')}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-full text-xs font-semibold transition-colors",
                isCompleted ? "bg-success/10 text-success hover:bg-success/20" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              title={isCompleted ? "Mark as not finished" : "Mark as read"}
            >
              {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {isCompleted ? 'Read' : 'Mark as read'}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-muted rounded-full transition-colors hidden md:block"
              title={isExpanded ? "Exit Focus Mode" : "Enter Focus Mode"}
            >
              {isExpanded ? <Minimize2 className="w-5 h-5 text-muted-foreground" /> : <Maximize2 className="w-5 h-5 text-muted-foreground" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-border bg-card">
          <button
            onClick={() => setActiveTab('content')}
            className={clsx(
              "flex-1 py-3 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2",
              activeTab === 'content' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="w-4 h-4" />
            Article Content
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={clsx(
              "flex-1 py-3 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2",
              activeTab === 'notes' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Edit3 className="w-4 h-4" />
            My Notes
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={clsx(
              "flex-1 py-3 text-sm font-medium transition-colors border-b-2 hidden md:flex items-center justify-center gap-2",
              activeTab === 'split' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            title="Split View"
          >
            <SplitSquareHorizontal className="w-4 h-4" />
            Split View
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'split' ? (
            <div className="flex flex-col md:flex-row h-full gap-8">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar h-full">
                {renderArticle()}
              </div>
              <div className="w-px bg-border hidden md:block" />
              <div className="flex-1 overflow-y-auto pl-2 custom-scrollbar h-full">
                {renderNotes()}
              </div>
            </div>
          ) : activeTab === 'content' ? (
            renderArticle()
          ) : (
            renderNotes()
          )}
        </div>

      </div>
    </div>
  );
};
