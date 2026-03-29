import { useState } from "react";
import { FileUp, Check, AlertCircle } from "lucide-react";
import { useUploadImport, useApplyRules } from "../lib/hooks";
import { currentMonth } from "../lib/utils";
import type { ImportResponse } from "../lib/types";

export function ImportPage() {
  const [month, setMonth] = useState(currentMonth());
  const [files, setFiles] = useState<FileList | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const upload = useUploadImport();
  const applyRules = useApplyRules();

  const handleUpload = () => {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    formData.append("month", month);
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    upload.mutate(formData, {
      onSuccess: (data) => setResult(data),
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Import</h1>
      <p className="mt-1 text-sm text-gray-500">
        Uploadez vos fichiers camt.053 (XML) et/ou Viseca (PDF)
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mois</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fichiers</label>
            <input
              type="file"
              multiple
              accept=".xml,.pdf"
              onChange={(e) => setFiles(e.target.files)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-sm file:text-emerald-700"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!files || files.length === 0 || upload.isPending}
          className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" />
          {upload.isPending ? "Import en cours..." : "Importer"}
        </button>

        {upload.isError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            Erreur: {String((upload.error as Error)?.message || "Erreur inconnue")}
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <Check className="h-4 w-4" />
              Import reussi : {result.transactions_created} transactions creees
            </div>
            {result.reconciliation && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                Reconciliation CC : {(result.reconciliation as Record<string, unknown>).cc_transactions} transactions liees
              </div>
            )}

            <button
              onClick={() => applyRules.mutate()}
              disabled={applyRules.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {applyRules.isPending ? "Categorisation..." : "Appliquer les regles de categorisation"}
            </button>

            {applyRules.isSuccess && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                Categorisation : {(applyRules.data as Record<string, number>).categorized} transactions categorisees,{" "}
                {(applyRules.data as Record<string, number>).remaining} restantes
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
