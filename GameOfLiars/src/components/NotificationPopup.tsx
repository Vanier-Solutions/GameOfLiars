import React, { useEffect } from 'react';

interface NotificationPopupProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function NotificationPopup({ 
  message, 
  isVisible, 
  onClose, 
  duration = 3000 
}: NotificationPopupProps) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4 animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Team Update
          </h3>
          <p className="text-gray-600 mb-4">
            {message}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
} 