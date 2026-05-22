import { useState } from "react";
import { Download, FileSpreadsheet, ArrowUpRight, BarChart3, Receipt } from "lucide-react";

interface AdminReportsProps {
  token: string;
}

export default function AdminReports({ token }: AdminReportsProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleDownloadCSV = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const resp = await fetch("/api/admin/reports", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fedex_parcels_logistics_report_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setSuccess(true);
      } else {
        alert("Failed to export reporting spreadsheet format.");
      }
    } catch (err) {
      console.error("CSV Download issue:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6" id="admin-reports-card">
      <div className="border-b border-gray-100 pb-5 mb-6">
        <h3 className="text-xl font-bold text-gray-800">Logistics Audit Reports</h3>
        <p className="text-xs text-gray-500 font-medium">Export real-time parcel sheets, revenue summaries, and customs statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Export Panel */}
        <div className="border border-orange-100 bg-orange-50/20 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="p-3 w-12 h-12 rounded-xl bg-orange-100 text-[#FF6600] flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-gray-800">Full Shipping Report (CSV)</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Downloads a comprehensive tabular CSV ledger that covers tracking numbers, sender emails, dimensions, current logistics coordinates, transit milestones, invoice weight values, and total freight costs.
            </p>
          </div>

          <div className="pt-6">
            <button
              onClick={handleDownloadCSV}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#660099] hover:bg-[#4B0082] text-white font-bold py-3 px-4 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate & Export Ledger
                </>
              )}
            </button>
            {success && (
              <p className="text-xs text-emerald-600 font-bold text-center mt-2">
                Download started successfully! Check your browser logs.
              </p>
            )}
          </div>
        </div>

        {/* Informational Audit Summary Widget */}
        <div className="border border-purple-100 bg-purple-50/20 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="p-3 w-12 h-12 rounded-xl bg-purple-100 text-[#660099] flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">Operational Compliance</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Exported sheets can be safely parsed inside external analytical metrics softwares such as Microsoft Excel, Google Sheets, or python pandas routines for logistics optimization pipelines.
              </p>
            </div>

            <div className="divide-y divide-purple-100/50 text-xs text-gray-600 pt-2">
              <div className="py-2 flex justify-between">
                <span>Total Billing Audit Stream</span>
                <span className="font-semibold text-[#660099] flex items-center">
                  Live DB Sync
                  <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span>Encryption Hash Scheme</span>
                <span className="font-mono text-gray-500">SHA-256 Base16</span>
              </div>
              <div className="py-2 flex justify-between">
                <span>Local Transit Coverage</span>
                <span className="font-semibold text-gray-700">Singapore Hub Network</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
