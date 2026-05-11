import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Building2, TrendingUp,
  ArrowLeftRight, Lightbulb, Zap, Link2, Settings, X,
  CreditCard, LogOut, UserCircle, LogIn, ChevronUp, BookOpen, Shield, Upload, Receipt, Gem, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useSidebar } from '@/lib/SidebarContext';
import CurrencySelector from '@/components/layout/CurrencySelector';
import PrivacyToggle from '@/components/layout/PrivacyToggle';
import DemoModeButton from '@/components/layout/DemoModeButton';
import DemoModeIndicator from '@/components/layout/DemoModeIndicator';
import Avatar from '@/components/shared/Avatar';
import UnifolioLogo from '@/components/shared/UnifolioLogo';
import UnifolioWheelLogo from '@/components/shared/UnifolioWheelLogo';
import { useTopbarLogo } from '@/lib/TopbarLogoContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/holdings', label: 'Holdings', icon: Briefcase },
  { path: '/accounts', label: 'Accounts', icon: Building2 },
  { path: '/debts', label: 'Debts & Balances', icon: CreditCard },
  { path: '/performance', label: 'Performance', icon: TrendingUp },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/insights', label: 'Insights', icon: Lightbulb },
  { path: '/institutions', label: 'Institutions', icon: Link2 },
  { path: '/import', label: 'Import Center', icon: Upload },
  { path: '/tax', label: 'Tax Report', icon: Receipt },
];

const utilityNavItems = [
  { path: '/plans', label: 'Plans & Pricing', icon: Gem, href: 'https://unifolio.pro' },
  { path: '/community', label: 'Community', icon: Users },
  { path: '/instructions', label: 'Instructions', icon: BookOpen },
  { path: '/privacy', label: 'Privacy & Data', icon: Shield },
];

function useMarketStatus() {
  const isOpen = () => {
    const now = new Date();
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et = new Date(etStr);
    const day = et.getDay();
    const totalMinutes = et.getHours() * 60 + et.getMinutes();
    return day >= 1 && day <= 5 && totalMinutes >= 570 && totalMinutes < 960;
  };
  const [marketOpen, setMarketOpen] = useState(isOpen);
  useEffect(() => {
    const id = setInterval(() => setMarketOpen(isOpen()), 30000);
    return () => clearInterval(id);
  }, []);
  return marketOpen;
}

// Profile popover — shown above the account button when clicked
function ProfilePopover({ user, onClose, onSignOut, onNavigate, position = 'above' }) {
  const ref = useRef(null);
  const displayName = user?.user_metadata?.full_name || user?.full_name || user?.email || 'Account';
  const email = user?.email || '';

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 w-56',
        position === 'above' ? 'bottom-full left-0 right-0 mb-2' : 'top-full right-0 mt-2'
      )}
    >
      {/* User info header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-secondary/30">
        <Avatar user={user} size="sm" showRing={true} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
          {email && displayName !== email && (
            <p className="text-[11px] text-muted-foreground truncate">{email}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-1.5 space-y-0.5">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { onNavigate('/profile'); onClose(); }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors text-left"
        >
          <UserCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          My Profile
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { onNavigate('/settings'); onClose(); }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors text-left"
        >
          <Settings className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          Settings
        </button>
      </div>

      <div className="border-t border-border/50 p-1.5">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { onSignOut(); onClose(); }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isDemoMode, exitDemoMode } = useAuth();
  const { isSample } = usePortfolioData();
  const { collapsed, desktopOpen, setDesktopOpen } = useSidebar();
  const { logoVisible } = useTopbarLogo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [topbarProfileOpen, setTopbarProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const marketOpen = useMarketStatus();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await Promise.all([
        logout(),
        new Promise(resolve => setTimeout(resolve, 450)),
      ]);
      navigate('/');
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignIn = async () => {
    if (isDemoMode) {
      exitDemoMode();
      navigate('/');
      return;
    }
    await logout(); // clears any stale session / demo state
    navigate('/');
  };

  return (
    <>
      {signingOut && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-2xl flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <div>
              <p className="text-sm font-semibold text-foreground">Signing out...</p>
              <p className="text-xs text-muted-foreground">Clearing your local session</p>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Top Bar - Desktop */}
      <div className="hidden lg:grid fixed left-0 top-0 right-0 h-14 bg-card border-b border-border/30 z-50 items-center px-6" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        {/* Left: sidebar toggle + status indicator */}
        <button
          onClick={() => setDesktopOpen(!desktopOpen)}
          className="group cursor-pointer flex items-center gap-1.5 justify-self-start hover:!translate-y-0 hover:!text-inherit"
        >
          <UnifolioWheelLogo />
          <Zap className={cn('w-3 h-3 flex-shrink-0 animate-pulse', marketOpen ? 'text-green-500' : 'text-red-500')} />
        </button>

        {/* Center: Unifolio wordmark (togglable) */}
        {logoVisible ? (
          <Link to="/" className="group font-bold text-lg tracking-tight flex items-center justify-center">
            <UnifolioLogo />
          </Link>
        ) : (
          <div />
        )}

        {/* Right: controls */}
        <div className="flex items-center gap-2 justify-self-end">
          <PrivacyToggle collapsed={false} />
          <CurrencySelector collapsed={false} />
          {user && (
            <div className="relative flex-shrink-0">
              {topbarProfileOpen && (
                <ProfilePopover
                  user={user}
                  position="below"
                  onClose={() => setTopbarProfileOpen(false)}
                  onSignOut={handleSignOut}
                  onNavigate={navigate}
                />
              )}
              <button
                onClick={() => setTopbarProfileOpen(o => !o)}
                className="rounded-full hover:ring-2 hover:ring-primary/50 transition-all"
                title="Account"
              >
                <Avatar user={user} size="xs" showRing={false} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border/30 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="group cursor-pointer flex items-center gap-1.5 p-1.5 rounded-lg icon-hover icon-hover-bg hover:!translate-y-0 hover:!text-inherit"
          aria-label="Open navigation"
        >
          <UnifolioWheelLogo />
          <Zap className={cn('w-3 h-3 flex-shrink-0 animate-pulse', marketOpen ? 'text-green-500' : 'text-red-500')} />
        </button>
        <div className="flex items-center gap-1.5 ml-auto">
          <PrivacyToggle />
          <CurrencySelector />
          <DemoModeButton collapsed={false} />
          {user && (
            <div className="relative flex-shrink-0">
              {topbarProfileOpen && (
                <ProfilePopover
                  user={user}
                  position="below"
                  onClose={() => setTopbarProfileOpen(false)}
                  onSignOut={handleSignOut}
                  onNavigate={navigate}
                />
              )}
              <button
                onClick={() => setTopbarProfileOpen(o => !o)}
                className="rounded-full hover:ring-2 hover:ring-primary/50 transition-all"
                title="Account"
              >
                <Avatar user={user} size="xs" showRing={false} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-card border-r border-border/30 flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Drawer header */}
            <div className="flex items-center justify-between h-14 border-b border-border/30 px-4 flex-shrink-0">
              <Link to="/" onClick={() => setMobileOpen(false)} className="group font-bold text-xl tracking-tight cursor-pointer flex items-center gap-1.5">
                <UnifolioWheelLogo />
                <Zap className={cn('w-3 h-3 flex-shrink-0 animate-pulse', marketOpen ? 'text-green-500' : 'text-red-500')} />
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 icon-hover icon-hover-bg rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer footer */}
            <div className="p-3 border-t border-border/30 flex-shrink-0 space-y-2">
              {utilityNavItems.map(item => {
                const isActive = location.pathname === item.path;
                const isPlans = item.path === '/plans';
                const cls = cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : isPlans
                      ? 'text-primary/80 hover:text-primary hover:bg-primary/8 border border-primary/20 hover:border-primary/35'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                );
                return item.href ? (
                  <a
                    key={item.path}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className={cls}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cls}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
              {isSample && (
                <div className="text-[9px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-center font-medium tracking-wider uppercase">
                  Sample Data
                </div>
              )}
              {/* Utility controls */}
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <PrivacyToggle collapsed={false} />
                <CurrencySelector collapsed={false} />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <div className={cn('w-1.5 h-1.5 rounded-full', marketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
                  <span>{marketOpen ? 'Open' : 'Closed'}</span>
                </div>
              </div>

              {/* Settings */}
              <Link
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-150',
                  location.pathname === '/settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                Settings
              </Link>

              {user ? (
                /* Logged in: user card with profile + sign out */
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <button
                    onClick={() => { navigate('/profile'); setMobileOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2.5 w-full hover:bg-secondary transition-colors text-left"
                  >
                    <Avatar user={user} size="xs" showRing={false} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {user?.user_metadata?.full_name || user?.email}
                      </p>
                      {user?.user_metadata?.full_name && (
                        <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                      )}
                    </div>
                    <UserCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </button>
                  <div className="border-t border-border/50">
                    <button
                      onClick={() => { handleSignOut(); setMobileOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 w-full text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                /* Logged out: sign in button */
                <button
                  onClick={() => { handleSignIn(); setMobileOpen(false); }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 w-full rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In / Create Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      {desktopOpen && (
        <div className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-56 lg:flex lg:flex-col bg-card border-r border-border/30 z-40"
          style={{ transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}>

          {/* Sidebar header */}
          <div className="flex items-center justify-between h-14 border-b border-border/30 px-4 flex-shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menu</span>
            <div className="flex items-center gap-2">
              {user && <Avatar user={user} size="xs" showRing={false} />}
              <button
                onClick={() => setDesktopOpen(false)}
                className="p-1.5 icon-hover icon-hover-bg rounded-lg text-muted-foreground transition-all duration-150"
                title="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation */}
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

          {/* Bottom utility area */}
          <div className="p-3 border-t border-border/30 flex-shrink-0 flex flex-col gap-2">
            {utilityNavItems.map(item => {
              const isActive = location.pathname === item.path;
              const isPlans = item.path === '/plans';
              const cls = cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : isPlans
                    ? 'text-primary/80 hover:text-primary hover:bg-primary/8 border border-primary/20 hover:border-primary/35'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              );
              return item.href ? (
                <a
                  key={item.path}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={collapsed ? item.label : undefined}
                  className={cls}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </a>
              ) : (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={cls}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}

            {isSample && !collapsed && (
              <div className="text-[9px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-center font-medium tracking-wider uppercase">
                Sample Data
              </div>
            )}

            <DemoModeIndicator collapsed={collapsed} />

            {/* Market status */}
            <div
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
              title={marketOpen ? 'US markets are open until 4:00 PM ET.' : 'US markets are closed. Mon–Fri 9:30 AM–4:00 PM ET.'}
            >
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', marketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
              {!collapsed && <span>{marketOpen ? 'Markets Open' : 'Markets Closed'}</span>}
            </div>

            {/* Privacy + Currency */}
            <div className="flex items-center justify-center gap-2">
              <PrivacyToggle collapsed={collapsed} />
              <CurrencySelector collapsed={collapsed} openUpward={true} />
            </div>

            {/* Account section */}
            <div className="relative">
              {profileOpen && user && (
                <ProfilePopover
                  user={user}
                  onClose={() => setProfileOpen(false)}
                  onSignOut={handleSignOut}
                  onNavigate={navigate}
                />
              )}

              {!user && (
                <Link
                  to="/settings"
                  title={collapsed ? 'Settings' : undefined}
                  className={cn(
                    'flex items-center justify-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium transition-colors mb-1',
                    location.pathname === '/settings'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <Settings className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>Settings</span>}
                </Link>
              )}

              {user ? (
                /* Logged in: clickable account button */
                <button
                  onClick={() => setProfileOpen(p => !p)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-colors',
                    'hover:bg-secondary border border-transparent hover:border-border/50',
                    profileOpen && 'bg-secondary border-border/50',
                    collapsed && 'justify-center'
                  )}
                >
                  <Avatar user={user} size="xs" showRing={false} />
                  {!collapsed && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-semibold text-foreground truncate leading-tight">
                          {user?.user_metadata?.full_name || user?.email}
                        </p>
                        {user?.user_metadata?.full_name && (
                          <p className="text-[10px] text-muted-foreground/70 truncate">{user?.email}</p>
                        )}
                      </div>
                      <ChevronUp className={cn('w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200', !profileOpen && 'rotate-180')} />
                    </>
                  )}
                </button>
              ) : (
                /* Logged out: sign in button */
                <button
                  onClick={handleSignIn}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95',
                    collapsed && 'px-2'
                  )}
                >
                  <LogIn className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>Sign In</span>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
