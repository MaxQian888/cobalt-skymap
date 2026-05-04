'use client';

import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { useTranslations } from 'next-intl';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getResultId } from '@/lib/core/search-utils';
import type { SearchResultItem, SkyCultureLanguage } from '@/lib/core/types';
import { SearchResultItemRow } from './search-result-item';
import { getTypeIcon } from './search-utils';

export interface GroupedResultsListProps {
  groupedResults: Map<string, SearchResultItem[]>;
  isSelected: (id: string) => boolean;
  skyCultureLanguage: SkyCultureLanguage | string;
  onSelect: (item: SearchResultItem) => void;
  onToggleSelection?: (id: string) => void;
  onAddToTargetList: (item: SearchResultItem) => void;
  showCheckbox?: boolean;
  /** Index map for keyboard navigation highlight */
  indexMap?: Map<string, number>;
  highlightedIndex?: number;
  onMouseEnter?: (index: number) => void;
  /** Ref callback for scroll-into-view */
  itemRefCallback?: (index: number, el: HTMLDivElement | null) => void;
  /** Initial expanded groups */
  defaultExpanded?: string[];
  listboxId?: string;
  searchQuery?: string;
}

// Virtualization activates above this total visible row count. Below the
// threshold the cost of measuring/positioning rows outweighs the savings,
// and DOM-presence-based tests (jsdom can't measure layout) keep working.
const VIRTUALIZATION_THRESHOLD = 80;
const ROW_ESTIMATE_PX = 56;
const HEADER_ESTIMATE_PX = 32;
const VIRTUAL_SCROLL_MAX_HEIGHT = '18rem';

type FlatRow =
  | { kind: 'header'; group: string; count: number }
  | { kind: 'item'; group: string; item: SearchResultItem };

export const GroupedResultsList = memo(function GroupedResultsList({
  groupedResults,
  isSelected,
  skyCultureLanguage,
  onSelect,
  onToggleSelection,
  onAddToTargetList,
  showCheckbox = true,
  indexMap,
  highlightedIndex = -1,
  onMouseEnter,
  itemRefCallback,
  defaultExpanded = ['DSO', 'Planet'],
  listboxId,
  searchQuery = '',
}: GroupedResultsListProps) {
  const t = useTranslations();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(defaultExpanded));
  const sourceGroups = useMemo(() => new Set(['local', 'sesame', 'simbad', 'vizier', 'ned']), []);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  const renderGroupLabel = useCallback(
    (groupName: string) =>
      sourceGroups.has(groupName.toLowerCase())
        ? groupName.toUpperCase()
        : t(`objects.${groupName.toLowerCase()}` as Parameters<typeof t>[0], { defaultValue: groupName }),
    [sourceGroups, t],
  );

  const renderItem = useCallback(
    (item: SearchResultItem) => {
      const itemId = getResultId(item);
      const globalIndex = indexMap?.get(itemId) ?? -1;
      return (
        <SearchResultItemRow
          key={itemId}
          ref={itemRefCallback ? (el: HTMLDivElement | null) => itemRefCallback(globalIndex, el) : undefined}
          item={item}
          itemId={itemId}
          checked={isSelected(itemId)}
          isHighlighted={globalIndex === highlightedIndex}
          showCheckbox={showCheckbox}
          skyCultureLanguage={skyCultureLanguage}
          onSelect={onSelect}
          onToggleSelection={onToggleSelection}
          onMouseEnter={onMouseEnter}
          onAddToTargetList={onAddToTargetList}
          globalIndex={globalIndex}
          searchQuery={searchQuery}
        />
      );
    },
    [
      indexMap,
      itemRefCallback,
      isSelected,
      highlightedIndex,
      showCheckbox,
      skyCultureLanguage,
      onSelect,
      onToggleSelection,
      onMouseEnter,
      onAddToTargetList,
      searchQuery,
    ],
  );

  // Flatten visible content into a single sequence for the virtualizer.
  // Headers are always emitted; item rows only for expanded groups.
  const flat = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    for (const [group, items] of groupedResults.entries()) {
      out.push({ kind: 'header', group, count: items.length });
      if (expandedGroups.has(group)) {
        for (const item of items) {
          out.push({ kind: 'item', group, item });
        }
      }
    }
    return out;
  }, [groupedResults, expandedGroups]);

  const shouldVirtualize = flat.length > VIRTUALIZATION_THRESHOLD;

  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    // Disable virtualization (count=0) when below threshold so the path
    // becomes a no-op without violating the rules of hooks.
    count: shouldVirtualize ? flat.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      flat[index]?.kind === 'header' ? HEADER_ESTIMATE_PX : ROW_ESTIMATE_PX,
    overscan: 8,
  });

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: VIRTUAL_SCROLL_MAX_HEIGHT }}
        role="listbox"
        id={listboxId}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = flat[virtualRow.index];
            const isExpanded = expandedGroups.has(row.group);
            return (
              <div
                key={`${row.kind}:${row.group}:${
                  row.kind === 'item' ? getResultId(row.item) : 'header'
                }`}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.kind === 'header' ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(row.group)}
                    className="flex items-center gap-1 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground py-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {getTypeIcon(row.group)}
                    <span className="ml-1">{renderGroupLabel(row.group)}</span>
                    <Badge variant="secondary" className="ml-auto h-4 text-[10px]">
                      {row.count}
                    </Badge>
                  </button>
                ) : (
                  <div className="pl-4">{renderItem(row.item)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Below threshold: keep the original Collapsible-based rendering. Tests in
  // jsdom and small result sets benefit from straightforward DOM presence.
  return (
    <div className="space-y-2" role="listbox" id={listboxId}>
      {Array.from(groupedResults.entries()).map(([groupName, items]) => (
        <Collapsible
          key={groupName}
          open={expandedGroups.has(groupName)}
          onOpenChange={() => toggleGroup(groupName)}
          className="space-y-1"
        >
          <CollapsibleTrigger className="flex items-center gap-1 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground py-1">
            {expandedGroups.has(groupName) ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {getTypeIcon(groupName)}
            <span className="ml-1">{renderGroupLabel(groupName)}</span>
            <Badge variant="secondary" className="ml-auto h-4 text-[10px]">
              {items.length}
            </Badge>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-0.5 pl-4">
            {items.map((item) => renderItem(item))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
});
