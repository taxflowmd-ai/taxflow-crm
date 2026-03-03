'use client'
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#002e25] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="font-serif text-4xl text-white mb-2">TaxFlow</div>
        <div className="text-white/40 text-xs uppercase tracking-widest mb-8">CRM</div>
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📡</span>
        </div>
        <h1 className="text-white text-xl font-semibold mb-2">Fără conexiune</h1>
        <p className="text-white/50 text-sm max-w-xs mx-auto mb-8">
          Nu există conexiune la internet. Verifică rețeaua și încearcă din nou.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[#00c48c] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#00a876] transition-colors">
          Încearcă din nou
        </button>
      </div>
    </div>
  )
}
