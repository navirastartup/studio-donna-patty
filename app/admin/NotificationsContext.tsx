"use client";

import { createContext, useContext, useState } from "react";

export type Notification = {
  id: string;
  type: "agendamento" | "estoque" | "alerta";
  message: string;
  date: string;
  read?: boolean; // 👈 ADICIONADO
};

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notif: Notification) => void;
  clearNotifications: () => void;
  markAllAsRead: () => void; // 👈 ADICIONADO
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

const addNotification = (notif: Notification) => {
  setNotifications((prev) => {
    // Se já existe uma notificação com esse ID, não adiciona de novo
    if (prev.some((n) => n.id === notif.id)) return prev;

    return [...prev, { ...notif, read: false }];
  });
};


  const clearNotifications = () => {
    setNotifications([]);
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length, // 👈 conta só não-lidas
        addNotification,
        clearNotifications,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
