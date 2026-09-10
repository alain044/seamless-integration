import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SpendingChart = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<{ month: string; spending: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const { data: rows } = await supabase
        .from('expenses')
        .select('amount, date, type')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', since.toISOString().slice(0, 10));
      const buckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleString('default', { month: 'short' });
        buckets[key] = 0;
      }
      (rows || []).forEach((r: any) => {
        const d = new Date(r.date);
        const key = d.toLocaleString('default', { month: 'short' });
        if (key in buckets) buckets[key] += Number(r.amount);
      });
      setData(Object.entries(buckets).map(([month, spending]) => ({ month, spending })));
    })();
  }, [user]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-card-foreground mb-4">
        {t('dashboard.spendingOverview')}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--card-foreground))',
            }}
          />
          <Area type="monotone" dataKey="spending" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSpending)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SpendingChart;
