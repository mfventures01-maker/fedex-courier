import { useState, useEffect } from "react";
import { User } from "../types";
import { Search, UserCheck, UserX, Trash2, Edit3, Save, X, Building, Phone } from "lucide-react";

interface AdminUsersProps {
  token: string;
}

export default function AdminUsers({ token }: AdminUsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editing state controls
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editFullname, setEditFullname] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        // Keep only roles of "user" for normal user management
        setUsers(data.filter((u: User) => u.role === "user"));
      } else {
        setError("Failed to fetch registered clients.");
      }
    } catch (err) {
      setError("Error connecting to admin APIs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const resp = await fetch(`/api/admin/users/${id}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setSuccess("Client approved successfully!");
        fetchUsers();
      }
    } catch (err) {
      setError("Approval endpoint issue.");
    }
  };

  const handleReject = async (id: number) => {
    try {
      const resp = await fetch(`/api/admin/users/${id}/reject`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setSuccess("Client rejected.");
        fetchUsers();
      }
    } catch (err) {
      setError("Rejection error.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you absolutely sure you want to delete this user? All their corresponding shipments will be destroyed!")) return;
    try {
      const resp = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setSuccess("Client deleted successfully.");
        fetchUsers();
      }
    } catch (err) {
      setError("Delete endpoint failure.");
    }
  };

  const startEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditFullname(user.fullname);
    setEditPhone(user.phone);
    setEditCompany(user.company);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
  };

  const handleSaveEdit = async (id: number) => {
    try {
      // In this setup, we can register client edits relative to an admin's query. Let's do a simple mock SQL query to overwrite properties
      // Actually, we can update details seamlessly by adding an API route or reusing users attributes.
      // Let's create user edit endpoint directly inside server.ts or let's create a server route. Wait!
      // Let's look at if we can just update user details.
      // Wait, let's create a PUT edit route inside server.ts to make sure edits persist perfectly!
      // We'll write the PUT user update endpoint. That is perfect!
      // Let's see: we should check if our server handles edits. Let's add it or write a simple route.
      // Let's invoke a PUT /api/admin/users/:id update request.

      const resp = await fetch(`/api/admin/users/${id}/edit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullname: editFullname,
          phone: editPhone,
          company: editCompany
        })
      });

      if (resp.ok) {
        setSuccess("Client details updated successfully!");
        setEditingUserId(null);
        fetchUsers();
      } else {
        const body = await resp.json();
        setError(body.error || "Failed to update details.");
      }
    } catch (err) {
      setError("Edit endpoint issue.");
    }
  };

  // Filter clients
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullname.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.company.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || u.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6" id="admin-users-card">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Manage Registered Clients</h3>
          <p className="text-xs text-gray-500">Monitor registrations, approve client access and update profile details</p>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded text-xs text-[#660099] font-bold">
          Active Clients: {users.length}
        </div>
      </div>

      {success && (
        <div className="p-3 mb-4 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-100 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-green-900 hover:text-green-700">×</button>
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-900 hover:text-red-700">×</button>
        </div>
      )}

      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#660099] focus:border-[#660099] text-sm"
            placeholder="Search by name, email, or company name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#660099] focus:border-[#660099] text-sm bg-white font-medium text-gray-700"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Approval States</option>
            <option value="approved">Approved Accounts</option>
            <option value="pending">Pending Sign-ups</option>
            <option value="rejected">Rejected Accounts</option>
          </select>
          <button
            onClick={fetchUsers}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 rounded-lg transition-colors border border-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Users table */}
      <div className="overflow-x-auto border border-gray-100 rounded-lg">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-[#660099] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-400">Fetching clients profiles...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm italic">
            No registered users match your search parameters.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-500 border-collapse">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th colSpan={1} className="px-6 py-4 font-bold">Client Name / Org</th>
                <th colSpan={1} className="px-6 py-4 font-bold">Contact Details</th>
                <th colSpan={1} className="px-6 py-4 font-bold">Approval Status</th>
                <th colSpan={1} className="px-6 py-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                const isEditing = editingUserId === u.id;

                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Name column */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="space-y-2 max-w-xs">
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                            value={editFullname}
                            onChange={(e) => setEditFullname(e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Company Name"
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                            value={editCompany}
                            onChange={(e) => setEditCompany(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-bold text-gray-900">{u.fullname}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                            <Building className="w-3.5 h-3.5 text-[#660099]" />
                            {u.company || "Personal Client"}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Contact details */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="max-w-xs">
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-700 select-all">{u.email}</p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {u.phone}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Status badges */}
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        u.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : u.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700 animate-pulse"
                      }`}>
                        {u.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Joined: {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </td>

                    {/* Action Panel Buttons */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(u.id)}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-1.5 rounded flex items-center gap-1 shadow-sm transition-colors"
                              title="Save Changes"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold p-1.5 rounded flex items-center gap-1 transition-colors"
                              title="Cancel Edit"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {u.status !== "approved" && (
                              <button
                                onClick={() => handleApprove(u.id)}
                                className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-bold p-1.5 rounded transition-transform active:scale-95"
                                title="Approve Client Account"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}

                            {u.status !== "rejected" && (
                              <button
                                onClick={() => handleReject(u.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold p-1.5 rounded transition-transform active:scale-95"
                                title="Reject Client Account"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => startEdit(u)}
                              className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold p-1.5 rounded transition"
                              title="Edit Client Profile"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(u.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold p-1.5 rounded transition-transform active:scale-95"
                              title="Delete Client Data"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
