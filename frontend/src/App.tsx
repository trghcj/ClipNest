import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { queryClient } from './services/queryClient';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';

// Route-level code splitting: the login page no longer downloads the editor,
// charts and dashboard code.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));
const ProtectedLayout = lazy(() => import('./pages/ProtectedLayout'));

const PageSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function App() {
  const { setUser, setLoading } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (!user) queryClient.clear(); // don't show the previous user's data after logout
    });
    return () => unsubscribe();
  }, [setUser, setLoading]);

  // Keep the browser extension's token fresh. Firebase ID tokens expire after an hour;
  // onIdTokenChanged also fires on every refresh (onAuthStateChanged does not).
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      try {
        const token = user ? await user.getIdToken() : null;
        window.postMessage({ type: 'CLIPNEST_AUTH_TOKEN', token }, window.location.origin);
      } catch (e) {
        console.error('Error getting auth token for extension', e);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<AnalyticsDashboard />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
