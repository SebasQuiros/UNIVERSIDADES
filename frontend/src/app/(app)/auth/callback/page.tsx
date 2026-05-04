'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// OAuth callback is no longer used — Google/Microsoft login has been removed.
// This page just redirects to login.
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null;
}
