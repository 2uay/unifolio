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
import { StarredStocksProvider } from '@/lib/StarredStocksContext';
import { ProfilePictureProvider } from '@/lib/ProfilePictureContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import Dashboard from '@/pages/Dashboard';
import Holdings from '@/pages/Holdings';
import Accounts from '@/pages/Accounts';
import DebtsAndBalances from '@/pages/DebtsAndBalances';
import PredictionMarkets from '@/pages/PredictionMarkets';
import Performance from '@/pages/Performance';
import Transactions from '@/pages/Transactions';
import Watchlist from '@/pages/Watchlist';
import Insights from '@/pages/Insights';
import TradeCenter from '@/pages/TradeCenter';
import Institutions from '@/pages/Institutions';
import Settings from '@/pages/Settings';
import Welcome from '@/pages/Welcome';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, isDemoMode } = useAuth();

  // Show loading spinner
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle critical auth errors (user not registered)
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // If not authenticated and in demo mode, show welcome page to allow entering demo
  if (!isAuthenticated && !isDemoMode) {
    return <Welcome />;
  }

  // Render app (works for both authenticated users and demo mode)
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/holdings" element={<Holdings />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/debts" element={<DebtsAndBalances />} />
        <Route path="/prediction-markets" element={<PredictionMarkets />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/trade" element={<TradeCenter />} />
        <Route path="/institutions" element={<Institutions />} />
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
        <LiveDataProvider>
          <SecondaryColorsProvider>
            <AccentBarsProvider>
              <StarredStocksProvider>
                <AuthProvider>
                  <QueryClientProvider client={queryClientInstance}>
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
                    <Toaster />
                  </QueryClientProvider>
                </AuthProvider>
              </StarredStocksProvider>
              </AccentBarsProvider>
          </SecondaryColorsProvider>
        </LiveDataProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App