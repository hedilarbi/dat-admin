'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import FilterPills, { FilterOption } from '../components/FilterPills';
import { useRouter } from 'next/navigation';
import { Bell, Check, Clock, ExternalLink, ShieldAlert, Ticket, FileText, UserPlus } from 'lucide-react';

interface AdminNotification {
  _id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  metadata?: {
    ticketId?: string;
    userId?: string;
    role?: string;
    dossierId?: string;
    saleId?: string;
    [key: string]: unknown;
  };
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

const FILTER_OPTIONS: FilterOption<string>[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'registration_submitted', label: 'Inscriptions' },
  { value: 'vehicle_dossier_submitted', label: 'Dossiers véhicules' },
  { value: 'ticket_created', label: 'Support / Tickets' },
  { value: 'late_payment_alert', label: 'Retards paiement' },
  { value: 'certificate_rejected', label: 'Certificats refusés' },
];

export default function NotificationsCenterPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await apiRequest(`/admin/notifications/${id}/read`, { method: 'PUT' });
      // Update local state smoothly
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: unknown) {
      console.error('Impossible de marquer la notification comme lue:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/admin/notifications/read-all', { method: 'PUT' });
      setNotifications(prev =>
        prev.map(n => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      setSuccess('Toutes les notifications ont été marquées comme lues.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du marquage des notifications.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification: AdminNotification) => {
    if (!notification.readAt) {
      await markAsRead(notification._id);
    }
    
    // Redirect if target path exists
    const path = getRedirectPath(notification);
    if (path) {
      router.push(path);
    }
  };

  const getNotificationTypeDetails = (type: string) => {
    switch (type) {
      case 'registration_submitted':
        return {
          icon: UserPlus,
          bgColor: 'bg-blue-50 text-blue-600 border-blue-100',
          label: 'Inscription',
        };
      case 'vehicle_dossier_submitted':
        return {
          icon: FileText,
          bgColor: 'bg-green-50 text-green-600 border-green-100',
          label: 'Dossier',
        };
      case 'ticket_created':
        return {
          icon: Ticket,
          bgColor: 'bg-purple-50 text-purple-600 border-purple-100',
          label: 'Support',
        };
      case 'late_payment_alert':
        return {
          icon: Clock,
          bgColor: 'bg-amber-50 text-amber-600 border-amber-100',
          label: 'Paiement retard',
        };
      case 'certificate_rejected':
        return {
          icon: ShieldAlert,
          bgColor: 'bg-red-50 text-red-600 border-red-100',
          label: 'Certificat refusé',
        };
      default:
        return {
          icon: Bell,
          bgColor: 'bg-gray-50 text-gray-600 border-gray-100',
          label: 'Notification',
        };
    }
  };

  const getRedirectPath = (notification: AdminNotification) => {
    const { type, metadata } = notification;
    if (type === 'registration_submitted' && metadata?.userId && metadata?.role) {
      return `/inscription/${metadata.role}/${metadata.userId}`;
    }
    if (type === 'vehicle_dossier_submitted' && metadata?.dossierId) {
      return `/dossiers/${metadata.dossierId}`;
    }
    if (type === 'ticket_created' && metadata?.ticketId) {
      return `/support?ticketId=${metadata.ticketId}`;
    }
    if ((type === 'late_payment_alert' || type === 'certificate_rejected') && metadata?.saleId) {
      return `/ventes/${metadata.saleId}`;
    }
    return null;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex-1 w-full p-6 sm:p-8 lg:p-10 font-sans text-black bg-white min-h-full">
      <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
            Notifications système
          </div>
          <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
            Centre de notifications
          </h1>
          <p className="text-[13px] leading-relaxed text-[#5a5e66] mt-2 max-w-[720px]">
            Consultez, filtrez et traitez les actions requises sur la plateforme.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="sm:self-end inline-flex items-center gap-2 px-4 py-2 border border-[#d9704f] rounded-[8px] text-[12px] font-bold uppercase tracking-wider text-[#d9704f] bg-white hover:bg-[#fff7f1] transition disabled:opacity-50"
          >
            <Check size={14} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {success && <Alert variant="success" className="mb-6">{success}</Alert>}

      <div className="mb-6">
        <FilterPills
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div className="border border-[#eceadf] rounded-[14px] overflow-hidden bg-white shadow-xs">
        {filteredNotifications.length === 0 ? (
          <div className="p-16 text-center text-[#5a5e66]">
            <Bell size={40} className="mx-auto text-gray-300 mb-3 animate-bounce" />
            <p className="font-semibold text-sm">Aucune notification</p>
            <p className="text-xs mt-1">Il n&apos;y a aucun événement correspondant à ce filtre pour le moment.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#efece3]">
            {filteredNotifications.map(notification => {
              const { icon: Icon, bgColor, label } = getNotificationTypeDetails(notification.type);
              const path = getRedirectPath(notification);
              const isUnread = !notification.readAt;

              return (
                <div
                  key={notification._id}
                  className={`p-5 flex items-start gap-4 transition hover:bg-[#fbfaf7] ${
                    isUnread ? 'bg-[#fffcf9]' : 'bg-white'
                  }`}
                >
                  {/* Left Status Icon */}
                  <div className={`p-2.5 rounded-[10px] border shrink-0 ${bgColor}`}>
                    <Icon size={20} />
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">
                        {label}
                      </span>
                      {isUnread && (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-[#fdece4] text-[#d9704f] text-[10px] font-bold">
                          Nouveau
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-[#13243c] text-[15px] mt-1">
                      {notification.title}
                    </h3>
                    <p className="text-sm text-[#5a5e66] leading-relaxed mt-1">
                      {notification.message}
                    </p>

                    {notification.createdByUser && (
                      <div className="text-[12px] text-gray-500 mt-2 font-medium">
                        De : {notification.createdByUser.companyName} ({notification.createdByUser.email})
                      </div>
                    )}

                    <div className="text-[11px] text-[#8a8e97] mt-1">
                      {new Date(notification.createdAt).toLocaleString('fr-FR')}
                    </div>
                  </div>

                  {/* Right Action Trigger */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {path && (
                      <button
                        onClick={() => handleNotificationClick(notification)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#13243c] text-white hover:bg-[#1c3050] text-[11px] font-bold uppercase transition"
                      >
                        Consulter
                        <ExternalLink size={12} />
                      </button>
                    )}
                    {isUnread && !path && (
                      <button
                        onClick={() => markAsRead(notification._id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] font-semibold transition"
                      >
                        Marquer lu
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
