'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ============================================================================
// Settings Section Component
// ============================================================================

export interface SettingsSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SettingsSection({ title, icon, children, defaultOpen = true }: SettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2 w-full overflow-hidden">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-2 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0">{icon}</span>
            <span className="font-medium text-sm truncate">{title}</span>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-1 overflow-hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Toggle Item Component
// ============================================================================

export interface ToggleItemProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: string;
  description?: string;
}

export function ToggleItem({ id, label, checked, onCheckedChange, icon, description }: ToggleItemProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0 mr-2">
        <Label htmlFor={id} className="text-sm cursor-pointer flex items-center gap-2">
          {icon && <span className="text-base" aria-hidden="true">{icon}</span>}
          {label}
        </Label>
        {description && (
          <p id={descriptionId} className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={descriptionId}
      />
    </div>
  );
}
