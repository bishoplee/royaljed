'use client';

import React, { Suspense } from 'react';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <SessionProvider>{children}</SessionProvider>
    </Suspense>
  );
}
