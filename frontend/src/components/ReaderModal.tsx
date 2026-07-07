import React from 'react';
import { X, BookOpen, Save, Loader2 } from 'lucide-react';
import type { Bookmark } from '../services/bookmarks';
import { getNote, upsertNote } from '../services/notes';

interface ReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({ isOpen, onClose, bookmark }) => {
  const [activeTab, setActiveTab] = React.useState<'content' | 'notes'>('content');
  const [noteContent, setNoteContent] = React.useState('');
  const [isLoadingNote, setIsLoadingNote] = React.useState(false);
  const [isSavingNote, setIsSavingNote] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && bookmark && activeTab === 'notes') {
      loadNote();
    }
  }, [isOpen, bookmark, activeTab]);

  const loadNote = async () => {
    if (!bookmark) return;
    setIsLoadingNote(true);
    try {
      const note = await getNote(bookmark.id);
      if (note) setNoteContent(note.content);
      else setNoteContent('');
    } catch (error) {
      console.error('Failed to load note', error);
    } finally {
      setIsLoadingNote(false);
    }
  };

  const handleSaveNote = async () => {
    if (!bookmark) return;
    setIsSavingNote(true);
    try {
      await upsertNote(bookmark.id, noteContent);
    } catch (error) {
      console.error('Failed to save note', error);
    } finally {
      setIsSavingNote(false);
    }
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
                <>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write your notes here... (Markdown supported in future updates)"
                    className="flex-1 w-full p-4 bg-muted/20 border border-border rounded-xl resize-none focus:outline-none focus:border-primary/50 text-foreground custom-scrollbar"
                  />
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleSaveNote}
                      disabled={isSavingNote}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Note
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
