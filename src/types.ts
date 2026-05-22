export interface User {
  id: number;
  fullname: string;
  email: string;
  phone: string;
  company: string;
  role: "user" | "admin";
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Parcel {
  id: number;
  tracking_number: string;
  user_id: number;
  sender_name: string;
  receiver_name: string;
  receiver_address: string;
  receiver_phone: string;
  weight: number;
  dimensions: string;
  status: "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
  current_location: string;
  estimated_delivery: string;
  shipping_cost: number;
  created_at: string;
}

export interface TrackingHistory {
  id: number;
  tracking_number: string;
  status: string;
  location: string;
  description: string;
  timestamp: string;
}

export interface ChatMessage {
  id: number;
  user_id: number;
  admin_id: number | null;
  message: string;
  sender_type: "user" | "admin";
  is_read: boolean | number;
  created_at: string;
}

export interface ChatSession {
  userId: number;
  fullname: string;
  email: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
}
