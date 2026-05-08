import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
import { PortfolioDataProvider } from '@/lib/PortfolioDataContext';
import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import Dashboard from '@/pages/Dashboard';
import Holdings from '@/pages/Holdings';
import Accounts from '@/pages/Accounts';
import DebtsAndBalances from '@/pages/DebtsAndBalances';
import Performance from '@/pages/Performance';
import Transactions from '@/pages/Transactions';
import Watchlist from '@/pages/Watchlist';
import Insights from '@/pages/Insights';
import Institutions from '@/pages/Institutions';
import Instructions from '@/pages/Instructions';
import PrivacyAndData from '@/pages/PrivacyAndData';
import ImportCenter from '@/pages/ImportCenter';
import TaxReport from '@/pages/TaxReport';
import Settings from '@/pages/Settings';
import Welcome from '@/pages/Welcome';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, isDemoMode } = useAuth();

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
        <Route path="/debts" element={<DebtsAndBalances />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/institutions" element={<Institutions />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/privacy" element={<PrivacyAndData />} />
        <Route path="/import" element={<ImportCenter />} />
        <Route path="/tax" element={<TaxReport />} />
        <Route path="/settings" element={<Settings />} />
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
                                <AuthenticatedApp />
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
