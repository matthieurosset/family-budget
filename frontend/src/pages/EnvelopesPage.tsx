import { motion } from "motion/react";
import { Wallet } from "lucide-react";
import { useEnvelopes } from "../lib/hooks";
import { formatCHF } from "../lib/utils";

export function EnvelopesPage() {
  const { data: envelopes, isLoading } = useEnvelopes();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Provisions annuelles</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Enveloppes</h1>
      <p className="mt-2 text-[13px] text-sand-500">
        Suivi des provisions mensuelles pour vos dépenses annuelles (assurances, taxes, etc.)
      </p>

      {isLoading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
        </div>
      ) : envelopes && envelopes.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {envelopes.map((env, i) => {
            const balance = parseFloat(env.balance);
            const provisions = parseFloat(env.total_provisions);
            const expenses = parseFloat(env.total_expenses);
            const progress = provisions > 0 ? Math.min((expenses / provisions) * 100, 100) : 0;

            return (
              <motion.div
                key={env.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-sand-800">{env.name}</h3>
                    <p className="mt-0.5 text-[11px] text-sand-400">
                      {formatCHF(env.monthly_amount)} / mois
                    </p>
                  </div>
                  <div className="rounded-lg bg-sand-50 p-2">
                    <Wallet className="h-4 w-4 text-sand-400" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sand-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: "easeOut" }}
                    className={`h-full rounded-full ${progress > 80 ? "bg-ember-400" : "bg-forest-400"}`}
                  />
                </div>

                <div className="mt-4 space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-sand-400">Provisions</span>
                    <span className="font-medium text-forest-600">{formatCHF(env.total_provisions)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-400">Dépenses</span>
                    <span className="font-medium text-ember-600">{formatCHF(env.total_expenses)}</span>
                  </div>
                  <div className="flex justify-between border-t border-sand-100 pt-2">
                    <span className="font-semibold text-sand-700">Solde</span>
                    <span className={`font-display text-lg leading-none ${balance >= 0 ? "text-forest-600" : "text-ember-600"}`}>
                      {formatCHF(env.balance)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-12 text-center"
        >
          <Wallet className="mx-auto h-10 w-10 text-sand-200" strokeWidth={1.2} />
          <p className="mt-3 text-[13px] text-sand-400">Aucune enveloppe configurée</p>
          <p className="mt-1 text-[11px] text-sand-300">Créez-en depuis les paramètres ou l'API</p>
        </motion.div>
      )}
    </div>
  );
}
