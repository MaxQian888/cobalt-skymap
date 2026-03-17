"use client";

import { useTranslations } from "next-intl";
import {
  Minus,
  Square,
  X,
  Maximize2,
  RotateCw,
  Power,
  RefreshCw,
  MoreVertical,
  Fullscreen,
  Minimize2,
  Copy,
  Pin,
  PinOff,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWindowControls } from "@/lib/hooks/use-window-controls";
import type { WindowPositionPreset } from "@/lib/tauri/positioner-api";

interface AppControlMenuProps {
  className?: string;
  variant?: "dropdown" | "inline";
}

const screenPositionItems: Array<{ preset: WindowPositionPreset; labelKey: string }> = [
  { preset: "TopLeft", labelKey: "positionTopLeft" },
  { preset: "TopCenter", labelKey: "positionTopCenter" },
  { preset: "TopRight", labelKey: "positionTopRight" },
  { preset: "LeftCenter", labelKey: "positionLeftCenter" },
  { preset: "Center", labelKey: "positionCenter" },
  { preset: "RightCenter", labelKey: "positionRightCenter" },
  { preset: "BottomLeft", labelKey: "positionBottomLeft" },
  { preset: "BottomCenter", labelKey: "positionBottomCenter" },
  { preset: "BottomRight", labelKey: "positionBottomRight" },
];

const trayPositionItems: Array<{ preset: WindowPositionPreset; labelKey: string }> = [
  { preset: "TrayLeft", labelKey: "positionTrayLeft" },
  { preset: "TrayCenter", labelKey: "positionTrayCenter" },
  { preset: "TrayRight", labelKey: "positionTrayRight" },
  { preset: "TrayBottomLeft", labelKey: "positionTrayBottomLeft" },
  { preset: "TrayBottomCenter", labelKey: "positionTrayBottomCenter" },
  { preset: "TrayBottomRight", labelKey: "positionTrayBottomRight" },
];

export function AppControlMenu({ className, variant = "dropdown" }: AppControlMenuProps) {
  const t = useTranslations("appControl");
  const {
    isTauriEnv,
    isMaximized,
    isFullscreen,
    isPinned,
    isTrayReady,
    shell,
    handleMinimize,
    handleMaximize,
    handleCloseWithSave: handleClose,
    handleRestart,
    handleQuitWithSave: handleQuit,
    handleReload,
    handleToggleFullscreen,
    handleTogglePin,
    handleCenterWindow,
    handleMoveWindow,
    handleWebReload,
  } = useWindowControls();

  // Inline variant for toolbar - shows different controls based on environment
  if (variant === "inline") {
    // Web environment: Show reload and fullscreen toggle
    if (!isTauriEnv) {
      return (
        <div className={cn("flex items-center gap-0.5", className)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent"
                onClick={handleWebReload}
                aria-label={t("reload")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("reload")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Fullscreen className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{isFullscreen ? t("exitFullscreen") : t("fullscreen")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    // Tauri environment: Show essential window controls
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {/* Always on Top Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9",
                isPinned
                  ? "text-primary hover:text-primary hover:bg-primary/10"
                  : "text-foreground/80 hover:text-foreground hover:bg-accent"
              )}
              onClick={handleTogglePin}
              aria-label={isPinned ? t("unpinWindow") : t("pinWindow")}
            >
              {isPinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isPinned ? t("unpinWindow") : t("pinWindow")}</p>
          </TooltipContent>
        </Tooltip>

        {/* Fullscreen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent"
              onClick={handleToggleFullscreen}
              aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Fullscreen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isFullscreen ? t("exitFullscreen") : t("fullscreen")}</p>
          </TooltipContent>
        </Tooltip>

        {!shell.showsNativeWindowControls && (
          <>
            {/* Minimize */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent"
                  onClick={handleMinimize}
                  aria-label={t("minimize")}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t("minimize")}</p>
              </TooltipContent>
            </Tooltip>

            {/* Maximize/Restore */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent"
                  onClick={handleMaximize}
                  aria-label={isMaximized ? t("restore") : t("maximize")}
                >
                  {isMaximized ? (
                    <Copy className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isMaximized ? t("restore") : t("maximize")}</p>
              </TooltipContent>
            </Tooltip>

            {/* Close */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent"
                  onClick={handleClose}
                  aria-label={t("close")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t("close")}</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    );
  }

  // Dropdown variant - shows different menu based on environment
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9", className)}
              aria-label={t("appControls")}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("appControls")}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        {/* Common controls for both environments */}
        <DropdownMenuItem onClick={isTauriEnv ? handleReload : handleWebReload}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("reload")}
        </DropdownMenuItem>
        
        {/* Tauri-specific controls */}
        {isTauriEnv && (
          <>
            <DropdownMenuItem onClick={handleRestart}>
              <RotateCw className="mr-2 h-4 w-4" />
              {t("restart")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleTogglePin}>
              {isPinned ? (
                <PinOff className="mr-2 h-4 w-4" />
              ) : (
                <Pin className="mr-2 h-4 w-4" />
              )}
              {isPinned ? t("unpinWindow") : t("pinWindow")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCenterWindow}>
              <Move className="mr-2 h-4 w-4" />
              {t("centerWindow")}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Move className="mr-2 h-4 w-4" />
                {t("moveWindow")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuLabel>{t("screenPositions")}</DropdownMenuLabel>
                {screenPositionItems.map((item) => (
                  <DropdownMenuItem
                    key={item.preset}
                    onClick={() => handleMoveWindow(item.preset)}
                  >
                    {t(item.labelKey)}
                  </DropdownMenuItem>
                ))}
                {isTrayReady && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{t("trayPositions")}</DropdownMenuLabel>
                    {trayPositionItems.map((item) => (
                      <DropdownMenuItem
                        key={item.preset}
                        onClick={() => handleMoveWindow(item.preset)}
                      >
                        {t(item.labelKey)}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            {!shell.showsNativeWindowControls && (
              <>
                <DropdownMenuItem onClick={handleMinimize}>
                  <Minus className="mr-2 h-4 w-4" />
                  {t("minimize")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMaximize}>
                  {isMaximized ? (
                    <Copy className="mr-2 h-4 w-4" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}
                  {isMaximized ? t("restore") : t("maximize")}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={handleToggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="mr-2 h-4 w-4" />
              ) : (
                <Fullscreen className="mr-2 h-4 w-4" />
              )}
              {isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            </DropdownMenuItem>
            {!shell.showsNativeWindowControls && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleMinimize}>
                  <Minus className="mr-2 h-4 w-4" />
                  {t("minimize")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMaximize}>
                  {isMaximized ? (
                    <Copy className="mr-2 h-4 w-4" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}
                  {isMaximized ? t("restore") : t("maximize")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleClose}>
                  <X className="mr-2 h-4 w-4" />
                  {t("close")}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={handleQuit}
              className="text-destructive focus:text-destructive"
            >
              <Power className="mr-2 h-4 w-4" />
              {t("quit")}
            </DropdownMenuItem>
          </>
        )}
        
        {/* Web-specific controls */}
        {!isTauriEnv && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleToggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="mr-2 h-4 w-4" />
              ) : (
                <Maximize2 className="mr-2 h-4 w-4" />
              )}
              {isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
