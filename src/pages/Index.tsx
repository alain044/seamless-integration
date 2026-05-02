import { useTranslation } from 'react-i18next';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FinanceStatCard from '@/components/dashboard/FinanceStatCard';
import SpendingChart from '@/components/dashboard/SpendingChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { Button } from '@/components/ui/button';
import { usePreferences, maskValue } from '@/contexts/PreferencesContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from '@/components/ui/sonner';

const Index = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const { preferences, notifications, setPreferences } = usePreferences();
  const show = preferences.showBalances;

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

  const openChatWithContext = () => {
    const context = {
      organization: organization ? { id: organization.id, name: organization.name } : null,
      range: { start: new Date(Date.now() - 30 * 86400000).toISOString(), end: new Date().toISOString() },
      summary: {
        totalBalance: 24563,
        monthlyIncome: 5350,
        monthlySpending: 2847.19,
        totalSavings: 8420,
      },
    };
    navigate('/chat', { state: { context } });
  };

  const stats = [
    { title: t('dashboard.totalBalance'), value: maskValue('$24,563.00', show), change: `+2.5% ${t('dashboard.fromLastMonth')}`, changeType: 'positive' as const, icon: Wallet },
    { title: t('dashboard.monthlyIncome'), value: maskValue('$5,350.00', show), change: `+$350 ${t('dashboard.fromLastMonth')}`, changeType: 'positive' as const, icon: TrendingUp },
    { title: t('dashboard.monthlySpending'), value: maskValue('$2,847.19', show), change: `-12% ${t('dashboard.fromLastMonth')}`, changeType: 'positive' as const, icon: TrendingDown },
    { title: t('dashboard.totalSavings'), value: maskValue('$8,420.00', show), change: `67% ${t('dashboard.ofGoal')}`, changeType: 'neutral' as const, icon: PiggyBank },
  ];

  return (
    <div className={preferences.compactView ? 'p-4 space-y-4' : 'p-6 space-y-6'}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('dashboard.welcome')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button onClick={openChatWithContext} className="gradient-primary text-primary-foreground border-0 shadow-glow">
            <MessageCircle className="w-4 h-4 mr-2" /> Ask Savvy about this
          </Button>
          <Button variant="outline" size="sm" onClick={toggleShow}>
            {show ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {show ? t('dashboard.hideBalances') : t('dashboard.showBalances')}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <FinanceStatCard key={i} {...stat} index={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingChart />
        <RecentTransactions />
      </div>
    </div>
  );
};

export default Index;
