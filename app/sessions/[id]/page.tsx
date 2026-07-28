'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Car, Calendar, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
// import { apiRequest } from '../../api';

interface Vehicle {
  _id: string;
  brand: string;
  model: string;
  year: number;
  vin: string;
  photos: { processedUrl?: string; originalUrl: string; isCover: boolean }[];
  seller: { companyName: string; firstName: string; lastName: string };
}

interface Session {
  _id: string;
  date: string;
  status: string;
  vehicles: Vehicle[];
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [draggedVehicle, setDraggedVehicle] = useState<Vehicle | null>(null);
  const [isDraggingOverRight, setIsDraggingOverRight] = useState(false);
  const [isDraggingOverLeft, setIsDraggingOverLeft] = useState(false);

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // MOCK DATA
      const mockSessionData: Session = {
        _id: sessionId,
        date: new Date().toISOString(),
        status: 'active',
        vehicles: [
          {
            _id: 'v1',
            brand: 'Renault',
            model: 'Clio',
            year: 2020,
            vin: 'VF1RCA000123',
            photos: [{ originalUrl: '/placeholder-car.jpg', isCover: true }],
            seller: { companyName: 'Garage Auto', firstName: 'Jean', lastName: 'Dupont' }
          }
        ]
      };

      const mockAvailableData = {
        dossiers: [
          {
            _id: 'v2',
            brand: 'Peugeot',
            model: '208',
            year: 2021,
            vin: 'VF3PGE000456',
            photos: [{ originalUrl: '/placeholder-car.jpg', isCover: true }],
            seller: { companyName: 'Concession Sud', firstName: 'Marie', lastName: 'Martin' }
          },
          {
            _id: 'v3',
            brand: 'Volkswagen',
            model: 'Golf',
            year: 2019,
            vin: 'WVWZZZ000789',
            photos: [{ originalUrl: '/placeholder-car.jpg', isCover: true }],
            seller: { companyName: 'Auto Pro', firstName: 'Paul', lastName: 'Durand' }
          }
        ]
      };

      setSession(mockSessionData);
      setAvailableVehicles(mockAvailableData.dossiers || []);
    } catch (error) {
      console.error('Erreur de chargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, vehicle: Vehicle) => {
    setDraggedVehicle(vehicle);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to keep the original item visible while dragging
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedVehicle(null);
    setIsDraggingOverRight(false);
    setIsDraggingOverLeft(false);
    (e.target as HTMLElement).classList.remove('opacity-50');
  };

  // Dropping into Session (Right panel)
  const handleDragOverRight = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!session?.vehicles.find(v => v._id === draggedVehicle?._id)) {
      setIsDraggingOverRight(true);
    }
  };

  const handleDragLeaveRight = () => {
    setIsDraggingOverRight(false);
  };

  const handleDropRight = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverRight(false);
    if (!draggedVehicle) return;

    // Check if it's already in the session
    if (session?.vehicles.find(v => v._id === draggedVehicle._id)) return;

    // Optimistic UI update
    setSession(prev => prev ? { ...prev, vehicles: [...prev.vehicles, draggedVehicle] } : null);
    setAvailableVehicles(prev => prev.filter(v => v._id !== draggedVehicle._id));

    // MOCK DATA: No API call
    /*
    try {
      await apiRequest(`/sessions/${sessionId}/add-vehicle`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: draggedVehicle._id })
      });
    } catch (error) {
      console.error('Erreur ajout véhicule:', error);
      fetchData(); // Revert on error
    }
    */
  };

  // Dropping into Available (Left panel) - Remove from session
  const handleDragOverLeft = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (session?.vehicles.find(v => v._id === draggedVehicle?._id)) {
      setIsDraggingOverLeft(true);
    }
  };

  const handleDragLeaveLeft = () => {
    setIsDraggingOverLeft(false);
  };

  const handleDropLeft = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverLeft(false);
    if (!draggedVehicle) return;

    // Check if it's from the session
    if (!session?.vehicles.find(v => v._id === draggedVehicle._id)) return;

    // Optimistic UI update
    setAvailableVehicles(prev => [...prev, draggedVehicle]);
    setSession(prev => prev ? { ...prev, vehicles: prev.vehicles.filter(v => v._id !== draggedVehicle._id) } : null);

    // MOCK DATA: No API call
    /*
    try {
      await apiRequest(`/sessions/${sessionId}/remove-vehicle`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: draggedVehicle._id })
      });
    } catch (error) {
      console.error('Erreur retrait véhicule:', error);
      fetchData(); // Revert on error
    }
    */
  };

  // Also support click-to-move for accessibility
  const moveToSession = async (vehicle: Vehicle) => {
    setSession(prev => prev ? { ...prev, vehicles: [...prev.vehicles, vehicle] } : null);
    setAvailableVehicles(prev => prev.filter(v => v._id !== vehicle._id));
    // MOCK DATA: No API call
    /*
    try {
      await apiRequest(`/sessions/${sessionId}/add-vehicle`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: vehicle._id })
      });
    } catch (error) { fetchData(); }
    */
  };

  const removeFromSession = async (vehicle: Vehicle) => {
    setAvailableVehicles(prev => [...prev, vehicle]);
    setSession(prev => prev ? { ...prev, vehicles: prev.vehicles.filter(v => v._id !== vehicle._id) } : null);
    // MOCK DATA: No API call
    /*
    try {
      await apiRequest(`/sessions/${sessionId}/remove-vehicle`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: vehicle._id })
      });
    } catch (error) { fetchData(); }
    */
  };

  if (isLoading) {
    return <div className="p-10 text-center">Chargement...</div>;
  }

  if (!session) {
    return <div className="p-10 text-center text-red-500">Session introuvable</div>;
  }

  const sessionDate = new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const VehicleCard = ({ vehicle, onAction, actionLabel }: { vehicle: Vehicle, onAction: (v: Vehicle) => void, actionLabel: string }) => {
    const coverPhoto = vehicle.photos?.find(p => p.isCover) || vehicle.photos?.[0];
    const imageUrl = coverPhoto?.processedUrl || coverPhoto?.originalUrl || '/placeholder-car.jpg';

    return (
      <div 
        draggable
        onDragStart={(e) => handleDragStart(e, vehicle)}
        onDragEnd={handleDragEnd}
        className="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-[#ff4e00] hover:shadow-md transition-all flex gap-4 items-center group"
      >
        <div className="w-20 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">
          <img src={imageUrl} alt={vehicle.model} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{vehicle.brand} {vehicle.model}</div>
          <div className="text-xs text-gray-500 truncate">
            {vehicle.year} • VIN: {vehicle.vin}
          </div>
          <div className="text-xs text-gray-400 truncate mt-1">
            Vendeur: {vehicle.seller?.companyName || `${vehicle.seller?.firstName} ${vehicle.seller?.lastName}`}
          </div>
        </div>
        <button 
          onClick={() => onAction(vehicle)}
          className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-[#ff4e00] bg-gray-50 hover:bg-orange-50 rounded-full transition-all"
          title={actionLabel}
        >
          {actionLabel === 'Ajouter' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-hidden flex flex-col font-sans text-black bg-[#fbfaf7] h-full">
      <div className="p-4 sm:p-6 lg:p-8 pb-4 border-b border-gray-200 bg-white shadow-sm z-10 flex items-center gap-4">
        <button 
          onClick={() => router.push('/sessions')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <PageHeader eyebrow="Configuration de la session" title={`Session du ${sessionDate}`} />
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md">
              <Calendar size={14} /> <span className="capitalize">{session.status}</span>
            </span>
            <span className="flex items-center gap-1 bg-orange-50 text-[#ff4e00] px-2 py-1 rounded-md font-medium">
              <Car size={14} /> {session.vehicles.length} voitures
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left Panel: Available Vehicles */}
        <div 
          className={`flex-1 flex flex-col bg-white rounded-xl border transition-all ${isDraggingOverLeft ? 'border-[#ff4e00] shadow-[0_0_0_4px_rgba(255,78,0,0.1)]' : 'border-gray-200 shadow-sm'}`}
          onDragOver={handleDragOverLeft}
          onDragLeave={handleDragLeaveLeft}
          onDrop={handleDropLeft}
        >
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
            <h3 className="font-semibold flex items-center gap-2">
              Dossiers Valides
              <span className="bg-gray-200 text-gray-700 text-xs py-0.5 px-2 rounded-full">{availableVehicles.length}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">Véhicules en attente d'affectation</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
            {availableVehicles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <CheckCircle2 size={32} className="mb-2 text-gray-300" />
                <p>Aucun dossier valide en attente.</p>
              </div>
            ) : (
              availableVehicles.map(vehicle => (
                <VehicleCard 
                  key={vehicle._id} 
                  vehicle={vehicle} 
                  onAction={moveToSession} 
                  actionLabel="Ajouter" 
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Session Vehicles */}
        <div 
          className={`flex-1 flex flex-col bg-white rounded-xl border transition-all ${isDraggingOverRight ? 'border-[#ff4e00] shadow-[0_0_0_4px_rgba(255,78,0,0.1)]' : 'border-gray-200 shadow-sm'}`}
          onDragOver={handleDragOverRight}
          onDragLeave={handleDragLeaveRight}
          onDrop={handleDropRight}
        >
          <div className="p-4 border-b border-orange-100 bg-orange-50/30 rounded-t-xl">
            <h3 className="font-semibold text-[#ff4e00] flex items-center gap-2">
              Véhicules dans la session
              <span className="bg-[#ff4e00] text-white text-xs py-0.5 px-2 rounded-full">{session.vehicles.length}</span>
            </h3>
            <p className="text-xs text-orange-600/80 mt-1">Glissez les véhicules ici pour les ajouter</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-orange-50/10">
            {session.vehicles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <Car size={32} className="mb-2 text-gray-300" />
                <p>Glissez un dossier ici</p>
              </div>
            ) : (
              session.vehicles.map(vehicle => (
                <VehicleCard 
                  key={vehicle._id} 
                  vehicle={vehicle} 
                  onAction={removeFromSession} 
                  actionLabel="Retirer" 
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
