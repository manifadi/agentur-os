import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info';
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    isLoading = false,
    confirmText = 'Bestätigen',
    cancelText = 'Abbrechen',
    type = 'danger'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-full shrink-0 ${type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 justify-end mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition"
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition shadow-sm flex items-center gap-2 ${type === 'danger'
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            } ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                        {isLoading && (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
