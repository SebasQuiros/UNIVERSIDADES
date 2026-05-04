export default function AdminLoading() {
  return (
    <div className="flex-1 p-6 lg:p-8 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-xl mb-2" />
      <div className="h-4 w-32 bg-gray-100 rounded-lg mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl border border-gray-200" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-2xl border border-gray-200" />
    </div>
  );
}
