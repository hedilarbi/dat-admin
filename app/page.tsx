'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './components/LayoutWrapper';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/inscriptions' : '/login');
  }, [user, loading, router]);

  return null;
}
