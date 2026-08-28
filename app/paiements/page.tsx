'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import StatCard from '../components/StatCard';
import { formatEuros } from '../lib/format';
import Link from 'next/link';

interface PaymentItem {
  id: string;
  user: {
    id: string;
    name: string;
    companyName: string;
    email: string;
    role: string;
  } | null;
  saleId: string | null;
  vehicle: string | null;
  type: 'paiement_commission' | 'reactivation_compte';
  typeLabel: string;
  amount: number;
  currency: string;
  provider: string;
  stripeId: string;
  status: 'paye' | 'en_attente' | 'echoue';
  paidAt: string;
}

interface PaymentsSummary {
  totalAmount: number;
  commissionPaymentsCount: number;
  reactivationPaymentsCount: number;
  totalCount: number;
}

export default function AdminPaiementsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary>({
    totalAmount: 0,
    commissionPaymentsCount: 0,
    reactivationPaymentsCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError('');
      const queryParams = new URLSearchParams();
      if (typeFilter !== 'all') queryParams.set('type', typeFilter);
      if (search.trim()) queryParams.set('search', search.trim());

      const res = await apiRequest(`/admin/payments?${queryParams.toString()}`);
      setPayments(res.payments || []);
      setSummary(res.summary || {
        totalAmount: 0,
        commissionPaymentsCount: 0,
        reactivationPaymentsCount: 0,
        totalCount: 0,
      });
    } catch (err: any) {
      console.error('Erreur chargement des paiements:', err);
      setError(err.message || 'Erreur lors de la récupération des paiements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 sm:p-8 w-full font-sans bg-[#faf9f5] min-h-screen">
      {/* En-tête */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#7a756a] mb-1">
            Console d'Administration
          </div>
          <h1 className="text-[28px] sm:text-[34px] font-bold font-heading uppercase text-[#13243c]">
            Paiements Stripe & Transactions
          </h1>
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Encaissé Stripe"
          value={formatEuros(summary.totalAmount)}
          bg="#2563eb"
          labelColor="#bfdbfe"
          valueColor="#ffffff"
        />
        <StatCard
          label="Paiements de Commission"
          value={`${summary.commissionPaymentsCount} transaction(s)`}
          bg="#16a34a"
          labelColor="#bbf7d0"
          valueColor="#ffffff"
        />
        <StatCard
          label="Réactivations de Compte"
          value={`${summary.reactivationPaymentsCount} transaction(s)`}
          bg="#ea580c"
          labelColor="#fed7aa"
          valueColor="#ffffff"
        />
      </div>

      {/* Barre de filtres et recherche */}
      <div className="bg-white border border-[#efece3] rounded-[12px] p-4 mb-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Rechercher par acheteur, société, e-mail, véhicule ou ID Stripe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-[8px] border border-[#d9d5c9] text-xs font-medium text-[#13243c] placeholder-[#9fb0c9] focus:outline-none focus:border-[#2563eb]"
            />
            <span className="absolute left-3.5 top-3 text-[#9fb0c9] text-sm">🔍</span>
          </div>
          <button
            type="submit"
            className="h-11 px-5 rounded-[8px] bg-[#13243c] hover:bg-[#1c3050] text-white text-xs font-bold uppercase tracking-wider transition shrink-0"
          >
            Rechercher
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <label className="text-xs font-bold text-[#5a5e66] uppercase whitespace-nowrap">Motif :</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-11 px-3 rounded-[8px] border border-[#d9d5c9] bg-white text-xs font-bold text-[#13243c] focus:outline-none focus:border-[#2563eb] cursor-pointer"
          >
            <option value="all">Tous les motifs ({summary.totalCount})</option>
            <option value="paiement_commission">Paiement de commission ({summary.commissionPaymentsCount})</option>
            <option value="reactivation_compte">Réactivation de compte ({summary.reactivationPaymentsCount})</option>
          </select>
        </div>
      </div>

      {/* Message d'erreur s'il y a lieu */}
      {error && (
        <div className="mb-6 p-4 rounded-[10px] bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Tableau des paiements */}
      <div className="bg-white border border-[#efece3] rounded-[14px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-[#efece3] text-[11px] font-extrabold uppercase tracking-wider text-[#5a5e66]">
                <th className="py-4 px-5">Date & Heure</th>
                <th className="py-4 px-5">Acheteur / Société</th>
                <th className="py-4 px-5">Motif du Paiement</th>
                <th className="py-4 px-5 text-right">Montant</th>
                <th className="py-4 px-5">ID Transaction Stripe</th>
                <th className="py-4 px-5">Détails / Véhicule</th>
                <th className="py-4 px-5 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efece3] text-xs">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#7a756a] font-medium">
                    Chargement des paiements Stripe en cours...
                  </td>
                </tr>
              )}

              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#7a756a] font-medium">
                    Aucun paiement enregistré pour le moment.
                  </td>
                </tr>
              )}

              {!loading && payments.map((payment) => {
                const isCommission = payment.type === 'paiement_commission';
                return (
                  <tr key={payment.id} className="hover:bg-[#faf9f5] transition-colors">
                    {/* Date */}
                    <td className="py-4 px-5 font-mono text-[#5a5e66] whitespace-nowrap">
                      {formatDate(payment.paidAt)}
                    </td>

                    {/* Acheteur */}
                    <td className="py-4 px-5">
                      {payment.user ? (
                        <div>
                          <div className="font-bold text-[#13243c]">{payment.user.companyName || payment.user.name}</div>
                          <div className="text-[11px] text-[#7a756a]">{payment.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-[#9fb0c9] italic">Utilisateur inconnu</span>
                      )}
                    </td>

                    {/* Motif */}
                    <td className="py-4 px-5">
                      {isCommission ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>🏷️</span> Paiement de commission
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          <span>🔓</span> Réactivation de compte
                        </span>
                      )}
                    </td>

                    {/* Montant */}
                    <td className="py-4 px-5 text-right font-mono font-bold text-[14px] text-[#13243c]">
                      {formatEuros(payment.amount)}
                    </td>

                    {/* Stripe ID */}
                    <td className="py-4 px-5 font-mono text-[11px] text-[#5a5e66]">
                      <span className="bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-[11px]">
                        {payment.stripeId}
                      </span>
                    </td>

                    {/* Véhicule / Détails */}
                    <td className="py-4 px-5 font-medium text-[#13243c]">
                      {payment.vehicle ? (
                        <span className="font-bold text-[#13243c]">{payment.vehicle}</span>
                      ) : isCommission ? (
                        <span className="text-gray-400 italic">Vente supprimée</span>
                      ) : (
                        <span className="text-amber-700 font-medium">Déblocage après pénalité</span>
                      )}
                    </td>

                    {/* Statut */}
                    <td className="py-4 px-5 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Payé
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
