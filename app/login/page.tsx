'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import { useUser } from '../components/LayoutWrapper';
import PasswordInput from '../components/PasswordInput';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

export default function AdminLoginPage() {
  const router = useRouter();
  const { refreshProfile } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.user.role !== 'admin') {
        // Disconnect immediately if not admin
        await apiRequest('/auth/logout', { method: 'POST' });
        setError('Accès refusé. Cette interface est strictement réservée à l\'administrateur.');
        return;
      }

      setMessage('Connexion d\'administration réussie. Redirection...');
      await refreshProfile();
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8 text-black">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-2xl border border-gray-700">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 uppercase font-heading">
            🛡️ DealsAutoPro - Administration
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Console de validation des inscriptions et support technique
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && <Alert variant="error" size="md">{error}</Alert>}
          {message && <Alert variant="success" size="md">{message}</Alert>}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">Email Administrateur</label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
                placeholder="admin@gmail.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Mot de passe</label>
              <PasswordInput
                id="password"
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
                placeholder="12312312"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent text-sm font-bold rounded-md text-white bg-[#13243C] hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading && <Spinner />}
              {loading ? 'Connexion...' : 'Se connecter au panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
