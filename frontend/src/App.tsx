import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { FeatureRail } from './components/layout/FeatureRail';
import { WaBlastProvider } from './contexts/WaBlastContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ToastProvider } from './contexts/ToastContext';
import { WaBlastIndicator } from './components/WaBlastIndicator';
import { PaywallModal } from './features/subscriptions/PaywallModal';
import { authAPI } from './features/auth/auth.api';
import type { AuthUser } from './features/auth/auth.api';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';
import { LeadsDashboard } from './pages/LeadsDashboard';
import { EmailBlastPage } from './pages/EmailBlastPage';
import { WhatsAppBlastPage } from './pages/WhatsAppBlastPage';
import { WhatsAppConnectPage } from './pages/WhatsAppConnectPage';
import { ContactsPage } from './pages/ContactsPage';
import { LoginPage } from './pages/LoginPage';
import { PricingPage } from './pages/PricingPage';
import { BillingPage } from './pages/BillingPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfUsePage } from './pages/TermsOfUsePage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SettingsPage } from './pages/SettingsPage';
import { clearLegacySavedPromptsStorage } from './features/whatsapp/saved-prompts.storage';
import { resetApiSessionState } from './lib/axios';

type SessionTransition = 'login' | 'logout';

interface ProtectedLayoutProps {
  user: AuthUser;
  onLogout: () => Promise<void> | void;
  logoutPending: boolean;
}

function ProtectedLayout({ user, onLogout, logoutPending }: ProtectedLayoutProps) {
  const location = useLocation();
  const isMainHub = location.pathname === '/home';
  const showFeatureRail = [
    '/leads/prospeccao',
    '/leads/contatos',
    '/leads/disparos',
    '/leads/whatsapp',
  ].some((path) => location.pathname.startsWith(path));

  return (
    <SubscriptionProvider>
      {isMainHub && <Header user={user} onLogout={onLogout} logoutPending={logoutPending} />}
      {showFeatureRail && <FeatureRail />}
      <main className={`flex-1 px-4 py-8 ${showFeatureRail ? 'lg:pl-24' : ''}`}>
        <Outlet context={{ user }} />
      </main>
      <Footer />
      <WaBlastIndicator />
      <PaywallModal />
    </SubscriptionProvider>
  );
}

function SessionTransitionOverlay({ mode }: { mode: SessionTransition }) {
  const message = mode === 'logout'
    ? 'Encerrando sua sessao com seguranca...'
    : 'Preparando seu ambiente...';

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="rounded-2xl border border-border-light bg-surface-elevated px-6 py-5 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-border border-t-brand-400 animate-spin" />
        <p className="mt-3 text-sm font-medium text-text-secondary">{message}</p>
      </div>
    </div>
  );
}

function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionTransition, setSessionTransition] = useState<SessionTransition | null>(null);

  const handleAuthenticated = useCallback(async (nextUser: AuthUser) => {
    setSessionTransition('login');
    try {
      resetApiSessionState();
      clearLegacySavedPromptsStorage();
      setUser(nextUser);
    } finally {
      setSessionTransition(null);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setSessionTransition('logout');
    try {
      await authAPI.logout();
    } catch {
      // Local logout is always forced even if the request fails.
    } finally {
      resetApiSessionState();
      clearLegacySavedPromptsStorage();
      setUser(null);
      setSessionTransition(null);
    }
  }, []);

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

  useEffect(() => {
    const onSessionExpired = () => {
      resetApiSessionState();
      clearLegacySavedPromptsStorage();
      setUser(null);
    };
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
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
      <ToastProvider>
      <WaBlastProvider key={user?.id ?? 'guest'}>
        <div className="min-h-screen flex flex-col bg-background">
          {sessionTransition ? <SessionTransitionOverlay mode={sessionTransition} /> : null}
          <Routes>
            <Route
              index
              element={user ? <Navigate to="/home" replace /> : <LandingPage />}
            />
            <Route
              path="/login"
              element={user ? <Navigate to="/home" replace /> : <LoginPage onAuthenticated={handleAuthenticated} />}
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/pricing"
              element={
                <SubscriptionProvider key={`pricing-${user?.id ?? 'guest'}`}>
                  <PricingPage />
                </SubscriptionProvider>
              }
            />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
            <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
            <Route path="/landing" element={<LandingPage isAuthenticated={!!user} />} />

            <Route
              element={
                user
                  ? <ProtectedLayout key={user.id} user={user} onLogout={handleLogout} logoutPending={sessionTransition === 'logout'} />
                  : <Navigate to="/" replace />
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/novo" element={<Navigate to="/home" replace />} />
              <Route path="/pacotes" element={<Navigate to="/home" replace />} />
              <Route path="/leads" element={<Navigate to="/home" replace />} />
              <Route path="/leads/prospeccao" element={<LeadsDashboard />} />
              <Route path="/leads/disparos" element={<EmailBlastPage />} />
              <Route path="/leads/whatsapp" element={<WhatsAppBlastPage />} />
              <Route path="/leads/whatsapp/connect" element={<WhatsAppConnectPage />} />
              <Route path="/leads/contatos" element={<ContactsPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/assinatura" element={<Navigate to="/pricing" replace />} />
            </Route>

            <Route path="*" element={<Navigate to={user ? '/home' : '/'} replace />} />
          </Routes>
        </div>
      </WaBlastProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
