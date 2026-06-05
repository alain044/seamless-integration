import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Budget { id: string; category: string; limit_amount: number; spent: number; }

import { EXPENSE_CATEGORIES } from '@/lib/expenseCategories';
import { normalizeCategory } from '@/lib/categoryNormalizer';
const categoriesList = EXPENSE_CATEGORIES.filter((c) => c !== 'Income') as readonly string[];

const Budgets = () => {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ category: string; monthly_budget: number; rationale: string }>>([]);
  const [newBudget, setNewBudget] = useState({ category: 'Food & Dining', limit: '' });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('budgets').select('*').order('created_at', { ascending: true });
      if (error) toast.error(error.message);
      else setBudgets((data || []) as Budget[]);
      setLoading(false);
    })();
  }, []);

  const totalBudget = budgets.reduce((s, b) => s + Number(b.limit_amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);

  const handleAdd = async () => {
    if (!newBudget.limit) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sign in required'); return; }
    const { data, error } = await supabase.from('budgets').insert({
      user_id: user.id,
      category: normalizeCategory(newBudget.category),
      limit_amount: parseFloat(newBudget.limit),
      spent: 0,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setBudgets((prev) => [...prev, data as Budget]);
    setNewBudget({ category: 'Food & Dining', limit: '' });
    setDialogOpen(false);
  };

  const fetchSuggestions = async () => {
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-budget-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'AI failed');
      setSuggestions(json.suggestions || []);
      if (!json.suggestions?.length) toast.info('Not enough history yet — log a few expenses first.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = async (s: { category: string; monthly_budget: number }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cat = normalizeCategory(s.category);
    const existing = budgets.find((b) => b.category === cat);
    if (existing) {
      const { data, error } = await supabase.from('budgets')
        .update({ limit_amount: s.monthly_budget }).eq('id', existing.id).select().single();
      if (error) { toast.error(error.message); return; }
      setBudgets((prev) => prev.map((b) => b.id === existing.id ? (data as Budget) : b));
    } else {
      const { data, error } = await supabase.from('budgets').insert({
        user_id: user.id, category: cat, limit_amount: s.monthly_budget, spent: 0,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setBudgets((prev) => [...prev, data as Budget]);
    }
    toast.success(`Applied ${cat} budget`);
    setSuggestions((prev) => prev.filter((x) => x.category !== s.category));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('budgets.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('budgets.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchSuggestions} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              AI suggest
            </Button>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />{t('budgets.newBudget')}</Button>
            </DialogTrigger>
          </div>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('budgets.createBudget')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Select value={newBudget.category} onValueChange={(v) => setNewBudget((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categoriesList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" placeholder={t('budgets.limit')} value={newBudget.limit} onChange={(e) => setNewBudget((p) => ({ ...p, limit: e.target.value }))} />
              <Button onClick={handleAdd} className="w-full">{t('budgets.create')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI budget suggestions</p>
            <Button size="sm" variant="ghost" onClick={() => setSuggestions([])}>Dismiss</Button>
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.category} className="flex items-start justify-between gap-3 p-2 rounded bg-card">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.category} — ${s.monthly_budget}/mo</p>
                  <p className="text-xs text-muted-foreground">{s.rationale}</p>
                </div>
                <Button size="sm" onClick={() => applySuggestion(s)}>Apply</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('budgets.totalBudget')}</p>
          <p className="text-2xl font-bold text-card-foreground">${totalBudget.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('budgets.totalSpent')}</p>
          <p className="text-2xl font-bold text-card-foreground">${totalSpent.toLocaleString()}</p>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.map((budget, i) => {
          const pct = Math.min((Number(budget.spent) / Number(budget.limit_amount)) * 100, 100);
          const over = pct >= 90;
          return (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border bg-card p-5 ${over ? 'border-destructive/50' : 'border-border'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-card-foreground">{budget.category}</h3>
                <span className={`text-sm ${over ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  ${Number(budget.spent)} {t('budgets.of')} ${Number(budget.limit_amount)}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className={`text-xs mt-2 ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                {pct.toFixed(0)}% {t('budgets.spent')}{over && ' — over 90%, slow down'}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Budgets;

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('budgets.totalBudget')}</p>
          <p className="text-2xl font-bold text-card-foreground">${totalBudget.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('budgets.totalSpent')}</p>
          <p className="text-2xl font-bold text-card-foreground">${totalSpent.toLocaleString()}</p>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.map((budget, i) => {
          const pct = Math.min((Number(budget.spent) / Number(budget.limit_amount)) * 100, 100);
          return (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-card-foreground">{budget.category}</h3>
                <span className="text-sm text-muted-foreground">
                  ${Number(budget.spent)} {t('budgets.of')} ${Number(budget.limit_amount)}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">{pct.toFixed(0)}% {t('budgets.spent')}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Budgets;
