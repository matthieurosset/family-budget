import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Wallet, Upload, Link2, Tag } from "lucide-react";
import { useEnvelopes } from "../lib/hooks";
import { formatCHF } from "../lib/utils";
import { api } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";

export function EnvelopesPage() {
  const { data: envelopes, isLoading } = useEnvelopes();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  const handleImportExcel = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", "2026");
      const res = await api.post("/envelopes/import-excel", formData);
      setImportResult(`${res.data.envelopes_created} enveloppes importées`);
      qc.invalidateQueries({ queryKey: ["envelopes"] });
    } catch (e: unknown) {
      setImportResult(`Erreur: ${(e as Error).message}`);
    }
    setImporting(false);
  };

  const handleLinkExpenses = async () => {
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await api.post("/envelopes/link-expenses");
      setLinkResult(`${res.data.linked} dépenses liées aux enveloppes`);
      qc.invalidateQueries({ queryKey: ["envelopes"] });
    } catch (e: unknown) {
      setLinkResult(`Erreur: ${(e as Error).message}`);
    }
    setLinking(false);
  };

  const totalProvisions = envelopes?.reduce((s, e) => s + parseFloat(e.total_provisions), 0) ?? 0;
  const totalExpenses = envelopes?.reduce((s, e) => s + parseFloat(e.total_expenses), 0) ?? 0;
  const totalBalance = envelopes?.reduce((s, e) => s + parseFloat(e.balance), 0) ?? 0;
  const totalMonthly = envelopes?.reduce((s, e) => s + parseFloat(e.monthly_amount), 0) ?? 0;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Provisions annuelles</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Enveloppes</h1>
      <p className="mt-2 text-[13px] text-sand-500">
        Suivi des provisions mensuelles pour vos dépenses annuelles
      </p>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx" onChange={handleImportExcel} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[12px] font-medium text-sand-600 transition-colors hover:bg-sand-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {importing ? "Import..." : "Importer Excel"}
        </button>
        <button
          onClick={handleLinkExpenses}
          disabled={linking}
          className="flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[12px] font-medium text-sand-600 transition-colors hover:bg-sand-50"
        >
          <Link2 className="h-3.5 w-3.5" />
          {linking ? "Liaison..." : "Lier les dépenses"}
        </button>
        {(importResult || linkResult) && (
          <span className="text-[12px] text-forest-600">{importResult || linkResult}</span>
        )}
      </div>

      {/* Totals */}
      {envelopes && envelopes.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Mensuel total", value: totalMonthly, color: "text-dusk-600" },
            { label: "Provisions cumulées", value: totalProvisions, color: "text-forest-600" },
            { label: "Dépenses", value: totalExpenses, color: "text-ember-600" },
            { label: "Solde", value: totalBalance, color: totalBalance >= 0 ? "text-forest-600" : "text-ember-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-sand-200/60 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-400">{label}</p>
              <p className={`mt-1 font-display text-xl ${color}`}>{formatCHF(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Envelope cards */}
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
                transition={{ delay: i * 0.03 }}
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

                {/* Category link */}
                {env.category_name && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-sand-300" />
                    <span className="rounded-md bg-forest-50 px-1.5 py-0.5 text-[10px] font-semibold text-forest-700">
                      {env.category_name}
                    </span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sand-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, delay: 0.2 + i * 0.03, ease: "easeOut" }}
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-sand-200" strokeWidth={1.2} />
          <p className="mt-3 text-[13px] text-sand-400">Aucune enveloppe configurée</p>
          <p className="mt-1 text-[11px] text-sand-300">Importez votre fichier Excel pour commencer</p>
        </motion.div>
      )}
    </div>
  );
}
