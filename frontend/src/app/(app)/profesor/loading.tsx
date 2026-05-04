export default function ProfesorLoading() {
  return (
    <div className="flex-1 p-4 lg:p-6 animate-pulse">
      <div className="h-8 w-52 bg-gray-200 rounded-xl mb-2" />
      <div className="h-4 w-36 bg-gray-100 rounded-lg mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl border border-gray-200" />
        ))}
      </div>
    </div>
  );
}
