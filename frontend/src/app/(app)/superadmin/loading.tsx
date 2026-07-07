export default function SuperAdminLoading() {
  return (
    <div className="flex-1 p-6 lg:p-8 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 w-52 bg-gray-200 rounded-xl mb-2" />
        <div className="h-4 w-64 bg-gray-100 rounded-lg" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl border border-gray-200" />
        ))}
      </div>

      {/* Paneles / gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-gray-100 rounded-2xl border border-gray-200" />
        <div className="h-72 bg-gray-100 rounded-2xl border border-gray-200" />
      </div>
    </div>
  );
}
