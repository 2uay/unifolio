import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DATA_IS_SAMPLE, SAMPLE_DATA_LABEL } from '@/lib/portfolioEngine';
import {
  LayoutDashboard, Briefcase, Building2, TrendingUp,
  ArrowLeftRight, Eye, Lightbulb, Zap, Link2, Settings, Menu, X,
  ChevronLeft, CreditCard, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useSidebar } from '@/lib/SidebarContext';
import UserMenu from '@/components/layout/UserMenu';
import CurrencySelector from '@/components/layout/CurrencySelector';
import PrivacyToggle from '@/components/layout/PrivacyToggle';
import DemoModeButton from '@/components/layout/DemoModeButton';
import DemoModeIndicator from '@/components/layout/DemoModeIndicator';
import Avatar from '@/components/shared/Avatar';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/holdings', label: 'Holdings', icon: Briefcase },
  { path: '/accounts', label: 'Accounts', icon: Building2 },
  { path: '/debts', label: 'Debts & Balances', icon: CreditCard },
  { path: '/prediction-markets', label: 'Prediction Markets', icon: BarChart3 },
  { path: '/performance', label: 'Performance', icon: TrendingUp },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/watchlist', label: 'Watchlist', icon: Eye },
  { path: '/insights', label: 'Insights', icon: Lightbulb },
  { path: '/trade', label: 'Trade Center', icon: Zap },
  { path: '/institutions', label: 'Institutions', icon: Link2 },
];

function useMarketStatus() {
  const isOpen = () => {
    const now = new Date();
    // Get Eastern Time components
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et = new Date(etStr);
    const day = et.getDay(); // 0=Sun, 6=Sat
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const open = 9 * 60 + 30;  // 9:30 AM
    const close = 16 * 60;      // 4:00 PM
    return day >= 1 && day <= 5 && totalMinutes >= open && totalMinutes < close;
  };

  const [marketOpen, setMarketOpen] = useState(isOpen);

  useEffect(() => {
    const interval = setInterval(() => setMarketOpen(isOpen()), 30000);
    return () => clearInterval(interval);
  }, []);

  return marketOpen;
}

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { collapsed, toggleCollapsed, desktopOpen, setDesktopOpen } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const marketOpen = useMarketStatus();

  return (
    <>
      {/* Fixed Top Bar - Always Visible */}
       <div className="hidden lg:flex fixed left-0 top-0 right-0 h-14 bg-card border-b border-border/30 z-50 items-center px-6 justify-between">
         <button 
           onClick={() => setDesktopOpen(!desktopOpen)}
           className="font-bold text-lg tracking-tight hover:opacity-80 transition-opacity cursor-pointer"
         >
           <span className="text-primary">Uni</span>folio
         </button>
         {/* Show controls in top bar when sidebar is closed */}
         {!desktopOpen && (
           <div className="flex items-center gap-2">
             <PrivacyToggle collapsed={false} />
             <CurrencySelector collapsed={false} />
           </div>
         )}
       </div>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border/30 flex items-center px-4">
        <button onClick={() => setMobileOpen(true)} className="p-2 icon-hover icon-hover-bg rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="ml-3 font-bold text-lg tracking-tight flex-1 hover:opacity-80 transition-opacity cursor-pointer">
          <span className="text-primary">Uni</span>folio
        </Link>
        <div className="flex items-center gap-1.5 ml-auto">
          <PrivacyToggle />
          <CurrencySelector />
          <DemoModeButton collapsed={false} />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-card border-r border-border/30 p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <Link to="/" onClick={() => setMobileOpen(false)} className="font-bold text-xl tracking-tight hover:opacity-80 transition-opacity cursor-pointer">
                <span className="text-primary">Uni</span>folio
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 icon-hover icon-hover-bg rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                       'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                       isActive
                         ? 'bg-primary/10 text-primary'
                         : 'text-muted-foreground hover:text-foreground hover:bg-secondary hover:translate-x-0.5'
                     )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      {desktopOpen && (
      <div className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-56 lg:flex lg:flex-col bg-card border-r border-border/30 z-40"
      style={{
        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Top: Close Button */}
        <div className="flex items-center justify-between h-14 border-b border-border/30 px-4 flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menu</span>
          <button
            onClick={() => setDesktopOpen(false)}
            className="p-1.5 icon-hover icon-hover-bg rounded-lg text-muted-foreground transition-all duration-150"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Middle: Navigation (scrollable) */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto min-h-0 overscroll-contain">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  'relative overflow-hidden',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary hover:translate-x-1 hover:shadow-lg hover:glow-pulse'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Utility Controls (pinned to bottom, non-scrolling) */}
        <div className="p-3 border-t border-border/30 flex-shrink-0 w-full flex flex-col gap-2.5">
           {/* Sample data badge */}
           {DATA_IS_SAMPLE && !collapsed && (
             <div className="text-[9px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-center font-medium tracking-wider uppercase">
               {SAMPLE_DATA_LABEL}
             </div>
           )}
           
           {/* Demo mode indicator */}
           <DemoModeIndicator collapsed={collapsed} />

          {/* Market status - centered */}
          <div
            className={cn('flex items-center justify-center gap-2 text-xs text-muted-foreground')}
            title={marketOpen ? 'US markets are open until 4:00 PM ET.' : 'US markets are closed. Standard hours are Mon–Fri, 9:30 AM–4:00 PM ET.'}
          >
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', marketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
            {!collapsed && <span className="truncate">{marketOpen ? 'Markets Open' : 'Markets Closed'}</span>}
          </div>

          {/* Privacy and currency controls - centered (only when sidebar is open) */}
          {desktopOpen && (
            <div className={cn('flex items-center justify-center gap-2 w-full')}>
               <PrivacyToggle collapsed={collapsed} />
               <CurrencySelector collapsed={collapsed} openUpward={true} />
             </div>
          )}

          {/* LOGGED-OUT STATE */}
          {!user && (
            <>
              {/* Sign In Button - centered */}
              <button
                onClick={() => window.location.href = '/login'}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'active:scale-95',
                  collapsed && 'px-2 text-xs'
                )}
              >
                {collapsed ? '→' : 'Sign In / Create'}
              </button>

              {/* Settings Button - centered */}
              <Link
                to="/settings"
                title={collapsed ? 'Settings' : undefined}
                className={cn(
                  'flex items-center justify-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-secondary hover:shadow-lg hover:glow-pulse',
                  'active:scale-95',
                  collapsed && 'px-2',
                  location.pathname === '/settings' && 'bg-primary/10 text-primary'
                )}
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Settings</span>}
              </Link>
            </>
          )}

          {/* LOGGED-IN STATE */}
          {user && (
            <>
              {/* Settings Button - centered */}
              <Link
                to="/settings"
                title={collapsed ? 'Settings' : undefined}
                className={cn(
                  'flex items-center justify-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-secondary hover:shadow-lg hover:glow-pulse',
                  'active:scale-95',
                  collapsed && 'px-2',
                  location.pathname === '/settings' && 'bg-primary/10 text-primary'
                )}
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Settings</span>}
              </Link>

              {/* User profile section */}
              {!collapsed && (
                <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer min-w-0">
                  <Avatar user={user} size="xs" showRing={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{user?.full_name || user?.email}</p>
                    {user?.full_name && <p className="text-[10px] text-muted-foreground/70 truncate">{user?.email}</p>}
                  </div>
                </div>
              )}
              {collapsed && (
                <div className="flex items-center justify-center px-2 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer" title={user?.full_name || user?.email}>
                  <Avatar user={user} size="xs" showRing={false} />
                </div>
              )}
            </>
          )}
        </div>
          </div>
          )}
          </>
          );
          }