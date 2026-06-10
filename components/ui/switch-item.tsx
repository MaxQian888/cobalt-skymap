'use client';

import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SwitchItemProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
  switchProps?: Omit<React.ComponentProps<typeof Switch>, 'checked' | 'onCheckedChange' | 'id'> & Record<string, unknown>;
}

export function SwitchItem({
  label,
  description,
  checked,
  onCheckedChange,
  id,
  className,
  switchProps,
}: SwitchItemProps) {
  // Associate the label with the switch so clicking the label toggles it and
  // screen readers announce the label as the control's name (NEW-a11y-1).
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const descriptionId = description ? `${resolvedId}-description` : undefined;

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="space-y-0.5">
        <Label htmlFor={resolvedId} className="text-sm cursor-pointer font-normal">
          {label}
        </Label>
        {description && (
          <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={resolvedId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={descriptionId}
        {...switchProps}
      />
    </div>
  );
}
