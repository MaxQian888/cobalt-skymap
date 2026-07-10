'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { GeneralSettings } from './general-settings';
import { AppearanceSettings } from './appearance-settings';
import { PerformanceSettings } from './performance-settings';
import { NotificationSettings } from './notification-settings';
import { SearchBehaviorSettings } from './search-settings';
import { AccessibilitySettings } from './accessibility-settings';
import { KeyboardSettings } from './keyboard-settings';
import { GlobalShortcutSettings } from './global-shortcut-settings';
import { MobileSettings } from './mobile-settings';
import { AdvancedSettings } from './advanced-settings';

// Radix ScrollArea wraps content in a `display:table` element that sizes to
// max-content, so a wide child (a settings row, table, or button group) would
// stretch the whole drawer and overflow it. Forcing that wrapper to `block`
// clamps content to the drawer width; individually-wide children then scroll
// within their own bounds instead of dragging the panel sideways.
const SCROLL_VIEWPORT_CLAMP =
  'h-full [&_[data-slot=scroll-area-viewport]>div]:!block';

/**
 * Preferences tab body — a single continuous scroll of every preference
 * section. The previous in-tab quick-nav (a horizontally-scrolling secondary
 * tab bar) is gone: it overflowed the narrow drawer and duplicated the primary
 * tab strip. Sections carry their own headings, so they stay scannable inline.
 */
export function PreferencesTabContent() {
  return (
    <ScrollArea className={SCROLL_VIEWPORT_CLAMP}>
      <div className="p-4 space-y-4">
        <GeneralSettings />
        <Separator />
        <AppearanceSettings />
        <Separator />
        <PerformanceSettings />
        <Separator />
        <NotificationSettings />
        <Separator />
        <SearchBehaviorSettings />
        <Separator />
        <AccessibilitySettings />
        <Separator />
        <KeyboardSettings />
        <Separator />
        <GlobalShortcutSettings />
        <Separator />
        <MobileSettings />
        <Separator />
        <AdvancedSettings />
      </div>
    </ScrollArea>
  );
}
