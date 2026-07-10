'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-red-500">500</p>
        <p className="mt-4 text-gray-600">Algo salió mal</p>
        <button onClick={reset} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    </div>
  );
}
