import { useState } from 'react';
import { Check, ChevronsUpDown, Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export const OrgSwitcher = () => {
  const { organization, memberships, switchOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!organization) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[240px]" aria-label="Switch organization">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate text-sm font-medium">{organization.name}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="end">
        <Command>
          <CommandList>
            <CommandEmpty>No organizations</CommandEmpty>
            <CommandGroup heading="Your organizations">
              {memberships.map((m) => (
                <CommandItem
                  key={m.organization.id}
                  onSelect={async () => {
                    await switchOrganization(m.organization.id);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.organization.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{t(`roles.${m.role}`)}</p>
                  </div>
                  <Check className={cn('w-4 h-4', m.organization.id === organization.id ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={() => { setOpen(false); navigate('/dashboard/settings'); }} className="gap-2">
                <Plus className="w-4 h-4" /> Create or join organization
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
