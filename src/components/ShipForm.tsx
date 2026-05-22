import React, { useState } from "react";
import { DollarSign, Package, Shield, Calculator, Send } from "lucide-react";

interface ShipFormProps {
  token: string;
  onShipmentSuccess: (trackingNumber: string) => void;
}

export default function ShipForm({ token, onShipmentSuccess }: ShipFormProps) {
  const [receiverName, setReceiverName] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [weight, setWeight] = useState<number>(1);
  const [dimensions, setDimensions] = useState("30x20x15 cm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const estimatedCost = Number(weight || 0) * 5 + 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverName || !receiverAddress || !receiverPhone || !weight || !dimensions) {
      setError("Please fill in all requested fields correctly.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/user/ship", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver_name: receiverName,
          receiver_address: receiverAddress,
          receiver_phone: receiverPhone,
          weight,
          dimensions
        })
      });

      const body = await resp.json();
      if (!resp.ok) {
        throw new Error(body.error || "Failed to process shipment creation.");
      }

      // Reset
      setReceiverName("");
      setReceiverAddress("");
      setReceiverPhone("");
      setWeight(1);
      setDimensions("30x20x15 cm");

      onShipmentSuccess(body.trackingNumber);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6" id="shipment-form-card">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
        <div className="p-2.5 rounded-lg bg-orange-100 text-[#FF6600]">
          <Package className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">Dispatch New Shipment</h3>
          <p className="text-xs text-gray-500">Register package details to instantly schedule FedEx collection</p>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-6 block bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Receiver Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recipient Details</h4>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Receiver Name *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#660099]/20 focus:border-[#660099] text-sm"
                placeholder="e.g. Sarah Connor"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Receiver Contact Phone *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#660099]/20 focus:border-[#660099] text-sm"
                placeholder="e.g. +65 9182 7364"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Receiver Delivery Address *</label>
              <textarea
                required
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#660099]/20 focus:border-[#660099] text-sm resize-none"
                placeholder="Enter complete block, street, postal code, Singapore"
                value={receiverAddress}
                onChange={(e) => setReceiverAddress(e.target.value)}
              ></textarea>
            </div>
          </div>

          {/* Package Info & Live Cost Calculator */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Package Specifications</h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    required
                    min={0.1}
                    step={0.1}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#660099]/20 focus:border-[#660099] text-sm"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Dimensions (LxWxH cm) *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#660099]/20 focus:border-[#660099] text-sm"
                    placeholder="e.g. 30x20x15 cm"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                  />
                </div>
              </div>

              {/* Instant Fee Calculation Quote Box */}
              <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-orange-800 font-semibold border-b border-orange-100/50 pb-2">
                  <span className="flex items-center gap-1">
                    <Calculator className="w-4 h-4 text-[#FF6600]" />
                    Shipping Cost Calculator
                  </span>
                  <span>Fare Formula: $5/kg + $10 base</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <div>
                    <span className="block text-xs text-gray-500">Total Estimation Quote:</span>
                    <span className="text-2xl font-black text-gray-950 font-mono">${estimatedCost.toFixed(2)}</span>
                  </div>
                  <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded">
                    Includes Fuel Surcharge
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-start gap-2 text-xs text-gray-400 mb-4">
                <Shield className="w-4 h-4 shrink-0 text-[#660099]" />
                <span>By shipping, you agree that package items conform to Singapore Customs transport rules.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#660099] hover:bg-[#4B0082] text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-sm disabled:bg-[#660099]/50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Book & Generate Tracking
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
