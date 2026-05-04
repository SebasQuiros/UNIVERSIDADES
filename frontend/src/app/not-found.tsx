'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-blue-600">404</p>
        <p className="mt-4 text-gray-600">Página no encontrada</p>
        <Link href="/" className="mt-6 inline-block px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
