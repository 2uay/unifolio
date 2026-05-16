import { useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SidebarProvider } from '@/lib/SidebarContext';
import { CurrencyProvider } from '@/lib/CurrencyContext';
import { PrivacyProvider } from '@/lib/PrivacyContext.jsx';
import { ResearchWindowProvider } from '@/lib/ResearchWindowContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { LiveDataProvider } from '@/lib/LiveDataContext';
import { SecondaryColorsProvider } from '@/lib/SecondaryColorsContext';
import { AccentBarsProvider } from '@/lib/AccentBarsContext';
import { TopbarLogoProvider } from '@/lib/TopbarLogoContext';
import { StarredStocksProvider } from '@/lib/StarredStocksContext';
import { ProfilePictureProvider } from '@/lib/ProfilePictureContext';
import { FloatingHoldingsProvider } from '@/lib/FloatingHoldingsContext';
import { PortfolioDataProvider } from '@/lib/PortfolioDataContext';
import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import CustomCursor from '@/components/shared/CustomCursor';
import Dashboard from '@/pages/Dashboard';
import Holdings from '@/pages/Holdings';
import Accounts from '@/pages/Accounts';
import Performance from '@/pages/Performance';
import Transactions from '@/pages/Transactions';
import Insights from '@/pages/Insights';
// Institutions page removed — connection management lives in Import Center now.
// import Institutions from '@/pages/Institutions';
import Instructions from '@/pages/Instructions';
import PrivacyAndData from '@/pages/PrivacyAndData';
import ImportCenter from '@/pages/ImportCenter';
import TaxReport from '@/pages/TaxReport';
import TaxOptimizer from '@/pages/TaxOptimizer';
import HarvestCenter from '@/pages/HarvestCenter';
import BehavioralInsights from '@/pages/BehavioralInsights';
import Settings from '@/pages/Settings';
import Profile from '@/pages/Profile';
import ProLanding from '@/pages/ProLanding';
import Plans from '@/pages/Plans';
import ResetPassword from '@/pages/ResetPassword';
import Welcome from '@/pages/Welcome';
import Community from '@/pages/Community';
import Learn from '@/pages/Learn';
import Checkout from '@/pages/Checkout';
import CheckoutSuccess from '@/pages/CheckoutSuccess';
import HouseholdAccept from '@/pages/HouseholdAccept';

const isProDomain = typeof window !== 'undefined' &&
  (window.location.hostname === 'unifolio.pro' || window.location.hostname === 'www.unifolio.pro');

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, isDemoMode } = useAuth();
  const location = useLocation();

  // unifolio.pro shows the Plans/pricing page (or the Checkout flow when
  // the CTA was clicked) regardless of auth state.
  if (isProDomain) {
    if (location.pathname === '/checkout') return <Checkout />;
    if (location.pathname === '/checkout/success') return <CheckoutSuccess />;
    return <Plans />;
  }

  // Password reset link — must be reachable without auth
  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated and not in demo mode → show Welcome page
  if (!isAuthenticated && !isDemoMode) {
    return <Welcome />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/holdings" element={<Holdings />} />
        <Route path="/accounts" element={<Accounts />} />
        {/* <Route path="/debts" element={<DebtsAndBalances />} /> */}
        <Route path="/performance" element={<Performance />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/insights" element={<Insights />} />
        {/* /institutions removed — use /import for connection management */}
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/privacy" element={<PrivacyAndData />} />
        <Route path="/community" element={<Community />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/household/accept" element={<HouseholdAccept />} />
        <Route path="/import" element={<ImportCenter />} />
        <Route path="/tax" element={<TaxReport />} />
        <Route path="/optimize" element={<TaxOptimizer />} />
        <Route path="/harvest" element={<HarvestCenter />} />
        <Route path="/behavioral" element={<BehavioralInsights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SecondaryColorsProvider>
          <AccentBarsProvider>
            <TopbarLogoProvider>
            <StarredStocksProvider>
              <AuthProvider>
                <QueryClientProvider client={queryClientInstance}>
                  <PortfolioDataProvider>
                    <LiveDataProvider>
                    <Router>
                      <SidebarProvider>
                        <CurrencyProvider>
                          <PrivacyProvider>
                            <ResearchWindowProvider>
                              <ProfilePictureProvider>
                                <FloatingHoldingsProvider>
                                  <CustomCursor />
                                  <AuthenticatedApp />
                                </FloatingHoldingsProvider>
                              </ProfilePictureProvider>
                            </ResearchWindowProvider>
                          </PrivacyProvider>
                        </CurrencyProvider>
                      </SidebarProvider>
                    </Router>
                    </LiveDataProvider>
                  </PortfolioDataProvider>
                  <Toaster />
                </QueryClientProvider>
              </AuthProvider>
            </StarredStocksProvider>
            </TopbarLogoProvider>
          </AccentBarsProvider>
        </SecondaryColorsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
