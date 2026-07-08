import React from 'react';
import { X, BookOpen, Save, Loader2 } from 'lucide-react';
import type { Bookmark } from '../services/bookmarks';
import { getNote, upsertNote } from '../services/notes';
import { RichTextEditor } from './RichTextEditor';
import { useDebounce } from '../hooks/useDebounce';

interface ReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({ isOpen, onClose, bookmark }) => {
  const [activeTab, setActiveTab] = React.useState<'content' | 'notes'>('content');
  const [noteContent, setNoteContent] = React.useState('');
  const [isLoadingNote, setIsLoadingNote] = React.useState(false);

  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [initialNoteLoaded, setInitialNoteLoaded] = React.useState(false);

  const debouncedNoteContent = useDebounce(noteContent, 1000);

  React.useEffect(() => {
    if (isOpen && bookmark && activeTab === 'notes') {
      loadNote();
    } else {
      setInitialNoteLoaded(false);
      setSaveStatus('idle');
    }
  }, [isOpen, bookmark, activeTab]);

  React.useEffect(() => {
    if (initialNoteLoaded && bookmark) {
      handleAutoSave(debouncedNoteContent);
    }
  }, [debouncedNoteContent]);

  const loadNote = async () => {
    if (!bookmark) return;
    setIsLoadingNote(true);
    setInitialNoteLoaded(false);
    try {
      const note = await getNote(bookmark.id);
      if (note) setNoteContent(note.content);
      else setNoteContent('');
      
      // Allow a small delay before enabling auto-save to prevent saving on initial load
      setTimeout(() => setInitialNoteLoaded(true), 500);
    } catch (error) {
      console.error('Failed to load note', error);
    } finally {
      setIsLoadingNote(false);
    }
  };

  const handleAutoSave = async (content: string) => {
    if (!bookmark) return;
    setSaveStatus('saving');
    try {
      await upsertNote(bookmark.id, content);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save note', error);
      setSaveStatus('idle');
    }
  };

  const handleNoteChange = (content: string) => {
    setNoteContent(content);
    setSaveStatus('saving'); // Show saving immediately when typing starts
  };

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

        <div className="flex border-b border-border bg-card">
          <button
            onClick={() => setActiveTab('content')}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'content' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Article Content
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'notes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            My Notes
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'content' ? (
            bookmark.content ? (
              <div 
                className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-xl"
                dangerouslySetInnerHTML={{ __html: bookmark.content }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
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
            )
          ) : (
            <div className="flex flex-col h-full min-h-[300px]">
              {isLoadingNote ? (
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
          )}
        </div>

      </div>
    </div>
  );
};
