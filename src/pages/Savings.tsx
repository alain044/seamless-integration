import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SavingsGoal { id: string; name: string; target: number; saved: number; icon: string; }

const Savings = () => {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', target: '' });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('savings_goals').select('*').order('created_at', { ascending: true });
      if (error) toast.error(error.message);
      else setGoals((data || []) as SavingsGoal[]);
      setLoading(false);
    })();
  }, []);

  const totalSaved = goals.reduce((s, g) => s + Number(g.saved), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target), 0);

  const handleAdd = async () => {
    if (!newGoal.name || !newGoal.target) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sign in required'); return; }
    const { data, error } = await supabase.from('savings_goals').insert({
      user_id: user.id,
      name: newGoal.name,
      target: parseFloat(newGoal.target),
      saved: 0,
      icon: '🎯',
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setGoals((prev) => [...prev, data as SavingsGoal]);
    setNewGoal({ name: '', target: '' });
    setDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('savings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('savings.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t('savings.newGoal')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('savings.createGoal')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder={t('savings.goalName')} value={newGoal.name} onChange={(e) => setNewGoal((p) => ({ ...p, name: e.target.value }))} />
              <Input type="number" placeholder={t('savings.targetAmount')} value={newGoal.target} onChange={(e) => setNewGoal((p) => ({ ...p, target: e.target.value }))} />
              <Button onClick={handleAdd} className="w-full">{t('savings.create')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{t('savings.totalSaved')}</p>
        <p className="text-2xl font-bold text-card-foreground">${totalSaved.toLocaleString()} / ${totalTarget.toLocaleString()}</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal, i) => {
          const pct = Math.min((Number(goal.saved) / Number(goal.target)) * 100, 100);
          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{goal.icon}</span>
                <div>
                  <h3 className="font-semibold text-card-foreground">{goal.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    ${Number(goal.saved).toLocaleString()} {t('savings.of')} ${Number(goal.target).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{pct.toFixed(0)}% {t('savings.saved')}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Savings;
