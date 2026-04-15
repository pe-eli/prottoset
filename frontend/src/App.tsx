import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { WaBlastProvider } from './contexts/WaBlastContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { WaBlastIndicator } from './components/WaBlastIndicator';
import { PaywallModal } from './features/subscriptions/PaywallModal';
import { authAPI } from './features/auth/auth.api';
import type { AuthUser } from './features/auth/auth.api';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';
import { PackagesQuotePage } from './pages/PackagesQuotePage';
import { LeadsHub } from './pages/LeadsHub';
import { LeadsDashboard } from './pages/LeadsDashboard';
import { EmailBlastPage } from './pages/EmailBlastPage';
import { WhatsAppBlastPage } from './pages/WhatsAppBlastPage';
import { WhatsAppConnectPage } from './pages/WhatsAppConnectPage';
import { ContactsPage } from './pages/ContactsPage';
import { LoginPage } from './pages/LoginPage';
import { PricingPage } from './pages/PricingPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfUsePage } from './pages/TermsOfUsePage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

interface ProtectedLayoutProps {
  user: AuthUser;
  onLogout: () => void;
}

function ProtectedLayout({ user, onLogout }: ProtectedLayoutProps) {
  return (
    <SubscriptionProvider>
      <Header user={user} onLogout={onLogout} />
      <main className="flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      <WaBlastIndicator />
      <PaywallModal />
    </SubscriptionProvider>
  );
}

function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;
    authAPI
      .me()
      .then(({ data }) => {
        if (!mounted) return;
        setUser(data.user);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      })
      .finally(() => {
        if (!mounted) return;
        setCheckingAuth(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-border border-t-brand-400 animate-spin" />
          <p className="mt-3 text-sm text-text-secondary">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <WaBlastProvider>
        <div className="min-h-screen flex flex-col bg-background">
          <Routes>
            <Route
              index
              element={user ? <Navigate to="/home" replace /> : <LandingPage />}
            />
            <Route
              path="/login"
              element={user ? <Navigate to="/home" replace /> : <LoginPage onAuthenticated={(u) => setUser(u)} />}
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
            <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />

            <Route
              element={
                user
                  ? <ProtectedLayout user={user} onLogout={() => setUser(null)} />
                  : <Navigate to="/" replace />
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/novo" element={<Navigate to="/pacotes" replace />} />
              <Route path="/pacotes" element={<PackagesQuotePage />} />
              <Route path="/leads" element={<LeadsHub />} />
              <Route path="/leads/prospeccao" element={<LeadsDashboard />} />
              <Route path="/leads/disparos" element={<EmailBlastPage />} />
              <Route path="/leads/whatsapp" element={<WhatsAppBlastPage />} />
              <Route path="/leads/whatsapp/connect" element={<WhatsAppConnectPage />} />
              <Route path="/leads/contatos" element={<ContactsPage />} />
            </Route>

            <Route path="*" element={<Navigate to={user ? '/home' : '/'} replace />} />
          </Routes>
        </div>
      </WaBlastProvider>
    </BrowserRouter>
  );
}

export default App;
