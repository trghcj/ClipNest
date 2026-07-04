import React, { useState } from 'react';
import { Navigate, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollections, createCollection, updateCollection, deleteCollection } from '../services/collections';
import { ThemeToggle } from '../components/ThemeToggle';
import { AISearchModal } from '../components/AISearchModal';
import { TagsModal } from '../components/TagsModal';
import { Plus, Folder, Home, Tag, Sparkles, Edit2, Trash2, LogOut, Image } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { auth, logoutUser } from '../services/firebase';

const ProtectedLayout = () => {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAISearchOpen, setIsAISearchOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const currentCollectionId = searchParams.get('collectionId');
  const queryClient = useQueryClient();

  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editCollectionName, setEditCollectionName] = useState('');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: getCollections,
    enabled: !!user,
  });

  const createCollectionMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setIsCreatingCollection(false);
      setNewCollectionName('');
    }
  });

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      createCollectionMutation.mutate({ name: newCollectionName.trim() });
    }
  };

  const updateCollectionMutation = useMutation({
    mutationFn: ({ id, name }: { id: string, name: string }) => updateCollection(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setEditingCollectionId(null);
    }
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: deleteCollection,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (currentCollectionId === deletedId) {
        navigate('/');
      }
    }
  });

  const handleUpdateProfilePic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.currentUser && avatarUrl.trim()) {
      try {
        await updateProfile(auth.currentUser, { photoURL: avatarUrl.trim() });
        setIsEditingAvatar(false);
        setAvatarUrl('');
        // Force a re-render by updating some local state if needed, but user object is reactive via onAuthStateChanged
        // The authStore will update if we trigger a re-auth, but for now we can just rely on the component re-render
        window.location.reload(); // Simple way to refresh the avatar globally
      } catch (error) {
        console.error("Failed to update profile", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar will go here */}
      <div className="w-64 border-r bg-card flex flex-col p-4">
        <h1 
          className="text-xl font-bold text-primary mb-8 flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img src="/Clipnest_Logo.png" alt="ClipNest Logo" className="w-10 h-10 object-contain scale-125 -ml-1" />
          ClipNest
        </h1>
        
        <nav className="flex-1 space-y-4 overflow-y-auto pr-2">
          <div className="space-y-1">
            <button 
              onClick={() => navigate('/')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${!currentCollectionId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Home className="w-4 h-4" />
              All Bookmarks
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collections</span>
              <button 
                onClick={() => setIsCreatingCollection(true)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="New Collection"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {isCreatingCollection && (
              <form onSubmit={handleCreateCollection} className="px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Collection name..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onBlur={() => setIsCreatingCollection(false)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </form>
            )}

            {collections.map((collection: any) => (
              <div key={collection.id} className={`group flex items-center justify-between px-3 py-1.5 rounded-md transition-colors ${currentCollectionId === collection.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                {editingCollectionId === collection.id ? (
                  <form 
                    className="flex-1 flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editCollectionName.trim() && editCollectionName !== collection.name) {
                        updateCollectionMutation.mutate({ id: collection.id, name: editCollectionName.trim() });
                      } else {
                        setEditingCollectionId(null);
                      }
                    }}
                  >
                    <Folder className="w-4 h-4 text-primary" />
                    <input 
                      autoFocus
                      type="text"
                      value={editCollectionName}
                      onChange={(e) => setEditCollectionName(e.target.value)}
                      onBlur={() => setEditingCollectionId(null)}
                      className="flex-1 min-w-0 bg-transparent border-b border-primary/50 text-sm font-medium text-foreground focus:outline-none"
                    />
                  </form>
                ) : (
                  <>
                    <button 
                      onClick={() => navigate(`/?collectionId=${collection.id}`)}
                      className={`flex-1 flex items-center gap-3 text-sm font-medium truncate ${currentCollectionId === collection.id ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      <Folder className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{collection.name}</span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingCollectionId(collection.id);
                          setEditCollectionName(collection.name);
                        }}
                        className="p-1 text-muted-foreground hover:text-blue-500 rounded-md transition-colors"
                        title="Rename Collection"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm("Delete this collection? Bookmarks will not be deleted.")) {
                            deleteCollectionMutation.mutate(collection.id);
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                        title="Delete Collection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1 pt-4">
            <button 
              onClick={() => setIsTagsModalOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
            >
              <Tag className="w-4 h-4" />
              Tags
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
          <div className="w-full max-w-xl relative flex items-center">
            <input 
              type="text" 
              placeholder="Search bookmarks, tags, notes..." 
              value={searchParams.get('q') || ''}
              onChange={(e) => {
                const newParams = new URLSearchParams(searchParams);
                if (e.target.value) {
                  newParams.set('q', e.target.value);
                } else {
                  newParams.delete('q');
                }
                navigate({ search: newParams.toString() });
              }}
              className="w-full bg-muted border-none rounded-md pl-4 pr-32 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={() => setIsAISearchOpen(true)}
              className="absolute right-1 top-1 bottom-1 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors rounded text-xs font-semibold flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ask AI
            </button>
          </div>
          <div className="flex items-center gap-4 relative">
            <ThemeToggle />
            
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="relative w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium uppercase overflow-hidden border-2 border-transparent hover:border-primary/50 transition-colors focus:outline-none"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user.email?.[0]
              )}
            </button>
            
            {/* Profile Dropdown */}
            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setIsProfileOpen(false); setIsEditingAvatar(false); }} />
                <div className="absolute top-12 right-0 w-64 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-border/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg overflow-hidden flex-shrink-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          user.email?.[0]
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-foreground truncate">{user.displayName || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-2">
                    {isEditingAvatar ? (
                      <form onSubmit={handleUpdateProfilePic} className="p-2 space-y-3">
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Image URL</label>
                          <input 
                            autoFocus
                            type="url" 
                            placeholder="https://..." 
                            required
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            className="w-full text-xs rounded-md border border-input bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setIsEditingAvatar(false)} className="flex-1 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-md transition-colors">Cancel</button>
                          <button type="submit" className="flex-1 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium">Save</button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        onClick={() => { setIsEditingAvatar(true); setAvatarUrl(user.photoURL || ''); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                      >
                        <Image className="w-4 h-4 text-muted-foreground" />
                        Change Profile Picture
                      </button>
                    )}
                  </div>
                  
                  <div className="p-2 border-t border-border/50 bg-muted/20">
                    <button 
                      onClick={() => logoutUser()}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <AISearchModal 
        isOpen={isAISearchOpen} 
        onClose={() => setIsAISearchOpen(false)} 
      />
      
      <TagsModal
        isOpen={isTagsModalOpen}
        onClose={() => setIsTagsModalOpen(false)}
      />
    </div>
  );
};

export default ProtectedLayout;
