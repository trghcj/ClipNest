import { QueryClient } from '@tanstack/react-query';

// Shared so non-React code (e.g. the editor's @mention suggestions) can reuse cached data.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data only changes through this app, and mutations update/invalidate the cache,
      // so don't refetch everything every time the tab regains focus.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
