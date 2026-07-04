
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedLayout = () => {
  const { user, loading } = useAuthStore();

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
        <h1 className="text-xl font-bold text-primary mb-8 flex items-center gap-2">
          <img src="/Clipnest_Logo_transparent.png" alt="ClipNest Logo" className="w-8 h-8 object-contain" />
          ClipNest
        </h1>
        <nav className="flex-1 space-y-2">
          <a href="#" className="flex items-center gap-3 px-3 py-2 bg-primary/10 text-primary rounded-md transition-colors">
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-muted rounded-md transition-colors">
            Collections
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-muted rounded-md transition-colors">
            Tags
          </a>
        </nav>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Topbar will go here */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
          <div className="w-full max-w-xl">
            <input 
              type="text" 
              placeholder="Search bookmarks, tags, notes..." 
              className="w-full bg-muted border-none rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
              {user.email?.[0].toUpperCase()}
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
