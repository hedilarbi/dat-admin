'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../api';
import Alert from '../../components/Alert';
import ConfirmModal from '../../components/ConfirmModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import Spinner from '../../components/Spinner';
import {
  CommissionTier,
  CommissionType,
  findCoverageGaps,
  formatAmount,
  formatCommission,
  formatRange,
} from '../../lib/commission';

interface SimulationResult {
  amount: number;
  commission: number;
  tier: CommissionTier | null;
}

/** Les tranches renvoyées par l'API de configuration ont toujours un identifiant. */
type StoredCommissionTier = CommissionTier & { _id: string };

const EMPTY_FORM = {
  minAmount: '',
  maxAmount: '',
  type: 'percentage' as CommissionType,
  value: '',
  label: '',
  active: true,
};

export default function CommissionsConfigurationPage() {
  const [tiers, setTiers] = useState<StoredCommissionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tierToDelete, setTierToDelete] = useState<StoredCommissionTier | null>(null);

  const [simulationAmount, setSimulationAmount] = useState('');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  const fetchTiers = async () => {
    try {
      const res = await apiRequest('/admin/commissions');
      setTiers(res.tiers || []);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement des tranches de commission.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  // Les trous entre deux tranches actives laissent des montants sans commission :
  // on les signale à l'admin plutôt que de les corriger silencieusement.
  const gaps = useMemo(() => findCoverageGaps(tiers), [tiers]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startCreate = () => {
    const activeTiers = tiers.filter(tier => tier.active);
    const highest = activeTiers.reduce<number | null>((acc, tier) => {
      if (tier.maxAmount === null) return acc;
      return acc === null || tier.maxAmount > acc ? tier.maxAmount : acc;
    }, null);

    resetForm();
    // Préremplir le minimum juste après la dernière tranche pour enchaîner les paliers
    setForm({ ...EMPTY_FORM, minAmount: highest === null ? '' : String(highest + 1) });
    setFormOpen(true);
    setError('');
    setSuccess('');
  };

  const startEdit = (tier: StoredCommissionTier) => {
    setEditingId(tier._id);
    setForm({
      minAmount: String(tier.minAmount),
      maxAmount: tier.maxAmount === null ? '' : String(tier.maxAmount),
      type: tier.type,
      value: String(tier.value),
      label: tier.label || '',
      active: tier.active,
    });
    setFormOpen(true);
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    resetForm();
    setError('');
  };

  useEffect(() => {
    if (!formOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setFormOpen(false);
        resetForm();
        setError('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen, saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const body = JSON.stringify({
      minAmount: form.minAmount,
      maxAmount: form.maxAmount === '' ? null : form.maxAmount,
      type: form.type,
      value: form.value,
      label: form.label,
      active: form.active,
    });

    try {
      if (editingId) {
        await apiRequest(`/admin/commissions/${editingId}`, { method: 'PUT', body });
        setSuccess('Tranche de commission mise à jour.');
      } else {
        await apiRequest('/admin/commissions', { method: 'POST', body });
        setSuccess('Nouvelle tranche de commission créée.');
      }
      setFormOpen(false);
      resetForm();
      setSimulation(null);
      await fetchTiers();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tier: StoredCommissionTier) => {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/commissions/${tier._id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !tier.active }),
      });
      setSimulation(null);
      await fetchTiers();
      setSuccess(tier.active ? 'Tranche désactivée.' : 'Tranche activée.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleDelete = async () => {
    if (!tierToDelete) return;
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/commissions/${tierToDelete._id}`, { method: 'DELETE' });
      setSimulation(null);
      await fetchTiers();
      setSuccess('Tranche de commission supprimée.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setTierToDelete(null);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (simulationAmount === '') return;
    setError('');
    setSimulating(true);
    try {
      const res = await apiRequest(`/admin/commissions/simulate?amount=${encodeURIComponent(simulationAmount)}`);
      setSimulation({ amount: res.amount, commission: res.commission, tier: res.tier });
    } catch (err: any) {
      setSimulation(null);
      setError(err.message || 'Erreur lors de la simulation.');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex-1 w-full p-6 sm:p-8 lg:p-10 font-sans text-black bg-white min-h-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
            Configuration système
          </div>
          <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
            Commissions
          </h1>
          <p className="text-[13px] leading-relaxed text-[#5a5e66] mt-2 max-w-[720px]">
            Définissez les tranches de commission plateforme appliquées au montant de la vente. Chaque tranche couvre un
            intervalle de montants et applique soit un pourcentage, soit un montant fixe. Chaque session hérite de cette
            configuration ; une session peut ensuite recevoir ses propres tranches depuis la page Sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="btn btn-primary shrink-0 self-start sm:self-auto"
        >
          + Ajouter une tranche
        </button>
      </div>

      {error && !formOpen && <Alert variant="error" className="mb-6">{error}</Alert>}
      {success && <Alert variant="success" className="mb-6">{success}</Alert>}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#13243c]/60 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="commission-form-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-[#dcd7cb] bg-[#fbfaf7] rounded-[14px] p-5 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#efece3] pb-4">
              <h2 id="commission-form-title" className="font-bold text-[16px] text-[#13243c] uppercase tracking-wide font-['Saira_Condensed',sans-serif]">
                {editingId ? 'Modifier la tranche' : 'Créer une tranche de commission'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="text-xs font-bold text-[#4c5058] hover:text-[#13243c] transition cursor-pointer"
              >
                × Annuler
              </button>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="commission-min" className="block text-[11px] font-semibold text-[#4c5058] uppercase tracking-wide mb-1.5">
                  Montant minimum (€)
                </label>
                <input
                  id="commission-min"
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="ex : 1"
                  value={form.minAmount}
                  onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                  className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                />
              </div>

              <div>
                <label htmlFor="commission-max" className="block text-[11px] font-semibold text-[#4c5058] uppercase tracking-wide mb-1.5">
                  Montant maximum (€)
                </label>
                <input
                  id="commission-max"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Laisser vide pour « et plus »"
                  value={form.maxAmount}
                  onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                  className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                />
                <p className="text-[11px] text-[#5a5e66] mt-1">Vide = tranche non bornée (dernier palier).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-[11px] font-semibold text-[#4c5058] uppercase tracking-wide mb-1.5">
                  Type de commission
                </span>
                <div className="flex gap-2">
                  {([
                    { value: 'percentage', label: 'Pourcentage (%)' },
                    { value: 'fixed', label: 'Montant fixe (€)' },
                  ] as Array<{ value: CommissionType; label: string }>).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: option.value })}
                      className={`flex-1 h-10 rounded-[8px] border text-[12px] font-bold uppercase tracking-[0.03em] transition cursor-pointer ${
                        form.type === option.value
                          ? 'bg-[#13243c] border-[#13243c] text-white'
                          : 'bg-white border-[#dcd7cb] text-[#4c5058] hover:border-[#13243c]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="commission-value" className="block text-[11px] font-semibold text-[#4c5058] uppercase tracking-wide mb-1.5">
                  {form.type === 'percentage' ? 'Pourcentage appliqué (%)' : 'Montant fixe appliqué (€)'}
                </label>
                <input
                  id="commission-value"
                  required
                  type="number"
                  min={0}
                  max={form.type === 'percentage' ? 100 : undefined}
                  step="0.01"
                  placeholder={form.type === 'percentage' ? 'ex : 5' : 'ex : 250'}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="commission-label" className="block text-[11px] font-semibold text-[#4c5058] uppercase tracking-wide mb-1.5">
                Libellé interne (facultatif)
              </label>
              <input
                id="commission-label"
                type="text"
                placeholder="ex : Petits véhicules"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
              />
            </div>

            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#13243c] cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 accent-[#13243c] cursor-pointer"
              />
              Tranche active (appliquée au calcul des commissions)
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-50 gap-2"
              >
                {saving && <Spinner />}
                {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Enregistrer la tranche'}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="border border-[#eceadf] rounded-[14px] overflow-hidden bg-white shadow-xs">
        <div className="p-5 bg-[#faf1e4] border-b border-[#ebdcc9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[18px] uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
                Tranches de commission
              </span>
              <span className="font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-[#b3893f] text-white uppercase">
                {tiers.length}
              </span>
            </div>
            <p className="text-[12px] text-[#8a6a2f] mt-0.5">
              Les tranches ne doivent pas se chevaucher : un montant de vente correspond toujours à une seule tranche.
            </p>
          </div>
        </div>

        {gaps.length > 0 && (
          <div className="px-5 py-3 bg-[#fdece4] border-b border-[#f5d5c7] text-[12px] text-[#b04a2c]">
            <span className="font-bold">Montants non couverts :</span> {gaps.join(', ')}. Aucune commission ne sera
            calculée sur ces montants.
          </div>
        )}

        {tiers.length === 0 ? (
          <div className="p-8 text-center text-[#5a5e66] text-xs font-medium italic">
            Aucune tranche de commission configurée. Cliquez sur « + Ajouter une tranche » pour commencer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-[#fbfaf7] border-b border-[#efece3]">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#4c5058]">Tranche</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#4c5058]">Type</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#4c5058]">Commission</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#4c5058]">Statut</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#4c5058] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efece3]">
                {tiers.map((tier) => (
                  <tr key={tier._id} className={`hover:bg-[#fcfbf9] transition ${tier.active ? '' : 'opacity-60'}`}>
                    <td className="px-5 py-4">
                      <div className="font-bold text-[14px] text-[#13243c]">{formatRange(tier)}</div>
                      {tier.label && <div className="text-[12px] text-[#5a5e66] mt-0.5">{tier.label}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#faf1e4] text-[#b3893f] rounded-full">
                        {tier.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-[14px] text-[#13243c]">{formatCommission(tier)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          tier.active ? 'bg-[#e6f2ea] text-[#2f6f4f]' : 'bg-gray-100 text-[#5a5e66]'
                        }`}
                      >
                        {tier.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => toggleActive(tier)}
                          className="font-bold text-[12px] text-[#4c5058] hover:underline cursor-pointer"
                        >
                          {tier.active ? 'Désactiver' : 'Activer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(tier)}
                          className="font-bold text-[12px] text-[#13243c] hover:underline cursor-pointer"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setTierToDelete(tier)}
                          className="font-bold text-[12px] text-[#9a3b2f] hover:underline cursor-pointer"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 border border-[#eceadf] rounded-[14px] bg-[#fbfaf7] p-5">
        <div className="font-bold text-[13px] text-[#13243c] uppercase tracking-wide mb-1">
          Simuler une commission
        </div>
        <p className="text-[12px] text-[#5a5e66] mb-4">
          Vérifiez la tranche appliquée et le montant de commission pour un prix de vente donné.
        </p>

        <form onSubmit={handleSimulate} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="w-full sm:w-[240px]">
            <label htmlFor="simulation-amount" className="block text-[11px] font-semibold text-[#4c5058] uppercase tracking-wide mb-1.5">
              Montant de la vente (€)
            </label>
            <input
              id="simulation-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder="ex : 2500"
              value={simulationAmount}
              onChange={(e) => setSimulationAmount(e.target.value)}
              className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
            />
          </div>
          <button
            type="submit"
            disabled={simulating || simulationAmount === ''}
            className="btn btn-primary disabled:opacity-50 gap-2"
          >
            {simulating && <Spinner />}
            Calculer
          </button>
        </form>

        {simulation && (
          <div className="mt-4 border border-[#dcd7cb] rounded-[10px] bg-white p-4">
            {simulation.tier ? (
              <>
                <div className="text-[13px] text-[#5a5e66]">
                  Tranche appliquée : <span className="font-bold text-[#13243c]">{formatRange(simulation.tier)}</span> ·{' '}
                  {formatCommission(simulation.tier)}
                </div>
                <div className="text-[20px] font-bold text-[#13243c] mt-1">
                  Commission : {formatAmount(simulation.commission)}
                </div>
              </>
            ) : (
              <div className="text-[13px] text-[#b04a2c] font-semibold">
                Aucune tranche active ne couvre {formatAmount(simulation.amount)} — commission nulle.
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmModal
        open={tierToDelete !== null}
        title="Supprimer la tranche"
        message={
          tierToDelete
            ? `Supprimer définitivement la tranche « ${formatRange(tierToDelete)} » ?`
            : ''
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={handleDelete}
        onCancel={() => setTierToDelete(null)}
      />
    </div>
  );
}
