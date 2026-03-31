import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Database, Download, ExternalLink, Check, AlertCircle, Upload } from "lucide-react";
import { api } from "../lib/api";

export function SettingsPage() {
  const [migrationFile, setMigrationFile] = useState<File | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ status: string; data?: unknown; error?: string } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMigrate = async () => {
    if (!migrationFile) return;
    setMigrating(true);
    setMigrationResult(null);
    try {
      const formData = new FormData();
      formData.append("file", migrationFile);
      const res = await api.post("/migrate/actual-budget", formData);
      setMigrationResult({ status: "success", data: res.data });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (e as Error).message;
      setMigrationResult({ status: "error", error: String(msg) });
    }
    setMigrating(false);
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Configuration</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Paramètres</h1>

      <div className="mt-6 space-y-6">
        {/* Migration */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-dusk-50 p-2.5">
              <Database className="h-5 w-5 text-dusk-500" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-sand-800">Migration Actual Budget</h2>
              <p className="text-[12px] text-sand-400">
                Importer les catégories et règles depuis votre base Actual Budget
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sqlite,.db"
              onChange={(e) => setMigrationFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-600 transition-colors hover:bg-sand-100"
            >
              <Upload className="h-4 w-4" />
              {migrationFile ? migrationFile.name : "Choisir db.sqlite"}
            </button>
            <button
              onClick={handleMigrate}
              disabled={!migrationFile || migrating}
              className="rounded-xl bg-dusk-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-dusk-600/20 transition-all hover:bg-dusk-700 disabled:opacity-50"
            >
              {migrating ? "Migration..." : "Migrer"}
            </button>
          </div>

          {migrationResult && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 flex items-start gap-3 rounded-xl p-4 text-[12px] ${
                migrationResult.status === "success"
                  ? "bg-forest-50 text-forest-700"
                  : "bg-ember-50 text-ember-700"
              }`}
            >
              {migrationResult.status === "success" ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
                {migrationResult.data ? JSON.stringify(migrationResult.data, null, 2) : migrationResult.error}
              </pre>
            </motion.div>
          )}
        </motion.div>

        {/* Claude Code workflow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-forest-50 p-2.5">
              <Download className="h-5 w-5 text-forest-500" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-sand-800">Workflow Claude Code</h2>
              <p className="text-[12px] text-sand-400">
                Exporter les transactions non catégorisées pour traitement batch
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-sand-50 p-4">
            <ol className="space-y-2 text-[12px] text-sand-600">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand-200 text-[10px] font-bold text-sand-600">1</span>
                Exportez le fichier Excel des transactions non catégorisées
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand-200 text-[10px] font-bold text-sand-600">2</span>
                Donnez-le à Claude : « Catégorise ces transactions avec les catégories de l'onglet Catégories »
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand-200 text-[10px] font-bold text-sand-600">3</span>
                Réimportez le fichier Excel complété
              </li>
            </ol>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/transactions/uncategorized/export"
              className="inline-flex items-center gap-2 rounded-xl bg-sand-900 px-5 py-2.5 text-[13px] font-semibold text-sand-50 shadow-lg shadow-sand-900/20 transition-all hover:bg-sand-800"
            >
              <Download className="h-4 w-4" />
              Exporter (Excel)
            </a>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sand-200 bg-white px-5 py-2.5 text-[13px] font-medium text-sand-700 transition-colors hover:bg-sand-50">
              <Upload className="h-4 w-4" />
              Réimporter (Excel)
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await api.post("/transactions/uncategorized/import", formData);
                    setMigrationResult({ status: "success", data: res.data });
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (err as Error).message;
                    setMigrationResult({ status: "error", error: String(msg) });
                  }
                }}
              />
            </label>
          </div>
        </motion.div>

        {/* API docs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sand-100 p-2.5">
              <ExternalLink className="h-5 w-5 text-sand-500" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-sand-800">Documentation API</h2>
              <p className="text-[12px] text-sand-400">
                Swagger UI pour explorer et tester tous les endpoints
              </p>
            </div>
          </div>
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-dusk-600 transition-colors hover:text-dusk-700"
          >
            Ouvrir la documentation API
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
