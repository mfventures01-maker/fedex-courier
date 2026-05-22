import { useState, useEffect } from "react";
import { ChatSession } from "../types";
import { MessageSquare, AlertCircle, Inbox, User } from "lucide-react";
import ChatComponent from "./ChatComponent";

interface AdminChatProps {
  token: string;
}

export default function AdminChat({ token }: AdminChatProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/chats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setSessions(data);

        // Keep active session selection reference synced
        if (selectedSession) {
          const fresh = data.find((s: ChatSession) => s.userId === selectedSession.userId);
          if (fresh) setSelectedSession(fresh);
        }
      } else {
        setError("Could not load support ticket listings.");
      }
    } catch (err) {
      setError("Endpoint connection failure.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    // Poll periodically to gather fresh counts, or socket acts as direct trigger
    const timer = setInterval(fetchSessions, 10000);
    return () => clearInterval(timer);
  }, []);

  const selectSession = (session: ChatSession) => {
    setSelectedSession(session);
    // Mark as read locally and refresh
    fetch(`/api/chats/${session.userId}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` }
    }).then(() => {
      fetchSessions();
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden" id="admin-chat-card">
      <div className="grid grid-cols-1 md:grid-cols-3 min-h-[520px]">
        {/* Left Side: Inbox session listings */}
        <div className="border-r border-gray-100 flex flex-col h-full bg-gray-50/50">
          <div className="p-4 border-b border-gray-100 bg-white">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              <Inbox className="w-4 h-4 text-[#660099]" />
              Support Inbox Threads
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">Select an active client to reply live</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && sessions.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#660099] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[11px] text-gray-400">Loading support inbox...</p>
              </div>
            ) : error ? (
              <div className="p-6 text-center text-xs text-red-600 font-medium">
                <AlertCircle className="w-5 h-5 mx-auto mb-1" />
                {error}
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400 italic">
                No active helpdesk conversations currently.
              </div>
            ) : (
              <div className="divide-y divide-gray-100/60">
                {sessions.map((s) => {
                  const isActive = selectedSession?.userId === s.userId;

                  return (
                    <button
                      key={s.userId}
                      onClick={() => selectSession(s)}
                      className={`w-full text-left p-4 transition-colors flex items-start gap-3 hover:bg-white ${
                        isActive ? "bg-white border-l-4 border-l-[#660099]" : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#660099]/10 text-[#660099] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-[#660099]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <p className={`text-xs truncate font-bold ${isActive ? "text-[#660099]" : "text-gray-800"}`}>
                            {s.fullname}
                          </p>
                          <span className="text-[9px] text-gray-400 shrink-0">
                            {s.lastMessageTime ? new Date(s.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{s.email}</p>
                        <p className="text-xs text-gray-600 truncate mt-2 font-medium">
                          {s.lastMessage || "Click to see transcript"}
                        </p>
                      </div>

                      {s.unreadCount > 0 && (
                        <span className="bg-[#FF6600] text-white font-mono text-[10px] font-black rounded-full px-1.5 py-0.5 shrink-0 select-none animate-pulse">
                          {s.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active chat bubbles interface */}
        <div className="col-span-1 md:col-span-2 flex flex-col h-full">
          {selectedSession ? (
            <ChatComponent
              token={token}
              userId={selectedSession.userId}
              userName={selectedSession.fullname}
              role="admin"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/10">
              <div className="p-4 bg-purple-50 rounded-full text-[#660099] mb-4">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h4 className="font-bold text-gray-700 text-base">Select Customer Room</h4>
              <p className="text-xs text-gray-400 max-w-xs mt-1">
                Pick a conversations thread from the left menu to read tickets transcripts and answer package concerns live.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
