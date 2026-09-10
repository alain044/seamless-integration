import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface UserPreferences {
  dateFormat: string;
  startOfWeek: string;
  compactView: boolean;
  showBalances: boolean;
  language?: string;
}

export interface UserNotifications {
  emailAlerts: boolean;
  pushNotifications: boolean;
  budgetWarnings: boolean;
  weeklyReport: boolean;
  marketAlerts: boolean;
  goalReminders: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  dateFormat: 'MM/DD/YYYY',
  startOfWeek: 'monday',
  compactView: false,
  showBalances: true,
  language: undefined,
};

const DEFAULT_NOTIFS: UserNotifications = {
  emailAlerts: true,
  pushNotifications: true,
  budgetWarnings: true,
  weeklyReport: false,
  marketAlerts: true,
  goalReminders: true,
};

interface Ctx {
  preferences: UserPreferences;
  notifications: UserNotifications;
  loading: boolean;
  refresh: () => Promise<void>;
  setPreferences: (p: UserPreferences) => void;
  setNotifications: (n: UserNotifications) => void;
}

const PreferencesContext = createContext<Ctx | null>(null);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [preferences, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [notifications, setNotifs] = useState<UserNotifications>(DEFAULT_NOTIFS);
  const [loading, setLoading] = useState(true);

  const applyLang = useCallback((lng?: string) => {
    if (lng && lng !== i18n.language) i18n.changeLanguage(lng);
  }, [i18n]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_settings')
      .select('preferences, notifications')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      if (data.preferences) {
        const merged = { ...DEFAULT_PREFS, ...(data.preferences as any) };
        setPrefs(merged);
        applyLang(merged.language);
      }
      if (data.notifications) setNotifs({ ...DEFAULT_NOTIFS, ...(data.notifications as any) });
    }
    setLoading(false);
  }, [user, applyLang]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-settings-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const next = payload.new;
          if (next?.preferences) {
            const merged = { ...DEFAULT_PREFS, ...next.preferences };
            setPrefs(merged);
            applyLang(merged.language);
          }
          if (next?.notifications) setNotifs({ ...DEFAULT_NOTIFS, ...next.notifications });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, applyLang]);

  return (
    <PreferencesContext.Provider
      value={{ preferences, notifications, loading, refresh, setPreferences: setPrefs, setNotifications: setNotifs }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
};

/** Helper to mask sensitive values when showBalances is off. */
export const maskValue = (value: string, show: boolean) => (show ? value : '••••••');
