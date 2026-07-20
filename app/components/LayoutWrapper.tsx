'use client';

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiRequest } from '../api';
import Link from 'next/link';
import { Bell, LogOut, X, ChevronDown, Menu } from 'lucide-react';

interface UserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin';
}

interface AdminNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  createdByUser?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
    role: 'acheteur' | 'vendeur';
    status: string;
  };
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = async () => {
    try {
      const res = await apiRequest('/auth/me');
      if (res.user.role !== 'admin') {
        throw new Error('Not admin');
      }
      setUser(res.user);
    } catch (err) {
      setUser(null);
      // Only redirect to login if we are not on login page
      if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/') {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, logout, refreshProfile: fetchProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useUser();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/';
  const isConfigSection = pathname.startsWith('/configuration');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await apiRequest(`/admin/notifications/${notificationId}/read`, { method: 'PUT' });
      await fetchNotifications();
    } catch (error) {
      console.error(error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await apiRequest('/admin/notifications/read-all', { method: 'PUT' });
      await fetchNotifications();
    } catch (error) {
      console.error(error);
    }
  };

  const getInitials = () => {
    if (!user) return 'AD';
    const first = user.firstName ? user.firstName[0] : '';
    const last = user.lastName ? user.lastName[0] : '';
    return (first + last).toUpperCase() || 'AD';
  };

  useEffect(() => {
    if (user && !isAuthPage) {
      const timer = window.setTimeout(() => {
        fetchNotifications();
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [fetchNotifications, isAuthPage, user]);

  useEffect(() => {
    if (!drawerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

  if (loading && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfaf7] font-sans">
        <div className="w-12 h-12 border-4 border-[#d9704f] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // GUEST / AUTH LAYOUT (No sidebar) — login page and the "/" redirect page
  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-white flex items-center justify-center font-sans">
        {children}
      </div>
    );
  }

  // Protected page reached while unauthenticated: hold on a spinner instead of
  // flashing the page content while the redirect to /login lands
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfaf7] font-sans">
        <div className="w-12 h-12 border-4 border-[#d9704f] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ADMIN LAYOUT (Full Screen Edge-to-Edge)
  return (
    <div className="h-dvh w-full bg-white flex overflow-hidden font-sans">
      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-label="Fermer le menu"
        />
      )}

      {/* Left Sidebar */}
      <aside
        id="admin-navigation"
        onClick={event => {
          if ((event.target as HTMLElement).closest('a')) setDrawerOpen(false);
        }}
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-[#13243c] p-[22px_18px_28px] flex flex-col justify-between select-none shadow-2xl transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-[240px] lg:max-w-none lg:shrink-0 lg:h-full lg:p-[28px_18px] lg:shadow-none lg:translate-x-0 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div>
          <div className="flex items-center justify-between mb-[30px] lg:mb-[36px]">
            <div className="w-[110px] h-[32px] border border-dashed border-[#47597a] rounded-[6px] flex items-center justify-center text-[9px] font-semibold tracking-widest uppercase text-[#8ea0bd]">
              Logo
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="h-10 w-10 rounded-[8px] border border-[#2c4266] text-white flex items-center justify-center hover:bg-[#1c3050] lg:hidden"
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            <Link href="/dashboard" className={`flex items-center px-[14px] py-[12px] rounded-[9px] font-[500] text-[14px] transition ${pathname === '/dashboard' ? 'bg-[#1c3050] text-white font-semibold' : 'text-[#9fb0c9] hover:bg-[#1a2b44]'}`}>
              Tableau de bord
            </Link>
            <Link href="/inscriptions" className={`flex items-center px-[14px] py-[12px] rounded-[9px] font-[500] text-[14px] transition ${pathname.startsWith('/inscriptions') ? 'bg-[#1c3050] text-white font-semibold' : 'text-[#9fb0c9] hover:bg-[#1a2b44]'}`}>
              Inscriptions
            </Link>
            <Link href="/dossiers" className={`flex items-center px-[14px] py-[12px] rounded-[9px] font-[500] text-[14px] transition ${pathname === '/dossiers' ? 'bg-[#1c3050] text-white font-semibold' : 'text-[#9fb0c9] hover:bg-[#1a2b44]'}`}>
              Dossiers véhicules
            </Link>
            <Link href="/sessions" className={`flex items-center px-[14px] py-[12px] rounded-[9px] font-[500] text-[14px] transition ${pathname === '/sessions' ? 'bg-[#1c3050] text-white font-semibold' : 'text-[#9fb0c9] hover:bg-[#1a2b44]'}`}>
              Sessions
            </Link>
            <Link href="/support" className={`flex items-center px-[14px] py-[12px] rounded-[9px] font-[500] text-[14px] transition ${pathname === '/support' ? 'bg-[#1c3050] text-white font-semibold' : 'text-[#9fb0c9] hover:bg-[#1a2b44]'}`}>
              Support
            </Link>

            <button
              type="button"
              onClick={() => setConfigOpen(o => !o)}
              className={`w-full flex items-center justify-between px-[14px] py-[12px] rounded-[9px] font-[500] text-[14px] transition cursor-pointer ${isConfigSection ? 'bg-[#1c3050] text-white font-semibold' : 'text-[#9fb0c9] hover:bg-[#1a2b44]'}`}
            >
              <span>Configuration</span>
              <ChevronDown size={14} className={`transition-transform ${configOpen || isConfigSection ? 'rotate-180' : ''}`} />
            </button>
            {(configOpen || isConfigSection) && (
              <div className="pl-3 flex flex-col gap-1">
                <Link href="/configuration/messages" className={`flex items-center px-[14px] py-[10px] rounded-[9px] font-[500] text-[13px] transition ${pathname === '/configuration/messages' ? 'bg-[#1c3050] text-white font-semibold' : 'text-[#9fb0c9] hover:bg-[#1a2b44]'}`}>
                  Messages
                </Link>
              </div>
            )}
          </nav>
        </div>
        
        <div className="border-t border-[#23385a] pt-4 text-[11px] text-[#8ea0bd] uppercase tracking-[0.08em]">
          Console admin
        </div>
      </aside>

      <div className="flex-1 h-full flex flex-col min-w-0 bg-[#fbfaf7]">
        <header className="h-[64px] bg-[#13243c] flex items-center px-3 sm:px-5 lg:px-8 gap-3 lg:gap-4 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="h-10 w-10 shrink-0 rounded-[8px] border border-[#2c4266] bg-[#1c3050] text-white flex items-center justify-center hover:bg-slate-800 transition lg:hidden"
            aria-label="Ouvrir le menu"
            aria-controls="admin-navigation"
            aria-expanded={drawerOpen}
          >
            <Menu size={20} />
          </button>
          <span className="text-white text-sm font-bold font-heading uppercase tracking-wide lg:hidden">Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(open => !open)}
                className="relative h-10 w-10 rounded-[8px] border border-[#2c4266] bg-[#1c3050] text-white flex items-center justify-center hover:bg-slate-800 transition cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#d9704f] text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="fixed left-3 right-3 top-[58px] sm:absolute sm:left-auto sm:right-0 sm:top-[48px] sm:w-[380px] bg-white border border-[#dcd7cb] shadow-[0_14px_35px_rgba(0,0,0,0.16)] z-30 text-black">
                  <div className="p-4 border-b border-[#efece3] flex items-center justify-between">
                    <div className="font-bold text-[#13243c] uppercase text-[13px] tracking-[0.06em]">Notifications</div>
                    <button type="button" onClick={markAllNotificationsAsRead} className="text-[11px] font-semibold text-[#d9704f] hover:underline">
                      Tout marquer lu
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-5 text-center text-sm text-[#8a8270]">Aucune notification.</div>
                    ) : (
                      notifications.slice(0, 5).map(notification => (
                        <button
                          key={notification._id}
                          type="button"
                          onClick={() => markNotificationAsRead(notification._id)}
                          className={`w-full text-left p-4 border-b border-[#efece3] hover:bg-[#fbfaf7] transition ${notification.readAt ? 'bg-white' : 'bg-[#fff7f1]'}`}
                        >
                          <div className="flex justify-between gap-3">
                            <div className="font-bold text-[13px] text-[#13243c]">{notification.title}</div>
                            {!notification.readAt && <span className="w-2 h-2 rounded-full bg-[#d9704f] shrink-0 mt-1.5"></span>}
                          </div>
                          <div className="text-[12px] text-[#5a5e66] mt-1">{notification.message}</div>
                          <div className="text-[11px] text-[#9a917d] mt-2">{new Date(notification.createdAt).toLocaleString('fr-FR')}</div>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsModalOpen(true);
                      setNotificationsOpen(false);
                    }}
                    className="w-full h-11 text-[12px] font-bold text-[#13243c] uppercase tracking-[0.04em] hover:bg-[#f8f7f2]"
                  >
                    Afficher toutes les notifications
                  </button>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-[#1c3050] border border-[#2c4266] rounded-[8px] p-[6px_14px_6px_6px]">
              <div className="w-[30px] h-[30px] rounded-full bg-[#b3893f] flex items-center justify-center text-[12px] font-bold text-white">
                {getInitials()}
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-white">{user.firstName} {user.lastName}</div>
                <div className="text-[11px] text-[#8ea0bd]">{user.email}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="h-10 w-10 sm:w-auto sm:px-3 rounded-[8px] bg-red-800 hover:bg-red-700 text-white flex items-center justify-center gap-2 font-bold text-[12px] uppercase tracking-[0.03em] transition cursor-pointer"
              aria-label="Déconnexion"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>

        {/* Right Main Content */}
        <main className="flex-1 min-h-0 flex flex-col min-w-0 bg-[#fbfaf7] overflow-y-auto">
          {children}
        </main>
      </div>

      {notificationsModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-[720px] max-h-[82vh] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.24)] flex flex-col">
            <div className="min-h-[64px] bg-[#13243c] flex items-center justify-between gap-3 px-4 sm:px-6 py-3 text-white shrink-0">
              <div>
                <div className="text-[11px] font-semibold text-[#8ea0bd] uppercase tracking-[0.16em]">Centre de notifications</div>
                <div className="font-bold">Notifications admin</div>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsModalOpen(false)}
                className="h-9 w-9 rounded-[8px] border border-[#2c4266] flex items-center justify-center hover:bg-[#1c3050]"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-[#efece3] flex justify-between items-center">
              <span className="text-sm font-semibold text-[#13243c]">{unreadCount} notification(s) non lue(s)</span>
              <button type="button" onClick={markAllNotificationsAsRead} className="text-[12px] font-bold text-[#d9704f] hover:underline">
                Tout marquer comme lu
              </button>
            </div>

            <div className="overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#8a8270]">Aucune notification admin pour le moment.</div>
              ) : (
                notifications.map(notification => (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => markNotificationAsRead(notification._id)}
                    className={`w-full p-5 border-b border-[#efece3] text-left hover:bg-[#fbfaf7] transition ${notification.readAt ? 'bg-white' : 'bg-[#fff7f1]'}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-4">
                      <div>
                        <div className="font-bold text-[#13243c]">{notification.title}</div>
                        <div className="text-sm text-[#5a5e66] mt-1">{notification.message}</div>
                        {notification.createdByUser && (
                          <div className="text-[12px] text-[#8a8270] mt-2">
                            {notification.createdByUser.companyName} · {notification.createdByUser.email}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {!notification.readAt && <div className="inline-flex px-2 py-1 rounded-full bg-[#fdece4] text-[#d9704f] text-[11px] font-bold mb-2">Nouveau</div>}
                        <div className="text-[11px] text-[#9a917d]">{new Date(notification.createdAt).toLocaleString('fr-FR')}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
