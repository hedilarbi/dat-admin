'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './components/LayoutWrapper';
import { apiRequest } from './api';
import Link from 'next/link';

interface DashboardStats {
  pendingActions: {
    users: number;
    buyers: number;
    sellers: number;
    dossiers: number;
    tickets: number;
    criticalSales?: number;
    unsoldVehicles?: number;
    unsoldThreshold?: number;
    waitingVehicles?: number;
    blockedAccounts?: number;
    blockedBuyers?: number;
    blockedSellers?: number;
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
      currentStep?: number | null;
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
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchStats = async () => {
      try {
        const resStats = await apiRequest('/admin/dashboard-stats').catch(() => null);
        if (resStats && resStats.data) setStats(resStats.data);
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Acheteurs en attente */}
            <Link href="/inscriptions/acheteur?statut=attente" className="bg-white rounded-[12px] border border-red-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Inscriptions acheteurs en attente</h3>
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.buyers}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-red-500 transition font-medium">
                → Gérer les acheteurs
              </p>
            </Link>

            {/* Vendeurs en attente */}
            <Link href="/inscriptions/vendeur?statut=attente" className="bg-white rounded-[12px] border border-red-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Inscriptions vendeurs en attente</h3>
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.sellers}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-red-500 transition font-medium">
                → Gérer les vendeurs
              </p>
            </Link>

            {/* Dossiers en attente */}
            <Link href="/dossiers?statut=attente" className="bg-white rounded-[12px] border border-orange-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
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
            <Link href="/support?statut=attente" className="bg-white rounded-[12px] border border-blue-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
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

            {/* Ventes critiques : étape 1 ou 2 au-delà de 80 % du délai */}
            <Link href="/ventes?filtre=critiques" className="bg-white rounded-[12px] border border-red-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#B04A2C]"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Ventes critiques</h3>
                <span className="w-8 h-8 rounded-full bg-red-100 text-[#B04A2C] flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.criticalSales ?? stats.pendingActions.latePayments?.length ?? 0}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-[#B04A2C] transition font-medium">
                → Voir les ventes critiques
              </p>
            </Link>

            {/* Véhicules invendus : tentatives de mise en vente épuisées */}
            <Link href="/vehicules?filtre=invendus" className="bg-white rounded-[12px] border border-yellow-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#d4a017]"></div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Véhicules invendus</h3>
                  {stats.pendingActions.unsoldThreshold ? (
                    <p className="mt-0.5 text-[11px] text-gray-400">{stats.pendingActions.unsoldThreshold} tentatives ou plus</p>
                  ) : null}
                </div>
                <span className="w-8 h-8 rounded-full bg-yellow-100 text-[#a07a0f] flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.unsoldVehicles ?? 0}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-[#a07a0f] transition font-medium">
                → Voir les véhicules invendus
              </p>
            </Link>

            {/* Véhicules validés qui attendent d'être affectés à une session */}
            <Link href="/vehicules?etat=en_attente" className="bg-white rounded-[12px] border border-slate-200 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#6b7280]"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Véhicules en attente de session</h3>
                <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.waitingVehicles ?? 0}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-auto group-hover:text-slate-600 transition font-medium">
                → Affecter à une session
              </p>
            </Link>

            {/* Comptes suspendus ou bloqués : ouvre la liste des acheteurs (ou vendeurs) déjà filtrée */}
            <Link href={(stats.pendingActions.blockedBuyers ?? 0) === 0 && (stats.pendingActions.blockedSellers ?? 0) > 0 ? '/inscriptions/vendeur?statut=suspendu' : '/inscriptions/acheteur?statut=suspendu'} className="bg-white rounded-[12px] border border-red-100 shadow-sm hover:shadow-md transition p-6 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#b91c1c]"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-bold text-gray-600 uppercase tracking-wide">Comptes suspendus / bloqués</h3>
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-[14px]">
                  {stats.pendingActions.blockedAccounts ?? 0}
                </span>
              </div>
              <p className="text-[12px] text-gray-500 mt-auto font-medium">
                {stats.pendingActions.blockedBuyers ?? 0} acheteur(s) · {stats.pendingActions.blockedSellers ?? 0} vendeur(s)
              </p>
              <p className="text-[12px] text-gray-400 mt-1 group-hover:text-red-600 transition font-medium">→ Voir les comptes</p>
            </Link>
          </div>
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
