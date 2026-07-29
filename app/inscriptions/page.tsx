'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InscriptionsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inscriptions/acheteur');
  }, [router]);

  return null;
}
