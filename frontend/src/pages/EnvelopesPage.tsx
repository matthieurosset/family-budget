import { useEnvelopes } from "../lib/hooks";
import { formatCHF } from "../lib/utils";

export function EnvelopesPage() {
  const { data: envelopes, isLoading } = useEnvelopes();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Enveloppes annuelles</h1>
      <p className="mt-1 text-sm text-gray-500">
        Suivi des provisions pour les depenses annuelles
      </p>

      {isLoading ? (
        <p className="mt-8 text-gray-400">Chargement...</p>
      ) : envelopes && envelopes.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {envelopes.map((env) => {
            const balance = parseFloat(env.balance);
            return (
              <div key={env.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900">{env.name}</h3>
                <p className="mt-1 text-xs text-gray-500">{formatCHF(env.monthly_amount)} / mois</p>
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provisions</span>
                    <span className="text-emerald-600">{formatCHF(env.total_provisions)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Depenses</span>
                    <span className="text-red-600">{formatCHF(env.total_expenses)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-medium">
                    <span>Solde</span>
                    <span className={balance >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCHF(env.balance)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 text-center text-sm text-gray-400">
          Aucune enveloppe configuree.
        </div>
      )}
    </div>
  );
}
