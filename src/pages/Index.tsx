import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Eye, EyeOff } from 'lucide-react';
import FinanceStatCard from '@/components/dashboard/FinanceStatCard';
import SpendingChart from '@/components/dashboard/SpendingChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { Button } from '@/components/ui/button';
import { usePreferences, maskValue } from '@/contexts/PreferencesContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from '@/components/ui/sonner';

const Index = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { preferences, notifications, setPreferences } = usePreferences();
  const { format } = useCurrency();
  const show = preferences.showBalances;

  const [stats, setStats] = useState({
    balance: 0,
    monthIncome: 0,
    monthExpense: 0,
    savings: 0,
    savingsTarget: 0,
  });
  const [topBudgets, setTopBudgets] = useState<{ category: string; amount: number; spent: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthIso = startOfMonth.toISOString().slice(0, 10);

      const [{ data: allExp }, { data: monthExp }, { data: goals }, { data: budgets }] = await Promise.all([
        supabase.from('expenses').select('amount, type').eq('user_id', user.id),
        supabase.from('expenses').select('amount, type').eq('user_id', user.id).gte('date', monthIso),
        supabase.from('savings_goals').select('saved, target').eq('user_id', user.id),
        supabase.from('budgets').select('category, limit_amount, spent').eq('user_id', user.id),
      ]);

      let balance = 0;
      (allExp || []).forEach((r: any) => {
        balance += r.type === 'income' ? Number(r.amount) : -Number(r.amount);
      });
      let monthIncome = 0, monthExpense = 0;
      (monthExp || []).forEach((r: any) => {
        if (r.type === 'income') monthIncome += Number(r.amount);
        else monthExpense += Number(r.amount);
      });
      let savings = 0, savingsTarget = 0;
      (goals || []).forEach((g: any) => {
        savings += Number(g.saved);
        savingsTarget += Number(g.target);
      });
      setStats({ balance, monthIncome, monthExpense, savings, savingsTarget });
      const ranked = (budgets || [])
        .map((b: any) => ({ category: b.category, amount: Number(b.limit_amount), spent: Number(b.spent) }))
        .filter(b => b.amount > 0)
        .sort((a, b) => (b.spent / b.amount) - (a.spent / a.amount))
        .slice(0, 4);
      setTopBudgets(ranked);
    })();
  }, [user]);

  const toggleShow = async () => {
    if (!user) return;
    const next = { ...preferences, showBalances: !show };
    setPreferences(next);
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: user.id, preferences: next as any, notifications: notifications as any },
      { onConflict: 'user_id' },
    );
    if (error) toast.error(error.message);
  };

  const goalPct = stats.savingsTarget > 0 ? Math.round((stats.savings / stats.savingsTarget) * 100) : 0;

  const cards = [
    { title: t('dashboard.totalBalance'), value: maskValue(format(stats.balance), show), change: stats.balance >= 0 ? 'Net positive' : 'Net negative', changeType: (stats.balance >= 0 ? 'positive' : 'negative') as 'positive' | 'negative', icon: Wallet },
    { title: t('dashboard.monthlyIncome'), value: maskValue(format(stats.monthIncome), show), change: 'This month', changeType: 'positive' as const, icon: TrendingUp },
    { title: t('dashboard.monthlySpending'), value: maskValue(format(stats.monthExpense), show), change: 'This month', changeType: 'neutral' as const, icon: TrendingDown },
    { title: t('dashboard.totalSavings'), value: maskValue(format(stats.savings), show), change: `${goalPct}% ${t('dashboard.ofGoal')}`, changeType: 'neutral' as const, icon: PiggyBank },
  ];

  return (
    <div className={preferences.compactView ? 'p-4 space-y-4' : 'p-6 space-y-6'}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('dashboard.welcome')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleShow}>
          {show ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {show ? t('dashboard.hideBalances') : t('dashboard.showBalances')}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat, i) => (
          <FinanceStatCard key={i} {...stat} index={i} />
        ))}
      </div>

      {topBudgets.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-card-foreground">Budget utilization</h2>
            <a href="/dashboard/budgets" className="text-xs text-primary hover:underline">View all</a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topBudgets.map((b) => {
              const pct = Math.min((b.spent / b.amount) * 100, 999);
              const over = pct > 100;
              const warn = pct >= 90 && !over;
              const color = over ? 'bg-destructive' : warn ? 'bg-orange-500' : 'bg-primary';
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground truncate">{b.category}</span>
                    <span className={over ? 'text-destructive font-semibold' : warn ? 'text-orange-500' : 'text-muted-foreground'}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(b.spent)} / {format(b.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingChart />
        <RecentTransactions />
      </div>
    </div>
  );
};

export default Index;
