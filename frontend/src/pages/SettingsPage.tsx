import { useState } from "react";
import { api } from "../lib/api";

export function SettingsPage() {
  const [migrationPath, setMigrationPath] = useState("");
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  const handleMigrate = async () => {
    try {
      const res = await api.post(`/migrate/actual-budget?db_path=${encodeURIComponent(migrationPath)}`);
      setMigrationResult(JSON.stringify(res.data, null, 2));
    } catch (e: unknown) {
      setMigrationResult(`Erreur: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>

      <div className="mt-6 space-y-6">
        {/* Actual Budget Migration */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Migration Actual Budget</h2>
          <p className="mt-1 text-sm text-gray-500">
            Importer les categories et regles depuis une base Actual Budget
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Chemin vers db.sqlite"
              value={migrationPath}
              onChange={(e) => setMigrationPath(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={handleMigrate}
              disabled={!migrationPath}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Migrer
            </button>
          </div>
          {migrationResult && (
            <pre className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto">
              {migrationResult}
            </pre>
          )}
        </div>

        {/* Export/Import for Claude Code */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Workflow Claude Code</h2>
          <p className="mt-1 text-sm text-gray-500">
            Exporter les transactions non categorisees pour traitement par Claude Code
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="/api/transactions/uncategorized/export"
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Exporter CSV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
