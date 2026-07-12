'use client';

import { useState, useCallback, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bookmark,
  BookmarkPlus,
  Star,
  Heart,
  Flag,
  MapPin,
  Eye,
  Camera,
  Telescope,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  Navigation,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import {
  useBookmarksStore,
  BOOKMARK_COLORS,
  BOOKMARK_ICONS,
  type ViewBookmark,
  type BookmarkIcon,
} from '@/lib/stores/bookmarks-store';
import type { ViewBookmarksProps } from '@/types/starmap/controls';

// Icon component mapping
const BookmarkIconComponent: Record<BookmarkIcon, React.ComponentType<LucideProps>> = {
  star: Star,
  heart: Heart,
  flag: Flag,
  pin: MapPin,
  eye: Eye,
  camera: Camera,
  telescope: Telescope,
};

export const ViewBookmarks = memo(function ViewBookmarks({
  currentRa,
  currentDec,
  currentFov,
  onNavigate,
  className,
}: ViewBookmarksProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<ViewBookmark | null>(null);
  
  // Form state for new/edit bookmark
  const defaultForm = { name: '', description: '', color: BOOKMARK_COLORS[4] as string, icon: 'star' as BookmarkIcon };
  const [form, setForm] = useState(defaultForm);
  const updateForm = useCallback((patch: Partial<typeof defaultForm>) => setForm(prev => ({ ...prev, ...patch })), []);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    bookmarks,
    addBookmark,
    updateBookmark,
    removeBookmark,
    duplicateBookmark,
  } = useBookmarksStore();

  const handleAddBookmark = useCallback(() => {
    setEditingBookmark(null);
    setForm(defaultForm);
    setEditDialogOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditBookmark = useCallback((bookmark: ViewBookmark) => {
    setEditingBookmark(bookmark);
    setForm({
      name: bookmark.name,
      description: bookmark.description || '',
      color: bookmark.color || BOOKMARK_COLORS[4] as string,
      icon: bookmark.icon || 'star',
    });
    setEditDialogOpen(true);
  }, []);

  const handleSaveBookmark = useCallback(() => {
    if (!form.name.trim()) return;

    const data = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color,
      icon: form.icon,
    };

    if (editingBookmark) {
      updateBookmark(editingBookmark.id, data);
    } else {
      addBookmark({ ...data, ra: currentRa, dec: currentDec, fov: currentFov });
    }

    setEditDialogOpen(false);
  }, [
    editingBookmark,
    form,
    currentRa,
    currentDec,
    currentFov,
    addBookmark,
    updateBookmark,
  ]);

  const handleNavigate = useCallback((bookmark: ViewBookmark) => {
    onNavigate?.(bookmark.ra, bookmark.dec, bookmark.fov);
    setIsOpen(false);
  }, [onNavigate]);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent',
                  className
                )}
                data-tour-id="view-bookmarks"
              >
                <Bookmark className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t('bookmarks.viewBookmarks')}</p>
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-72 p-0 animate-in fade-in zoom-in-95 slide-in-from-top-2" align="end">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Bookmark className="h-4 w-4" />
              {t('bookmarks.savedViews')}
            </h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleAddBookmark}
                >
                  <BookmarkPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('bookmarks.saveCurrentView')}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <ScrollArea className="max-h-64">
            {bookmarks.length === 0 ? (
              <div>
                <EmptyState
                  icon={Bookmark}
                  message={t('bookmarks.noBookmarks')}
                  iconClassName="opacity-30"
                />
                <div className="text-center -mt-4 pb-4">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleAddBookmark}
                  >
                    <BookmarkPlus className="h-3 w-3 mr-1" />
                    {t('bookmarks.saveCurrentView')}
                  </Button>
                </div>
              </div>
            ) : (
              <ItemGroup className="py-1">
                {bookmarks.map((bookmark) => {
                  const IconComp = BookmarkIconComponent[bookmark.icon || 'star'];
                  return (
                    <Item
                      key={bookmark.id}
                      className="group border-0 rounded-none px-3 py-2"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => handleNavigate(bookmark)}
                      >
                        <ItemMedia className="h-auto w-auto bg-transparent p-0" style={{ color: bookmark.color }}>
                          <IconComp className="h-4 w-4 shrink-0" />
                        </ItemMedia>
                        <ItemContent className="min-w-0 gap-0">
                          <ItemTitle className="truncate">{bookmark.name}</ItemTitle>
                          {bookmark.description && (
                            <ItemDescription className="line-clamp-1 text-xs text-muted-foreground">
                              {bookmark.description}
                            </ItemDescription>
                          )}
                        </ItemContent>
                      </button>

                      <ItemActions className="gap-0.5 shell-desktop:opacity-0 transition-opacity shell-desktop:group-hover:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shell-mobile:min-h-11 shell-mobile:min-w-11"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigate(bookmark);
                              }}
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              {t('bookmarks.goTo')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditBookmark(bookmark);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateBookmark(bookmark.id, t('bookmarks.copySuffix'));
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              {t('bookmarks.duplicate')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(bookmark.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Edit/Add Dialog */}
      <ResponsiveDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} tier="standard-form">
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              {editingBookmark ? (
                <>
                  <Edit className="h-5 w-5" />
                  {t('bookmarks.editBookmark')}
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-5 w-5" />
                  {t('bookmarks.saveCurrentView')}
                </>
              )}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel htmlFor="name">{t('bookmarks.name')}</FieldLabel>
              <FieldContent>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder={t('bookmarks.namePlaceholder')}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">{t('bookmarks.description')}</FieldLabel>
              <FieldContent>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder={t('bookmarks.descriptionPlaceholder')}
                  rows={2}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{t('bookmarks.icon')}</FieldLabel>
              <FieldContent>
                <ToggleGroup
                  type="single"
                  value={form.icon}
                  onValueChange={(value) => {
                    if (value) updateForm({ icon: value as BookmarkIcon });
                  }}
                  className="flex flex-wrap gap-1"
                >
                  {BOOKMARK_ICONS.map((icon) => {
                    const IconComp = BookmarkIconComponent[icon];
                    return (
                      <ToggleGroupItem
                        key={icon}
                        value={icon}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8"
                        aria-label={icon}
                      >
                        <IconComp className="h-4 w-4" />
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{t('bookmarks.color')}</FieldLabel>
              <FieldContent>
                <ColorPicker
                  colors={BOOKMARK_COLORS}
                  value={form.color}
                  onChange={(color) => updateForm({ color })}
                  className="flex flex-wrap gap-1"
                />
              </FieldContent>
            </Field>

            {!editingBookmark && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <p className="font-medium mb-1">{t('bookmarks.currentPosition')}</p>
                <p>{t('bookmarks.raLabel')}: {currentRa.toFixed(4)}° • {t('bookmarks.decLabel')}: {currentDec.toFixed(4)}°</p>
                <p>{t('bookmarks.fovLabel')}: {currentFov.toFixed(1)}°</p>
              </div>
            )}
          </div>

          <ResponsiveDialogFooter stickyOnMobile>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveBookmark} disabled={!form.name.trim()}>
              {editingBookmark ? t('common.save') : t('bookmarks.saveBookmark')}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bookmarks.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('bookmarks.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) removeBookmark(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
ViewBookmarks.displayName = 'ViewBookmarks';
