'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './components/LayoutWrapper';
import { apiRequest } from './api';
import Link from 'next/link';

interface DashboardStats {
  pendingActions: {
    users: number;
    dossiers: number;
    tickets: number;
    latePayments?: Array<{
      _id: string;
      vehicle: {
        _id: string;
        brand: string;
        model: string;
        year: number;
      };
      winner: {
        _id: string;
        firstName: string;
        lastName: string;
        companyName: string;
      };
      winningOfferAmount: number;
    }>;
  };
  kpis: {
    activeSessions: number;
    validatedUsers: number;
    totalTransactionVolume: number;
    completedSales: number;
  };
  recentActivities: {
    users: Array<{
      _id: string;
      firstName: string;
      lastName: string;
      companyName: string;
      role: string;
      createdAt: string;
      status: string;
    }>;
  };
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [maxedOutVehicles, setMaxedOutVehicles] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchStats = async () => {
      try {
        const [resStats, resMaxedOut] = await Promise.all([
          apiRequest('/admin/dashboard-stats').catch(() => null),
          apiRequest('/admin/dossiers/tentatives-max?limit=5').catch(() => null)
        ]);
        if (resStats && resStats.data) setStats(resStats.data);
        if (resMaxedOut && resMaxedOut.data) setMaxedOutVehicles(resMaxedOut.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user, loading, router]);

  if (loading || !user || loadingStats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-white h-screen">
        <div className="w-12 h-12 border-4 border-[#d9704f] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats) return null;

  const formatEuros = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex-1 w-full bg-[#f8f9fa] font-sans text-black overflow-y-auto">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-[28px] font-bold font-heading uppercase text-[#13243c] mb-2">
            Tableau de Bord
          </h1>
        </div>

        {/* Section 1: Actions Requises */}
        <section>
          <h2 className="text-[16px] font-bold uppercase tracking-wider text-[#13243c] mb-4 border-b border-gray-200 pb-2">
            1. Actions Requises
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Utilisateurs en attente */}
            <Link href="/inscriptions" className="bg-white rounded-[12px] border border-red-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Inscriptions en attente</h3>
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.users}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-red-500 transition font-medium">
                → Gérer les utilisateurs
              </p>
            </Link>

            {/* Dossiers en attente */}
            <Link href="/dossiers" className="bg-white rounded-[12px] border border-orange-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#d9704f]"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Dossiers à valider</h3>
                <span className="w-8 h-8 rounded-full bg-orange-100 text-[#d9704f] flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.dossiers}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-[#d9704f] transition font-medium">
                → Inspecter les dossiers
              </p>
            </Link>

            {/* Support en attente */}
            <Link href="/support" className="bg-white rounded-[12px] border border-blue-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#13243c]"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Tickets non lus</h3>
                <span className="w-8 h-8 rounded-full bg-blue-100 text-[#13243c] flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.tickets}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-[#13243c] transition font-medium">
                → Répondre au support
              </p>
            </Link>
          </div>

          {/* Alertes Paiements & Ventes Critiques */}
          {stats.pendingActions.latePayments && stats.pendingActions.latePayments.length > 0 && (
            <div className="mt-8 bg-[#fff7f1] border border-[#B04A2C] rounded-[12px] overflow-hidden shadow-sm">
              <div className="bg-[#B04A2C] px-6 py-3 flex items-center justify-between">
                <h3 className="text-white font-bold uppercase tracking-wide text-[14px]">
                  🚨 Ventes Critiques (Étape 1 ou 2 · &gt; 80% du délai)
                </h3>
                <span className="bg-white text-[#B04A2C] text-[12px] font-bold px-2.5 py-1 rounded-full">
                  {stats.pendingActions.latePayments.length} alerte(s)
                </span>
              </div>
              <div className="divide-y divide-[#B04A2C]/20">
                {stats.pendingActions.latePayments.map(sale => (
                  <div key={sale._id} className="p-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fff0e6] transition">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#13243c]">
                          {[sale.vehicle?.brand, sale.vehicle?.model].filter(Boolean).join(' ')} {sale.vehicle?.year ? `(${sale.vehicle.year})` : ''}
                        </span>
                        {sale.currentStep && (
                          <span className="bg-[#B04A2C] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                            Étape {sale.currentStep}
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-gray-600 mt-1">
                        Acheteur : <span className="font-medium">{sale.winner?.firstName} {sale.winner?.lastName} {sale.winner?.companyName ? `(${sale.winner.companyName})` : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="text-left sm:text-right">
                        <div className="text-[12px] text-gray-500 uppercase tracking-widest">Montant</div>
                        <div className="font-bold text-[#B04A2C]">{formatEuros(sale.winningOfferAmount || 0)}</div>
                      </div>
                      <Link href={`/ventes/${sale._id}`} className="bg-[#B04A2C] hover:bg-[#8c3b23] text-white text-[13px] font-bold px-4 py-2 rounded-[6px] transition shrink-0">
                        Ouvrir la vente →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        
          {/* Véhicules Obstinés */}
          {maxedOutVehicles && maxedOutVehicles.length > 0 && (
            <div className="mt-6 bg-[#fffbf0] border border-[#d4a017] rounded-[12px] overflow-hidden shadow-sm">
              <div className="bg-[#d4a017] px-6 py-3 flex items-center justify-between">
                <h3 className="text-white font-bold uppercase tracking-wide text-[14px]">
                  ⚠️ Véhicules Obstinés (3 tentatives ou plus)
                </h3>
                <span className="bg-white text-[#d4a017] text-[12px] font-bold px-2.5 py-1 rounded-full">
                  {maxedOutVehicles.length} véhicule(s)
                </span>
              </div>
              <div className="divide-y divide-[#d4a017]/20">
                {maxedOutVehicles.map(vehicle => (
                  <div key={vehicle._id} className="p-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fff6d6] transition">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#13243c]">
                          {[vehicle.brand, vehicle.model].filter(Boolean).join(' ')} {vehicle.year ? `(${vehicle.year})` : ''}
                        </span>
                        <span className="bg-[#d4a017] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                          {vehicle.listingCount} TENTATIVES
                        </span>
                      </div>
                      <div className="text-[13px] text-gray-600 mt-1">
                        Immatriculation : <span className="font-medium">{vehicle.registrationNumber || vehicle.vin || '—'}</span>
                        <br/>
                        Vendeur : <span className="font-medium">{vehicle.seller?.companyName || '—'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <Link href={`/dossiers/${vehicle._id}`} className="bg-[#d4a017] hover:bg-[#b58814] text-white text-[13px] font-bold px-4 py-2 rounded-[6px] transition shrink-0">
                        Ouvrir le dossier →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 2: KPIs */}
        <section>
          <h2 className="text-[16px] font-bold uppercase tracking-wider text-[#13243c] mb-4 border-b border-gray-200 pb-2">
            2. Indicateurs Clés (KPIs)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPI 1 */}
            <div className="bg-white rounded-[12px] border border-gray-200 p-6 shadow-sm">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Volume d'affaires
              </div>
              <div className="text-[28px] font-black text-[#13243c] font-heading">
                {formatEuros(stats.kpis.totalTransactionVolume)}
              </div>
              <div className="text-[12px] text-gray-400 mt-2">
                Total des ventes clôturées
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white rounded-[12px] border border-gray-200 p-6 shadow-sm">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Sessions actives
              </div>
              <div className="text-[28px] font-black text-[#d9704f] font-heading">
                {stats.kpis.activeSessions}
              </div>
              <div className="text-[12px] text-gray-400 mt-2">
                Enchères en cours
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white rounded-[12px] border border-gray-200 p-6 shadow-sm">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Utilisateurs validés
              </div>
              <div className="text-[28px] font-black text-[#13243c] font-heading">
                {stats.kpis.validatedUsers}
              </div>
              <div className="text-[12px] text-gray-400 mt-2">
                Acheteurs & vendeurs actifs
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white rounded-[12px] border border-gray-200 p-6 shadow-sm">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Véhicules vendus
              </div>
              <div className="text-[28px] font-black text-[#13243c] font-heading">
                {stats.kpis.completedSales}
              </div>
              <div className="text-[12px] text-gray-400 mt-2">
                Transactions finalisées
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
