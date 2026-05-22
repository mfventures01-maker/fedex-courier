import React, { useState, useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { MessageSquare, Send, Check, User, ShieldCheck } from "lucide-react";
import { ChatMessage } from "../types";

interface ChatComponentProps {
  token: string;
  userId: number;
  userName: string;
  role: "user" | "admin";
}

export default function ChatComponent({ token, userId, userName, role }: ChatComponentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Chat History
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`/api/chats/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to load conversation history:", err);
    } finally {
      setLoading(false);
    }
  };

  // Mark conversation messages as read
  const markAsRead = async () => {
    try {
      await fetch(`/api/chats/${userId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
    markAsRead();

    // 2. Establish Socket.io connection
    const socket = io({
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.emit("join", { userId, role });
    socket.emit("join-chat", { userId });

    socket.on("new-chat-message", (msg: ChatMessage) => {
      // Avoid duplicate appending if triggered both API write and socket broadcast
      setMessages((prev) => {
        const exists = prev.some((p) => p.id === msg.id || (p.created_at === msg.created_at && p.message === msg.message));
        if (exists) return prev;
        return [...prev, msg];
      });
      markAsRead();
    });

    socket.on("typing", (data: { userId: number; isTyping: boolean; senderType: string }) => {
      if (data.userId === userId && data.senderType !== role) {
        setRemoteIsTyping(data.isTyping);
      }
    });

    return () => {
      socket.off("new-chat-message");
      socket.off("typing");
      socket.disconnect();
    };
  }, [userId]);

  // Scroll to bottom helper
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, remoteIsTyping]);

  // Handle keypress & emit typing indicators
  const handleInputChange = (val: string) => {
    setNewMessage(val);

    const socket = socketRef.current;
    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { userId, isTyping: true, senderType: role });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing", { userId, isTyping: false, senderType: role });
    }, 1500);
  };

  // Submit chat message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage("");

    // Reset typing flags immediately
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("typing", { userId, isTyping: false, senderType: role });

    try {
      const resp = await fetch("/api/chats/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          message: text
        })
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        console.error("Message send failure:", errorData.error);
      }
    } catch (err) {
      console.error("Error dispatching chat message:", err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col h-[520px]" id="chat-box-interface">
      {/* Dynamic Chat Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-[#660099]/10 text-[#660099] flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5 text-[#660099]" />
          </div>
          <div>
            <h4 className="font-bold text-gray-800 text-sm">
              {role === "admin" ? `Client Connection: ${userName}` : "FedEx Customer Support"}
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Support Agent Connected
            </span>
          </div>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/20">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-7 h-7 border-2 border-[#660099] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-400">Loading conversation history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto p-4">
            <MessageSquare className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-sm font-bold text-gray-700">No Messages Yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Ask any question about customs clearances, delivery delays, or rates. Our agents typically respond in minutes.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isSelf = m.sender_type === role;
            return (
              <div key={m.id || m.created_at} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                <div className={`flex items-end gap-2 max-w-[75%] ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isSelf
                      ? "bg-orange-100 text-[#FF6600]"
                      : "bg-[#660099]/10 text-[#660099]"
                  }`}>
                    {m.sender_type === "admin" ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className={`p-3 rounded-2xl text-sm ${
                      isSelf
                        ? "bg-[#660099] text-white rounded-br-none"
                        : "bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-sm"
                    }`}>
                      <p className="leading-normal break-words">{m.message}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-[9px] text-gray-400 px-1 ${isSelf ? "justify-end" : "justify-start"}`}>
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isSelf && <Check className="w-3 h-3 text-emerald-500" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Remote typing indicator */}
        {remoteIsTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-white border border-gray-100 px-3 py-2 rounded-2xl shadow-sm text-xs text-gray-400">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </span>
              <span>FedEx partner is typing...</span>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Editor footer input */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-100 bg-white flex gap-2">
        <input
          type="text"
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#660099] focus:border-[#660099] text-sm"
          placeholder="Type message here..."
          value={newMessage}
          onChange={(e) => handleInputChange(e.target.value)}
        />
        <button
          type="submit"
          className="bg-[#660099] hover:bg-[#4B0082] text-white p-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
