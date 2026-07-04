import React, { useState } from 'react';
import { Navigate, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollections, createCollection } from '../services/collections';
import { Plus, Folder, Home, Tag } from 'lucide-react';

const ProtectedLayout = () => {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCollectionId = searchParams.get('collectionId');
  const queryClient = useQueryClient();

  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

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
              <button 
                key={collection.id}
                onClick={() => navigate(`/?collectionId=${collection.id}`)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${currentCollectionId === collection.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Folder className="w-4 h-4" />
                <span className="truncate">{collection.name}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1 pt-4">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-muted rounded-md transition-colors text-sm font-medium opacity-50 cursor-not-allowed">
              <Tag className="w-4 h-4" />
              Tags (Coming Soon)
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
          <div className="w-full max-w-xl">
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
              className="w-full bg-muted border-none rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium uppercase">
              {user.email?.[0]}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProtectedLayout;
