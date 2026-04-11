import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ArrowUpCircle,
  Camera,
  FileBarChart,
  LogOut,
  MoonStar,
  PanelLeft,
  Receipt,
  Settings2,
  SunMedium,
  Wallet,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import TaxModeToggle from "./TaxModeToggle";

const menuItems = [
  { icon: FileBarChart, label: "ダッシュボード", path: "/" },
  { icon: ArrowUpCircle, label: "売上", path: "/sales" },
  { icon: Wallet, label: "経費", path: "/expenses" },
  { icon: Receipt, label: "証憑", path: "/receipts" },
  { icon: Camera, label: "スキャン", path: "/receipt-scan" },
  { icon: Settings2, label: "帳簿・設定", path: "/reports" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-xl shadow-black/5">
          <h1 className="text-2xl font-semibold tracking-tight">ログインが必要です</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            ダッシュボードに入るには、先にアカウントへログインしてください。
          </p>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="mt-6 w-full"
          >
            ログインへ進む
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { toggleTheme, theme, taxMode } = useTheme();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border/70 bg-sidebar/90" disableTransition={isResizing}>
          <SidebarHeader className="border-b border-sidebar-border/70 px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80 transition hover:bg-accent"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Tax Flow
                  </div>
                  <div className="mt-1 truncate text-lg font-semibold tracking-tight">
                    {taxMode === "blue" ? "青色申告モード" : "白色申告モード"}
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-3 py-4">
            {!isCollapsed && (
              <div className="mb-4 rounded-2xl border border-border/70 bg-background/80 p-3 backdrop-blur">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Theme
                </div>
                <TaxModeToggle />
              </div>
            )}
            <SidebarMenu className="space-y-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-11 rounded-2xl px-3 font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/70 p-3">
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-3 py-2 group-data-[collapsible=icon]:hidden">
              <span className="text-xs font-medium text-muted-foreground">表示</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card transition hover:bg-accent"
                aria-label="Toggle light and dark"
              >
                {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-2 py-2 text-left transition hover:bg-accent/70 group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-10 w-10 border border-border/70">
                    <AvatarFallback className="text-xs font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium">{user?.name || "-"}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ログアウト</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (!isCollapsed) setIsResizing(true);
          }}
        />
      </div>

      <SidebarInset>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/82 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current View</p>
                <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                  {activeMenuItem?.label || "ダッシュボード"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {isMobile && <TaxModeToggle />}
              </div>
            </div>
          </header>
          <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </SidebarInset>
    </>
  );
}
