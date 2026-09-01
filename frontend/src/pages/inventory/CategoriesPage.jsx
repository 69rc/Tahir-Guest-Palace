import { useEffect, useState } from 'react';
import { Tags, Plus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/categories');
      setCategories(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/categories', { name });
      toast.success('Category created');
      setOpen(false);
      setName('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = categories.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Inventory</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Kinds</h1>
          <p className="text-sm text-ink-500 mt-1">Groups for store items — rice, drinks, cleaning.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Add kind</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" className="max-w-sm" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No categories" message="Create categories to organize your inventory." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4 rounded-xl border border-ink-100">
                <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><Tags size={18} /></div>
                <p className="font-semibold text-ink-800 flex-1 min-w-0 truncate">{c.name}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Category">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Proteins" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
