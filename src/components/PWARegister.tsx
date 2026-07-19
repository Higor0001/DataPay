'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Verifica e realiza o registro do service worker local
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('DataPay PWA Service Worker registrado com escopo:', reg.scope);
        })
        .catch((err) => {
          console.error('Falha ao registrar PWA Service Worker:', err);
        });
    }
  }, []);

  return null;
}
