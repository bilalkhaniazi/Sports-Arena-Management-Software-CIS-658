import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  color: string;
  btnText: string;
  onSubmit: () => void;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  color,
  btnText,
  onSubmit,
}) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    } else {
      document.removeEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ zIndex: 10000 }}
    >
      {/* Background Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-lg w-full p-6 relative transform transition-all opacity-100 scale-100 h-[600px] overflow-y-auto">
        {/* Modal Header */}
          <div className="flex justify-between items-center border-b dark:border-boxdark pb-2 ">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-600 dark:text-gray-400 hover:text-red-500"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

        {/* Modal Body */}
        <div className="mt-4 text-gray-700 dark:text-gray-300">{children}</div>

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-700"
          >
            Close
          </button>
          <button
            onClick={() => onSubmit()}
            className={`px-4 py-2 ${color} text-white rounded-md hover:opacity-70`}
          >
            {btnText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
