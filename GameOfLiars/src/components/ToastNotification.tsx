import React, { useEffect } from 'react';

interface ToastNotificationProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function ToastNotification({ 
  message, 
  isVisible, 
  onClose, 
  duration = 1000 
}: ToastNotificationProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-200">
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
} 