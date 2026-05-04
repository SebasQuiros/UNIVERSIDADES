export default function EstudianteLoading() {
  return (
    <div className="flex-1 p-4 lg:p-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded-xl mb-2" />
      <div className="h-4 w-40 bg-gray-100 rounded-lg mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl border border-gray-200" />
        ))}
      </div>
    </div>
  );
}
