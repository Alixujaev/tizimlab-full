import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { setAuthFailureHandler } from '@/api/client';
import { useBootstrapAuth } from '@/hooks/useBootstrapAuth';
import { createQueryClient } from '@/lib/queryClient';
import { routes } from '@/router';
import { Toaster } from '@/ui';

const router = createBrowserRouter(routes);

export function App() {
  const [queryClient] = useState(createQueryClient);
  useBootstrapAuth();
  useEffect(() => {
    // Refresh muvaffaqiyatsiz bo'lsa — sahifani qayta yuklamasdan /login ga
    setAuthFailureHandler(() => {
      queryClient.clear();
      void router.navigate('/login', { replace: true });
    });
  }, [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
