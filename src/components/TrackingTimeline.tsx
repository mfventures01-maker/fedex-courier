import { Parcel, TrackingHistory } from "../types";
import { Package, Truck, CheckCircle, MapPin, AlertCircle, Calendar, ShieldAlert } from "lucide-react";

interface TrackingTimelineProps {
  parcel: Parcel;
  timeline: TrackingHistory[];
}

export default function TrackingTimeline({ parcel, timeline }: TrackingTimelineProps) {
  const steps = [
    { key: "pending", label: "Label Created", icon: Package },
    { key: "picked_up", label: "Picked Up", icon: MapPin },
    { key: "in_transit", label: "In Transit", icon: Truck },
    { key: "out_for_delivery", label: "Out For Delivery", icon: Truck },
    { key: "delivered", label: "Delivered", icon: CheckCircle },
  ];

  // Helper to determine active step indexes
  const getActiveIndex = (status: string) => {
    if (status === "exception") return -1;
    const index = steps.findIndex((s) => s.key === status);
    return index !== -1 ? index : 2; // Default to In Transit if unknown or similar
  };

  const activeIndex = getActiveIndex(parcel.status);

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden" id="tracking-timeline-card">
      {/* Visual Header */}
      <div className="bg-[#660099] text-white p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#FF6600] font-bold">FDX Tracker</span>
            <h3 className="text-2xl font-bold font-mono tracking-tight mt-1">{parcel.tracking_number}</h3>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
            <Calendar className="w-4 h-4 text-[#FF6600]" />
            <span className="text-sm font-medium">Est. Delivery: {parcel.estimated_delivery}</span>
          </div>
        </div>

        {/* Status Stepper */}
        {parcel.status === "exception" ? (
          <div className="mt-8 flex items-center gap-3 bg-red-500/20 text-red-100 border border-red-500/30 p-4 rounded-lg">
            <ShieldAlert className="w-6 h-6 shrink-0 text-red-200" />
            <div>
              <p className="font-bold text-sm">Delivery Exception Scanned</p>
              <p className="text-xs text-red-200/80">Please contact FedEx customer support regarding this package.</p>
            </div>
          </div>
        ) : (
          <div className="mt-8 relative">
            {/* Base Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/20 -translate-y-1/2 rounded-full hidden md:block"></div>
            {/* Color Line */}
            <div
              className="absolute top-1/2 left-0 h-1 bg-[#FF6600] -translate-y-1/2 rounded-full transition-all duration-500 hidden md:block"
              style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
            ></div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
              {steps.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = idx <= activeIndex;
                const isActive = idx === activeIndex;

                return (
                  <div key={step.key} className="flex md:flex-col items-center gap-3 md:gap-2 text-left md:text-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? "bg-[#FF6600] text-white ring-4 ring-orange-200 scale-110"
                          : isCompleted
                          ? "bg-white text-[#660099]"
                          : "bg-white/20 text-white/50 border border-white/20"
                      }`}
                    >
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${isCompleted ? "text-white" : "text-white/50"}`}>
                        {step.label}
                      </p>
                      {isActive && (
                        <span className="inline-block bg-[#FF6600] text-[9px] font-bold text-white px-2 py-0.5 rounded-full mt-1 animate-pulse">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Details grid */}
      <div className="p-6 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-gray-50/50">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Location</p>
          <p className="font-semibold text-gray-800 flex items-center gap-1.5 mt-1">
            <MapPin className="w-4 h-4 text-[#FF6600]" />
            {parcel.current_location}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Weight & Dimensions</p>
          <p className="font-semibold text-gray-800 mt-1">
            {parcel.weight} kg <span className="text-gray-300">|</span> {parcel.dimensions}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Sender Name</p>
          <p className="font-semibold text-gray-700 mt-1">{parcel.sender_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Recipient Information</p>
          <p className="font-semibold text-gray-800 mt-1">{parcel.receiver_name}</p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">{parcel.receiver_address}</p>
        </div>
      </div>

      {/* Detailed Timeline List */}
      <div className="p-6">
        <h4 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#660099]" />
          Scan History & Journey Details
        </h4>

        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4">No tracking history recorded for this parcel yet.</p>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {timeline.map((event, eventIdx) => {
                const isLast = eventIdx === timeline.length - 1;
                const isNewest = eventIdx === 0;

                return (
                  <li key={event.id}>
                    <div className="relative pb-8">
                      {!isLast && (
                        <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      <div className="relative flex items-start space-x-3">
                        {/* Bullet Icon */}
                        <div className="relative">
                          <span
                            className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white ${
                              isNewest
                                ? "bg-orange-100 text-[#FF6600]"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <MapPin className="w-5 h-5" />
                          </span>
                        </div>
                        {/* Content text */}
                        <div className="min-w-0 flex-1 pt-1.5">
                          <div className="flex justify-between items-baseline gap-4">
                            <div>
                              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                {event.location}
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                  event.status === "delivered"
                                    ? "bg-green-100 text-green-700"
                                    : event.status === "exception"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-[#660099]/10 text-[#660099]"
                                }`}>
                                  {event.status}
                                </span>
                              </p>
                              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                            </div>
                            <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                              {new Date(event.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
