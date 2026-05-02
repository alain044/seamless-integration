import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type AppRole = 'owner' | 'accountant' | 'analyst' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  type: string;
  description: string | null;
  created_by: string;
}

interface OrgContextValue {
  organization: Organization | null;
  role: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  canManageTasks: boolean;
  canEditFinance: boolean;
  isOwner: boolean;
  isViewer: boolean;
  canEdit: boolean;
}

const OrganizationContext = createContext<OrgContextValue>({
  organization: null,
  role: null,
  loading: true,
  refresh: async () => {},
  canManageTasks: false,
  canEditFinance: false,
  isOwner: false,
  isViewer: false,
  canEdit: false,
});

export const useOrganization = () => useContext(OrganizationContext);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrganization(null);
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role, organization_id, organizations(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership?.organizations) {
      setOrganization(membership.organizations as Organization);
      setRole(membership.role as AppRole);
    } else {
      setOrganization(null);
      setRole(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canManageTasks = role === 'owner' || role === 'accountant';
  const canEditFinance = role === 'owner' || role === 'accountant' || role === 'analyst';
  const isOwner = role === 'owner';
  const isViewer = role === 'viewer';
  const canEdit = role !== 'viewer' && role !== null;

  return (
    <OrganizationContext.Provider
      value={{ organization, role, loading, refresh, canManageTasks, canEditFinance, isOwner, isViewer, canEdit }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};
