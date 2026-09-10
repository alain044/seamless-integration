import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Tx {
  id: string;
  name: string;
  amount: number;
  date: string;
  type: 'expense' | 'income';
}

const RecentTransactions = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tx[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('expenses')
        .select('id, name, amount, date, type')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);
      setTransactions((data || []) as Tx[]);
    })();
  }, [user]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-card-foreground mb-4">
        {t('dashboard.recentTransactions')}
      </h3>
      <div className="space-y-3">
        {transactions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${tx.type === 'income' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                {tx.type === 'income' ? (
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">{tx.name}</p>
                <p className="text-xs text-muted-foreground">{tx.date}</p>
              </div>
            </div>
            <p className={`text-sm font-semibold ${tx.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
              {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentTransactions;
