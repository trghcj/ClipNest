import React, { useState } from 'react';
import { Navigate, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollections, createCollection, updateCollection, deleteCollection } from '../services/collections';
import { ThemeToggle } from '../components/ThemeToggle';
import { AISearchModal } from '../components/AISearchModal';
import { TagsModal } from '../components/TagsModal';
import { Plus, Home, Tag, Sparkles, Edit2, Trash2, LogOut, Image, Archive, BarChart2, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { auth, logoutUser } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';

const COLLECTION_COLORS = ['#607D4E', '#D4A373', '#5B8A52', '#C85C5C', '#A3B18A'];
const getCollectionColor = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLLECTION_COLORS[hash % COLLECTION_COLORS.length];
};

const ProtectedLayout = () => {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAISearchOpen, setIsAISearchOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const currentCollectionId = searchParams.get('collectionId');
  const queryClient = useQueryClient();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editCollectionName, setEditCollectionName] = useState('');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  const [isSearchFocused, setIsSearchFocused] = useState(false);

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
        window.location.reload();
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
    <div className="flex h-screen w-full bg-background font-sans">
      {/* Sidebar */}
      <motion.div 
        animate={{ width: isSidebarExpanded ? 256 : 80 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        className="bg-secondary flex flex-col p-4 shadow-[1px_0_10px_rgba(0,0,0,0.02)] z-10 border-none overflow-hidden shrink-0 relative"
      >
        <div className={`flex ${isSidebarExpanded ? 'flex-row items-center justify-between' : 'flex-col items-center gap-6'} mb-8`}>
          <div 
            className={`flex items-center gap-2 cursor-pointer text-xl font-display font-bold text-foreground overflow-hidden whitespace-nowrap`}
            onClick={() => navigate('/')}
          >
            <img src="/Clipnest_Logo.png" alt="ClipNest Logo" className="w-10 h-10 object-contain scale-125 -ml-1 flex-shrink-0" />
            <AnimatePresence>
              {isSidebarExpanded && (
                <motion.span 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  ClipNest
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} 
            className={`p-1.5 text-foreground-secondary hover:bg-[#DCE8D2] hover:text-primary rounded-lg transition-colors ${!isSidebarExpanded ? 'bg-[#DCE8D2]/50' : ''}`}
            title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isSidebarExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        </div>
        
        <nav className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar overflow-x-hidden">
          <div className="space-y-1">
            <motion.button 
              whileHover={{ x: isSidebarExpanded ? 4 : 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => navigate('/')}
              title="All Bookmarks"
              className={`w-full flex items-center ${isSidebarExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-colors text-sm font-medium ${!currentCollectionId ? 'bg-[#DCE8D2] text-foreground' : 'text-foreground-secondary hover:bg-[#DCE8D2]/50'}`}
            >
              <Home className={`w-5 h-5 flex-shrink-0 ${!currentCollectionId ? 'text-primary' : 'text-foreground-secondary'}`} />
              <AnimatePresence>
                {isSidebarExpanded && (
                  <motion.span 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    All Bookmarks
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          <div className="space-y-1">
            <div className={`flex items-center ${isSidebarExpanded ? 'justify-between px-3' : 'justify-center px-0'} py-2`}>
              {isSidebarExpanded && <span className="text-xs font-semibold text-foreground-secondary/70 uppercase tracking-wider">Collections</span>}
              <button 
                onClick={() => {
                  if (!isSidebarExpanded) setIsSidebarExpanded(true);
                  setIsCreatingCollection(true);
                }}
                className="text-foreground-secondary/70 hover:text-primary transition-colors hover:bg-black/5 p-1 rounded-md"
                title="New Collection"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {isCreatingCollection && isSidebarExpanded && (
              <form onSubmit={handleCreateCollection} className="px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Collection name..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onBlur={() => setIsCreatingCollection(false)}
                  className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 shadow-sm"
                />
              </form>
            )}

            {collections.map((collection: any) => (
              <motion.div 
                whileHover={{ x: isSidebarExpanded ? 4 : 0 }}
                transition={{ duration: 0.2 }}
                key={collection.id} 
                className={`group flex items-center ${isSidebarExpanded ? 'justify-between px-3' : 'justify-center px-0'} py-2 rounded-lg transition-colors ${currentCollectionId === collection.id ? 'bg-[#DCE8D2]' : 'hover:bg-[#DCE8D2]/50'}`}
              >
                {editingCollectionId === collection.id && isSidebarExpanded ? (
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
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: getCollectionColor(collection.name) }} />
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
                      title={collection.name}
                      className={`flex-1 flex items-center ${isSidebarExpanded ? 'gap-3 text-sm' : 'justify-center text-lg'} font-medium truncate ${currentCollectionId === collection.id ? 'text-foreground' : 'text-foreground-secondary'}`}
                    >
                      <div className={`${isSidebarExpanded ? 'w-2.5 h-2.5' : 'w-4 h-4'} rounded-full flex-shrink-0 shadow-sm`} style={{ backgroundColor: getCollectionColor(collection.name) }} />
                      {isSidebarExpanded && <span className="truncate">{collection.name}</span>}
                    </button>
                    {isSidebarExpanded && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingCollectionId(collection.id);
                            setEditCollectionName(collection.name);
                          }}
                          className="p-1 text-foreground-secondary hover:text-primary rounded-md transition-colors"
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
                          className="p-1 text-foreground-secondary hover:text-destructive rounded-md transition-colors"
                          title="Delete Collection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </div>

          <div className="space-y-1 pt-2 border-t border-border/50">
            <motion.button 
              whileHover={{ x: isSidebarExpanded ? 4 : 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsTagsModalOpen(true)}
              title="Tags"
              className={`w-full flex items-center ${isSidebarExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-2 text-sm font-medium text-foreground-secondary hover:bg-[#DCE8D2]/50 rounded-lg transition-colors`}
            >
              <Tag className="w-5 h-5 flex-shrink-0" />
              {isSidebarExpanded && <span className="whitespace-nowrap overflow-hidden">Tags</span>}
            </motion.button>
            <motion.button 
              whileHover={{ x: isSidebarExpanded ? 4 : 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                if (searchParams.get('view') === 'archive') {
                  newParams.delete('view');
                } else {
                  newParams.delete('collectionId');
                  newParams.delete('tag');
                  newParams.set('view', 'archive');
                }
                navigate({ pathname: '/', search: newParams.toString() });
              }}
              title={searchParams.get('view') === 'archive' ? 'Back to All Bookmarks' : 'Archived'}
              className={`w-full flex items-center ${isSidebarExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-2 text-sm font-medium rounded-lg transition-colors ${searchParams.get('view') === 'archive' ? 'bg-[#DCE8D2] text-foreground' : 'text-foreground-secondary hover:bg-[#DCE8D2]/50'}`}
            >
              <Archive className={`w-5 h-5 flex-shrink-0 ${searchParams.get('view') === 'archive' ? 'text-primary' : 'text-foreground-secondary'}`} />
              {isSidebarExpanded && <span className="whitespace-nowrap overflow-hidden">{searchParams.get('view') === 'archive' ? 'Back to All Bookmarks' : 'Archived'}</span>}
            </motion.button>
            <motion.button 
              whileHover={{ x: isSidebarExpanded ? 4 : 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => navigate('/analytics')}
              title="Analytics"
              className={`w-full flex items-center ${isSidebarExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-2 text-sm font-medium rounded-lg transition-colors ${window.location.pathname === '/analytics' ? 'bg-[#DCE8D2] text-foreground' : 'text-foreground-secondary hover:bg-[#DCE8D2]/50'}`}
            >
              <BarChart2 className={`w-5 h-5 flex-shrink-0 ${window.location.pathname === '/analytics' ? 'text-primary' : 'text-foreground-secondary'}`} />
              {isSidebarExpanded && <span className="whitespace-nowrap overflow-hidden">Analytics</span>}
            </motion.button>
          </div>
        </nav>
      </motion.div>

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Topbar */}
        <header className="h-20 bg-background flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="w-full max-w-2xl relative flex items-center">
            {/* Spotlight Search Redesign */}
            <div className={`relative w-full flex items-center transition-all duration-300 ${isSearchFocused ? 'shadow-[0_8px_30px_rgb(0,0,0,0.06)]' : ''}`}>
              <Search className="w-5 h-5 text-foreground-secondary absolute left-4" />
              <input 
                type="text" 
                placeholder="Search bookmarks, tags, notes..." 
                value={searchParams.get('q') || ''}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onChange={(e) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    newParams.set('q', e.target.value);
                  } else {
                    newParams.delete('q');
                  }
                  navigate({ search: newParams.toString() });
                }}
                className={`w-full h-12 bg-card rounded-2xl pl-12 pr-32 py-2 text-base font-medium text-foreground transition-all duration-300 outline-none border ${isSearchFocused ? 'border-primary/40 bg-card' : 'border-border/60 hover:border-primary/20 hover:bg-card/80 shadow-sm'}`}
              />
              <div className="absolute right-3 flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-muted border border-border text-foreground-secondary text-[10px] font-bold tracking-widest">
                  ⌘ K
                </div>
                <button
                  onClick={() => setIsAISearchOpen(true)}
                  className="px-3 py-1.5 bg-primary text-white hover:bg-primary-hover transition-colors rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask AI
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6 relative ml-4">
            <ThemeToggle />
            
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium uppercase overflow-hidden border-2 border-transparent hover:border-primary/30 transition-colors focus:outline-none shadow-sm"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user.email?.[0]
              )}
            </button>
            
            {/* Profile Dropdown */}
            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setIsProfileOpen(false); setIsEditingAvatar(false); }} />
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-14 right-0 w-64 bg-card border border-border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-50 overflow-hidden"
                  >
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
                          <p className="text-xs text-foreground-secondary truncate">{user.email}</p>
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
                            <button type="button" onClick={() => setIsEditingAvatar(false)} className="flex-1 py-1.5 text-xs text-foreground-secondary hover:bg-muted rounded-md transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary-hover transition-colors font-medium">Save</button>
                          </div>
                        </form>
                      ) : (
                        <button 
                          onClick={() => { setIsEditingAvatar(true); setAvatarUrl(user.photoURL || ''); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
                        >
                          <Image className="w-4 h-4 text-foreground-secondary" />
                          Change Profile Picture
                        </button>
                      )}
                    </div>
                    
                    <div className="p-2 border-t border-border/50 bg-secondary/30">
                      <button 
                        onClick={() => logoutUser()}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pt-6 px-12 pb-12">
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
