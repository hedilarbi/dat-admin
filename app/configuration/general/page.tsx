'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import Spinner from '../../components/Spinner';

interface GeneralConfig {
  commissionPaymentDeadlineHours: number;
  bankTransferDeadlineHours: number;
  vehicleListingAttempts: number;
  nextWinnerAcceptanceDeadlineHours: number;
  accountReactivationFee: number;
  adminEmail: string;
}

const EMPTY_FORM = {
  commissionPaymentDeadlineHours: '',
  bankTransferDeadlineHours: '',
  vehicleListingAttempts: '',
  nextWinnerAcceptanceDeadlineHours: '',
  accountReactivationFee: '',
  adminEmail: '',
};

type FormState = typeof EMPTY_FORM;

const FIELDS: Array<{
  key: keyof FormState;
  label: string;
  unit?: string;
  help: string;
  type?: 'number' | 'email';
}> = [
  {
    key: 'commissionPaymentDeadlineHours',
    label: 'Délai de paiement de la commission',
    unit: 'heures',
    help: "Temps laissé au gagnant pour régler la commission plateforme. Passé ce délai, le véhicule est attribué au candidat suivant de la liste d'attente.",
    type: 'number',
  },
  {
    key: 'bankTransferDeadlineHours',
    label: 'Délai de virement',
    unit: 'heures',
    help: "Temps laissé à l'acheteur pour virer le prix du véhicule au vendeur, une fois la commission réglée.",
    type: 'number',
  },
  {
    key: 'vehicleListingAttempts',
    label: 'Tentatives de mise en vente',
    unit: 'tentatives',
    help: "Nombre de fois qu'un même véhicule peut être publié en session d'appel d'offres.",
    type: 'number',
  },
  {
    key: 'nextWinnerAcceptanceDeadlineHours',
    label: 'Délai du gagnant suivant',
    unit: 'heures',
    help: "Délai laissé au gagnant suivant pour accepter ou refuser le véhicule lorsqu'il lui est proposé.",
    type: 'number',
  },
  {
    key: 'accountReactivationFee',
    label: 'Frais de réactivation de compte',
    unit: '€',
    help: "Frais de dossier que l'acheteur suspendu doit payer pour réactiver son compte.",
    type: 'number',
  },
  {
    key: 'adminEmail',
    label: "Adresse e-mail de l'administrateur",
    help: "Adresse email système configurée pour recevoir toutes les alertes de retard de paiement et notifications de documents refusés.",
    type: 'email',
  },
];

export default function GeneralConfigurationPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiRequest('/admin/general-config')
      .then((res) => {
        const config: GeneralConfig = res.config;
        const values: FormState = {
          commissionPaymentDeadlineHours: String(config.commissionPaymentDeadlineHours),
          bankTransferDeadlineHours: String(config.bankTransferDeadlineHours),
          vehicleListingAttempts: String(config.vehicleListingAttempts),
          nextWinnerAcceptanceDeadlineHours: String(config.nextWinnerAcceptanceDeadlineHours),
          accountReactivationFee: String(config.accountReactivationFee),
          adminEmail: config.adminEmail || '',
        };
        setForm(values);
        setInitialForm(values);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erreur de chargement de la configuration.');
      })
      .finally(() => setLoading(false));
  }, []);

  const hasChanges = FIELDS.some(({ key }) => form[key] !== initialForm[key]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    // Contrôle en miroir du serveur
    const invalid = FIELDS.find((field) => {
      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRegex.test(form[field.key]);
      }
      const value = Number(form[field.key]);
      return form[field.key] === '' || !Number.isInteger(value) || value < 1;
    });

    if (invalid) {
      if (invalid.type === 'email') {
        setError(`${invalid.label} doit être une adresse email valide.`);
      } else {
        setError(`${invalid.label} doit être un nombre entier supérieur ou égal à 1.`);
      }
      return;
    }

    setSaving(true);
    try {
      const payload = Object.fromEntries(
        FIELDS.map((field) => [
          field.key,
          field.type === 'email' ? form[field.key].trim() : Number(form[field.key])
        ])
      );
      const res = await apiRequest('/admin/general-config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const config: GeneralConfig = res.config;
      const values: FormState = {
        commissionPaymentDeadlineHours: String(config.commissionPaymentDeadlineHours),
        bankTransferDeadlineHours: String(config.bankTransferDeadlineHours),
        vehicleListingAttempts: String(config.vehicleListingAttempts),
        nextWinnerAcceptanceDeadlineHours: String(config.nextWinnerAcceptanceDeadlineHours),
        accountReactivationFee: String(config.accountReactivationFee),
        adminEmail: config.adminEmail || '',
      };
      setForm(values);
      setInitialForm(values);
      setSuccess('Configuration générale enregistrée.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex-1 w-full p-6 sm:p-8 lg:p-10 font-sans text-black bg-white min-h-full">
      <div className="mb-7">
        <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
          Configuration système
        </div>
        <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
          Configuration générale
        </h1>
        <p className="text-[13px] leading-relaxed text-[#5a5e66] mt-2 max-w-[720px]">
          Délais de la procédure d&apos;achat et limite de remise en vente appliqués à l&apos;ensemble de la plateforme.
        </p>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {success && <Alert variant="success" className="mb-6">{success}</Alert>}

      <form onSubmit={handleSubmit} className="max-w-[720px]">
        <section className="border border-[#eceadf] rounded-[14px] overflow-hidden bg-white shadow-xs">
          <div className="p-5 bg-[#faf1e4] border-b border-[#ebdcc9]">
            <span className="font-bold text-[18px] uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
              Paramètres généraux
            </span>
            <p className="text-[12px] text-[#8a6a2f] mt-0.5">
              Ces valeurs s&apos;appliquent aux ventes en cours comme aux ventes à venir.
            </p>
          </div>

          <div className="divide-y divide-[#efece3]">
            {FIELDS.map((field) => (
              <div key={field.key} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <label htmlFor={field.key} className="block font-bold text-[14px] text-[#13243c]">
                    {field.label}
                  </label>
                  <p className="text-[12px] text-[#5a5e66] leading-relaxed mt-1">{field.help}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    id={field.key}
                    type={field.type === 'email' ? 'email' : 'number'}
                    min={field.type !== 'email' ? 1 : undefined}
                    step={field.type !== 'email' ? 1 : undefined}
                    required
                    value={form[field.key]}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                    className={`${field.type === 'email' ? 'w-[220px]' : 'w-[110px]'} h-10 border border-[#dcd7cb] rounded-[8px] px-3 font-mono font-semibold text-[14px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]`}
                  />
                  {field.unit && (
                    <span className="text-[12px] font-semibold text-[#5a5e66] w-[74px]">{field.unit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 mt-5">
          {!hasChanges && <span className="text-[12px] text-[#5a5e66]">Aucune modification en attente.</span>}
          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed gap-2"
          >
            {saving && <Spinner />}
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
