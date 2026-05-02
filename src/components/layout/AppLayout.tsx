import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Receipt, PiggyBank, Target, Sparkles,
  Briefcase, TrendingUp, BarChart3, Bell, ListChecks,
  Settings, ChevronLeft, ChevronRight, LogOut, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

const SignOutButton = ({ collapsed }: { collapsed: boolean }) => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <button
      onClick={signOut}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-200 text-destructive hover:bg-destructive/10',
        collapsed && 'justify-center px-2'
      )}
    >
      <LogOut className="w-5 h-5 shrink-0" />
      {!collapsed && <span>{t('nav.signOut')}</span>}
    </button>
  );
};

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organization, role } = useOrganization();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel('layout-notif-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const financeItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/tasks', icon: ListChecks, label: t('nav.tasks') },
    { to: '/expenses', icon: Receipt, label: t('nav.expenses') },
    { to: '/budgets', icon: PiggyBank, label: t('nav.budgets') },
    { to: '/savings', icon: Target, label: t('nav.savings') },
  ];

  const portfolioItems = [
    { to: '/portfolio', icon: Briefcase, label: t('nav.portfolio') },
    { to: '/market', icon: TrendingUp, label: t('nav.market') },
    { to: '/analytics', icon: BarChart3, label: t('nav.analytics') },
    { to: '/ai-insights', icon: Sparkles, label: t('nav.aiInsights') },
    { to: '/notifications', icon: Bell, label: t('nav.notifications') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  const renderNavItem = ({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) => {
    const isActive = location.pathname === to;
    const showBadge = to === '/notifications' && unreadCount > 0;
    return (
      <Link
        key={to}
        to={to}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          collapsed && 'justify-center px-2'
        )}
      >
        <div className="relative shrink-0">
          <Icon className="w-5 h-5" />
          {showBadge && collapsed && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && <span className="flex-1">{label}</span>}
        {showBadge && !collapsed && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!collapsed && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
              Savvy AI
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Org banner */}
        {organization && !collapsed && (
          <div className="px-4 py-3 border-b border-border bg-accent/30">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{organization.name}</p>
                {role && <p className="text-xs text-muted-foreground capitalize">{t(`roles.${role}`)}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            {!collapsed && (
              <p className="text-xs font-semibold text-muted-foreground mb-2 px-3">
                {t('nav.finance')}
              </p>
            )}
            <div className="space-y-1">{financeItems.map(renderNavItem)}</div>
          </div>
          <div>
            {!collapsed && (
              <p className="text-xs font-semibold text-muted-foreground mb-2 px-3">
                {t('nav.investment')}
              </p>
            )}
            <div className="space-y-1">{portfolioItems.map(renderNavItem)}</div>
          </div>
        </nav>

        {/* Language + Sign out */}
        <div className="p-3 border-t border-border space-y-2">
          <ThemeToggle collapsed={collapsed} />
          <LanguageSelector collapsed={collapsed} />
          <SignOutButton collapsed={collapsed} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
};

export default AppLayout;
