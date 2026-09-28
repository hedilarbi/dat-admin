'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Save } from 'lucide-react';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import SkeletonRows from '../components/SkeletonRows';

interface ShowcaseVehicle {
  _id: string;
  brand?: string;
  model?: string;
  registrationNumber?: string;
  imageUrl: string;
  showcaseOrder?: number | null;
}

export default function ShowcaseAdminPage() {
  const [vehicles, setVehicles] = useState<ShowcaseVehicle[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiRequest('/admin/vehicle-dossiers/showcase')
      .then((response) => {
        const rows: ShowcaseVehicle[] = response.vehicles || [];
        setVehicles(rows);
        setSelectedIds(rows.filter((row) => row.showcaseOrder != null).sort((a, b) => Number(a.showcaseOrder) - Number(b.showcaseOrder)).map((row) => row._id));
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Chargement impossible.'))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle._id, vehicle])), [vehicles]);
  const selected = selectedIds.map((id) => byId.get(id)).filter(Boolean) as ShowcaseVehicle[];
  const available = vehicles
    .filter((vehicle) => !selectedIds.includes(vehicle._id))
    .sort((a, b) => `${a.brand || ''} ${a.model || ''}`.localeCompare(`${b.brand || ''} ${b.model || ''}`, 'fr'));

  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const move = (index: number, direction: -1 | 1) => setSelectedIds((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      await apiRequest('/admin/vehicle-dossiers/showcase', { method: 'PUT', body: JSON.stringify({ vehicleIds: selectedIds }) });
      setMessage('La vitrine publique a été mise à jour.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Enregistrement impossible.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8"><SkeletonRows /></div>;

  return (
    <div className="min-h-full bg-white px-6 py-8 font-sans sm:px-10">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a3987f]">Site public et application mobile</div><h1 className="font-['Saira_Condensed',sans-serif] text-[36px] font-bold uppercase leading-none text-[#13243c]">Gestion de la vitrine</h1><p className="mt-3 max-w-2xl text-sm text-[#5a5e66]">Choisissez les véhicules montrés aux visiteurs non connectés et organisez leur ordre d’affichage. Seules leurs images seront publiques.</p></div>
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary gap-2 disabled:opacity-50"><Save size={16} />{saving ? 'Enregistrement…' : 'Enregistrer la vitrine'}</button>
      </div>
      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {message && <Alert variant="success" className="mb-5">{message}</Alert>}

      <div className="grid gap-7 xl:grid-cols-2">
        <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold uppercase text-[#13243c]">Sélection publique</h2><span className="rounded-full bg-[#13243c] px-2.5 py-1 text-xs font-bold text-white">{selected.length}</span></div>
          <div className="space-y-3 rounded-[14px] border border-[#e5e1d7] bg-[#f8f7f2] p-3">
            {selected.length === 0 && <p className="p-8 text-center text-sm text-[#5a5e66]">Aucun véhicule sélectionné.</p>}
            {selected.map((vehicle, index) => <VehicleRow key={vehicle._id} vehicle={vehicle} selected order={index + 1} onToggle={() => toggle(vehicle._id)} actions={<><button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="icon-btn disabled:opacity-30" aria-label="Monter"><ArrowUp size={15} /></button><button type="button" onClick={() => move(index, 1)} disabled={index === selected.length - 1} className="icon-btn disabled:opacity-30" aria-label="Descendre"><ArrowDown size={15} /></button></>} />)}
          </div>
        </section>
        <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold uppercase text-[#13243c]">Véhicules disponibles</h2><span className="text-xs font-semibold text-[#5a5e66]">{available.length}</span></div>
          <div className="max-h-[680px] space-y-3 overflow-y-auto rounded-[14px] border border-[#e5e1d7] p-3">
            {available.map((vehicle) => <VehicleRow key={vehicle._id} vehicle={vehicle} onToggle={() => toggle(vehicle._id)} />)}
            {available.length === 0 && <p className="p-8 text-center text-sm text-[#5a5e66]">Tous les véhicules disponibles sont sélectionnés.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function VehicleRow({ vehicle, selected = false, order, onToggle, actions }: { vehicle: ShowcaseVehicle; selected?: boolean; order?: number; onToggle: () => void; actions?: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-[11px] border border-[#e5e1d7] bg-white p-3"><img src={vehicle.imageUrl} alt="" className="h-16 w-24 rounded-[8px] object-cover" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[#13243c]">{[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Véhicule'}</div><div className="mt-1 font-mono text-xs text-[#5a5e66]">{vehicle.registrationNumber || 'Sans immatriculation'}</div></div>{order && <span className="font-mono text-xs font-bold text-[#b3893f]">#{order}</span>}<div className="flex gap-1">{actions}</div><button type="button" onClick={onToggle} className={`flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-xs font-bold ${selected ? 'bg-[#fdece4] text-[#b04a2c]' : 'bg-[#13243c] text-white'}`}><Eye size={14} />{selected ? 'Retirer' : 'Ajouter'}</button></div>;
}
