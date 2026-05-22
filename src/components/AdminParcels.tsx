import { useState, useEffect } from "react";
import { Parcel } from "../types";
import { Search, MapPin, ListFilter, AlertTriangle, ArrowUpDown, RefreshCw, Layers } from "lucide-react";

interface AdminParcelsProps {
  token: string;
}

export default function AdminParcels({ token }: AdminParcelsProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Location / Status update workspace state
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [newLocation, setNewLocation] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [scanDescription, setScanDescription] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  const locationsList = ["Singapore Hub", "Changi Warehouse", "Out for Delivery", "Customs", "Destination Facility"];
  const statusesList = ["pending", "picked_up", "in_transit", "out_for_delivery", "delivered", "exception"];

  const fetchParcels = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/parcels", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setParcels(data);
      } else {
        setError("Could not load shipments ledger.");
      }
    } catch (err) {
      setError("Error connecting to admin parcels APIs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  const openUpdateModal = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    setNewLocation(parcel.current_location);
    setNewStatus(parcel.status);
    setScanDescription("");
    setError("");
    setSuccess("");
  };

  const handleUpdateLocation = async () => {
    if (!selectedParcel) return;
    setUpdateLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/admin/parcels/${selectedParcel.id}/location`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location: newLocation,
          description: scanDescription || `Arrived at ${newLocation}.`
        })
      });

      const body = await resp.json();
      if (resp.ok) {
        setSuccess(`Successfully scanned location: "${newLocation}". Status transitioned to: "${body.status}"`);
        setSelectedParcel(null);
        fetchParcels();
      } else {
        setError(body.error || "Failed to update package scan location.");
      }
    } catch (err) {
      setError("Backend scan communication error.");
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedParcel) return;
    setUpdateLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/admin/parcels/${selectedParcel.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          description: scanDescription || `Parcel status changed manually to ${newStatus}`
        })
      });

      if (resp.ok) {
        setSuccess(`Successfully updated parcel status to "${newStatus}"!`);
        setSelectedParcel(null);
        fetchParcels();
      } else {
        const body = await resp.json();
        setError(body.error || "Failed to update package status.");
      }
    } catch (err) {
      setError("Backend status update error.");
    } finally {
      setUpdateLoading(false);
    }
  };

  const filteredParcels = parcels.filter((p) => {
    const matchesSearch =
      p.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
      p.sender_name.toLowerCase().includes(search.toLowerCase()) ||
      p.receiver_name.toLowerCase().includes(search.toLowerCase())||
      p.current_location.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6" id="admin-parcels-card">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Parcels Logistics Hub</h3>
          <p className="text-xs text-gray-500">Track shipments, dispatch scans, update checkpoints, and resolve exceptions</p>
        </div>
        <button
          onClick={fetchParcels}
          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded transition bg-white border border-gray-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Synchronize Ledger
        </button>
      </div>

      {success && (
        <div className="p-3 mb-4 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-100">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      {/* Search and filter toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#660099] focus:border-[#660099] text-sm"
            placeholder="Search by tracing number, sender, receiver, or active facility..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <select
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#660099] focus:border-[#660099] text-sm bg-white font-medium text-gray-700"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Shipping States</option>
            {statusesList.map((st) => (
              <option key={st} value={st}>
                {st.replace("_", " ").toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Parcels Grid Table */}
      <div className="overflow-x-auto border border-gray-100 rounded-lg">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-[#660099] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-400">Loading package catalogs...</p>
          </div>
        ) : filteredParcels.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm italic">
            No active shipments match your search filters.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-500 border-collapse">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th colSpan={1} className="px-6 py-4 font-bold">Tracking Number</th>
                <th colSpan={1} className="px-6 py-4 font-bold">Sender / Receiver</th>
                <th colSpan={1} className="px-6 py-4 font-bold">Weight & Cost</th>
                <th colSpan={1} className="px-6 py-4 font-bold">Facility / Status</th>
                <th colSpan={1} className="px-6 py-4 font-bold text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredParcels.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-900 font-mono tracking-tight text-sm select-all">
                      {p.tracking_number}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Booked: {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-800 text-xs">Fr: {p.sender_name}</p>
                    <p className="text-gray-600 text-xs mt-0.5">To: {p.receiver_name}</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-1 truncate max-w-[180px]">
                      {p.receiver_address}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-800 font-medium">{p.weight} kg</p>
                    <p className="text-xs text-emerald-700 font-bold font-mono mt-0.5">
                      ${p.shipping_cost.toFixed(2)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-800 font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#FF6600]" />
                      {p.current_location}
                    </span>
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-black mt-1 ${
                      p.status === "delivered"
                        ? "bg-green-100 text-green-700"
                        : p.status === "exception"
                        ? "bg-red-100 text-red-700"
                        : "bg-purple-100 text-[#660099]"
                    }`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => openUpdateModal(p)}
                      className="bg-[#660099] hover:bg-[#4B0082] text-white text-xs font-bold px-3 py-1.5 rounded transition shadow-sm"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Scanning Overlay Drawer/Modal */}
      {selectedParcel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200" id="admin-parcel-modal">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Checkpoint Scan Panel</span>
                <h4 className="text-lg font-bold text-gray-800 font-mono mt-0.5">{selectedParcel.tracking_number}</h4>
              </div>
              <button
                onClick={() => setSelectedParcel(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Optional Custom Event description annotation */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Scan Milestone Log / Comments</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#660099] text-sm"
                  placeholder="e.g. Cleared customs sorting terminal"
                  value={scanDescription}
                  onChange={(e) => setScanDescription(e.target.value)}
                />
              </div>

              {/* Action columns split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Location Box triggers /location API */}
                <div className="border border-orange-100 bg-orange-50/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-1 text-xs font-bold text-orange-800">
                    <MapPin className="w-4 h-4 text-[#FF6600]" />
                    Facility Hub Scans
                  </div>
                  <select
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs focus:ring-1 focus:ring-[#FF6600] bg-white font-medium"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                  >
                    {locationsList.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleUpdateLocation}
                    disabled={updateLoading}
                    className="w-full bg-[#FF6600] hover:bg-orange-700 text-white font-semibold text-xs py-2 rounded transition"
                  >
                    Scan & Update Location
                  </button>
                </div>

                {/* Status Box triggers /status API */}
                <div className="border border-purple-100 bg-purple-50/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-1 text-xs font-bold text-[#660099]">
                    <Layers className="w-4 h-4 text-[#660099]" />
                    Manual Status Force
                  </div>
                  <select
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs focus:ring-1 focus:ring-[#660099] bg-white font-medium"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {statusesList.map((st) => (
                      <option key={st} value={st}>{st.replace("_", " ").toUpperCase()}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updateLoading}
                    className="w-full bg-[#660099] hover:bg-purple-800 text-white font-semibold text-xs py-2 rounded transition"
                  >
                    Force State Override
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2 text-[11px] text-amber-800 leading-normal">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                   <strong>Location Scan Auto-status:</strong> Scanning "Destination Facility" marks parcel as <strong>delivered</strong>. "Singapore Hub" transitions status to <strong>in_transit</strong>.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
