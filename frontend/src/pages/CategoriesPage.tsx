import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useCategories, useCreateCategory, useDeleteCategory } from "../lib/hooks";
import type { Category } from "../lib/types";

function AddCategoryForm({ parentId, onClose }: { parentId: number | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const create = useCreateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), parent_id: parentId }, { onSuccess: () => { setName(""); onClose(); } });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder={parentId ? "Nouvelle sous-catégorie..." : "Nouveau groupe..."}
        className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[12px] text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:outline-none" />
      <button type="submit" disabled={!name.trim() || create.isPending}
        className="rounded-lg bg-forest-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-700 disabled:opacity-50">Ajouter</button>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function CategoryGroup({ group }: { group: Category }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const deleteCategory = useDeleteCategory();

  return (
    <li>
      <div className="group flex items-center gap-1">
        <button onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2.5 rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-sand-100">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-sand-400" /> : <ChevronRight className="h-3.5 w-3.5 text-sand-400" />}
          <span className="text-[13px] font-semibold text-sand-800">{group.name}</span>
          <span className="rounded-md bg-sand-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">{group.children.length}</span>
        </button>
        <button onClick={() => setAdding(true)}
          className="rounded-lg p-1.5 text-sand-300 opacity-0 transition-all hover:bg-sand-100 hover:text-forest-600 group-hover:opacity-100" title="Ajouter">
          <Plus className="h-3.5 w-3.5" />
        </button>
        {group.children.length === 0 && (
          <button onClick={() => deleteCategory.mutate(group.id)}
            className="rounded-lg p-1.5 text-sand-300 opacity-0 transition-all hover:bg-ember-50 hover:text-ember-600 group-hover:opacity-100" title="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (group.children.length > 0 || adding) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="ml-5 overflow-hidden border-l-2 border-sand-100 pl-4">
            <ul className="space-y-0.5">
              {group.children.map((cat) => (
                <li key={cat.id} className="group/item flex items-center gap-2 rounded-lg py-1.5 pr-1 text-[12px] text-sand-600">
                  <span className="h-1 w-1 rounded-full bg-sand-300" />
                  <span className="flex-1">{cat.name}</span>
                  {cat.month_shift_days != null && (
                    <span className="rounded-md bg-dusk-100 px-1.5 py-0.5 text-[10px] font-semibold text-dusk-600">J+{cat.month_shift_days}</span>
                  )}
                  <button onClick={() => deleteCategory.mutate(cat.id)}
                    className="rounded-lg p-1 text-sand-300 opacity-0 transition-all hover:bg-ember-50 hover:text-ember-600 group-hover/item:opacity-100" title="Supprimer">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
            {adding && <AddCategoryForm parentId={group.id} onClose={() => setAdding(false)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const [addingGroup, setAddingGroup] = useState(false);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Configuration</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Catégories</h1>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="mt-6 rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Arbre des catégories</h2>
            {categories && (
              <span className="rounded-md bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">
                {categories.reduce((sum, g) => sum + g.children.length, 0)}
              </span>
            )}
          </div>
          <button onClick={() => setAddingGroup(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-forest-600 transition-colors hover:bg-forest-50">
            <Plus className="h-3.5 w-3.5" /> Groupe
          </button>
        </div>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
          </div>
        ) : categories && categories.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {categories.map((group) => <CategoryGroup key={group.id} group={group} />)}
            {addingGroup && <li><AddCategoryForm parentId={null} onClose={() => setAddingGroup(false)} /></li>}
          </ul>
        ) : (
          <div className="mt-4">
            <div className="flex h-24 items-center justify-center text-[13px] text-sand-300">
              Lancez la migration Actual Budget dans Paramètres
            </div>
            {addingGroup && <AddCategoryForm parentId={null} onClose={() => setAddingGroup(false)} />}
          </div>
        )}
      </motion.div>
    </div>
  );
}
