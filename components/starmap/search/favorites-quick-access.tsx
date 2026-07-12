'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Heart, 
  Clock, 
  Trash2, 
  Plus,
  X,
  Download,
  Upload,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { FavoriteObjectItem } from './favorite-object-item';
import { cn } from '@/lib/utils';
import { 
  useFavoritesStore, 
  FAVORITE_TAGS,
  type FavoriteObject 
} from '@/lib/stores';
import type { FavoritesQuickAccessProps } from '@/types/starmap/search';

export type { FavoritesQuickAccessProps } from '@/types/starmap/search';

export function FavoritesQuickAccess({ 
  onSelect, 
  onNavigate,
  className 
}: FavoritesQuickAccessProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    favorites,
    recentlyViewed,
    removeFavorite,
    addTag,
    removeTag,
    clearRecentlyViewed,
    getAllTags,
    exportFavorites,
    importFavorites,
  } = useFavoritesStore();

  const allTags = getAllTags();

  const filteredFavorites = filterTag
    ? favorites.filter(f => f.tags.includes(filterTag))
    : favorites;

  const handleSelect = useCallback((object: FavoriteObject) => {
    onSelect?.(object);
  }, [onSelect]);

  const handleNavigate = useCallback((object: FavoriteObject) => {
    onNavigate?.(object.ra, object.dec);
  }, [onNavigate]);

  const handleAddTag = useCallback((id: string) => {
    if (newTag.trim()) {
      addTag(id, newTag.trim().toLowerCase());
      setNewTag('');
    }
  }, [addTag, newTag]);

  const handleExportFavorites = useCallback(() => {
    const exported = exportFavorites();
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starmap-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportFavorites]);

  const handleImportFavorites = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = typeof reader.result === 'string' ? reader.result : '[]';
        const parsed = JSON.parse(content) as FavoriteObject[];
        const result = importFavorites(parsed);
        setImportStatus(
          t('targetList.importDescription', {
            imported: result.imported,
            skipped: result.skipped,
            defaultValue: `${result.imported} imported, ${result.skipped} skipped`,
          })
        );
      } catch {
        setImportStatus(t('targetList.importFailed', { defaultValue: 'Import failed' }));
      }
    };
    reader.readAsText(file);
  }, [importFavorites, t]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-end gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImportFavorites(file);
            }
            e.currentTarget.value = '';
          }}
        />
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />
          {t('targetList.import', { defaultValue: 'Import' })}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExportFavorites}>
          <Download className="h-3 w-3 mr-1" />
          {t('targetList.exportAs', { defaultValue: 'Export' })}
        </Button>
      </div>
      {importStatus && (
        <Alert className="py-1.5 px-3">
          <AlertDescription className="text-[11px]">{importStatus}</AlertDescription>
        </Alert>
      )}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'favorites' | 'recent')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="favorites" className="text-xs gap-1">
            <Heart className="h-3 w-3" />
            {t('favorites.favorites')} ({favorites.length})
          </TabsTrigger>
          <TabsTrigger value="recent" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            {t('favorites.recent')} ({recentlyViewed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="favorites" className="mt-2 space-y-2">
          {/* Tag Filter */}
          {allTags.length > 0 && (
            <ToggleGroup
              type="single"
              value={filterTag ?? '__all__'}
              onValueChange={(value) => setFilterTag(value === '__all__' || !value ? null : value)}
              variant="outline"
              size="sm"
              className="flex flex-wrap gap-1 px-1"
            >
              <ToggleGroupItem value="__all__" className="h-6 px-2 text-xs">
                {t('favorites.all')}
              </ToggleGroupItem>
              {allTags.map(tag => (
                <ToggleGroupItem key={tag} value={tag} className="h-6 px-2 text-xs">
                  {tag}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          <ScrollArea className="h-48">
            {filteredFavorites.length === 0 ? (
              <EmptyState
                icon={Heart}
                message={t('favorites.noFavorites')}
                hint={t('favorites.addHint')}
              />
            ) : (
              <div className="space-y-0.5">
                {filteredFavorites.map(fav => (
                  <FavoriteObjectItem
                    key={fav.id}
                    object={fav}
                    onSelect={handleSelect}
                    onNavigate={handleNavigate}
                    onEditTags={setEditingTags}
                    onRemove={removeFavorite}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recent" className="mt-2 space-y-2">
          {recentlyViewed.length > 0 && (
            <div className="flex justify-end px-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={clearRecentlyViewed}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {t('favorites.clearRecent')}
              </Button>
            </div>
          )}

          <ScrollArea className="h-48">
            {recentlyViewed.length === 0 ? (
              <EmptyState
                icon={Clock}
                message={t('favorites.noRecent')}
              />
            ) : (
              <div className="space-y-0.5">
                {recentlyViewed.map(item => (
                  <FavoriteObjectItem
                    key={item.id}
                    object={item}
                    showActions={false}
                    isFavorite={favorites.some(f => f.id === item.id)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Tag Editor Dialog */}
      <ResponsiveDialog
        open={!!editingTags}
        onOpenChange={(open) => !open && setEditingTags(null)}
        tier="compact-confirmation"
      >
        <ResponsiveDialogContent desktopClassName="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t('favorites.manageTags')}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          <div className="space-y-4">
            {/* Current tags */}
            <div className="flex flex-wrap gap-1">
              {editingTags && favorites.find(f => f.id === editingTags)?.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {t(`favorites.tags.${tag}` as Parameters<typeof t>[0], { defaultValue: tag })}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:text-destructive"
                    onClick={() => removeTag(editingTags, tag)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>

            {/* Quick tags */}
            <Separator />
            <p className="text-xs text-muted-foreground">{t('favorites.quickTags')}</p>
            <div className="flex flex-wrap gap-1">
              {FAVORITE_TAGS.map(tag => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => editingTags && addTag(editingTags, tag)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t(`favorites.tags.${tag}` as Parameters<typeof t>[0], { defaultValue: tag })}
                </Badge>
              ))}
            </div>

            {/* Custom tag input */}
            <Separator />
            <div className="flex gap-2">
              <Input
                placeholder={t('favorites.customTag')}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editingTags) {
                    handleAddTag(editingTags);
                  }
                }}
              />
              <Button
                size="sm"
                className="h-8"
                onClick={() => editingTags && handleAddTag(editingTags)}
                disabled={!newTag.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
