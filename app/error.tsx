'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white rounded-3xl shadow-xl p-12 max-w-md text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={32} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Etwas ist schiefgelaufen!</h2>
                <p className="text-gray-500 font-medium mb-8">
                    Ein unerwarteter Fehler ist aufgetreten. Wir wurden benachrichtigt.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => reset()}
                        className="w-full bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCcw size={18} />
                        Erneut versuchen
                    </button>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-bold transition-all"
                    >
                        Zurück zum Dashboard
                    </button>
                </div>
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-8 p-4 bg-red-50 rounded-xl text-left overflow-auto max-h-40">
                        <p className="text-xs font-mono text-red-800 break-all">{error.message}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
