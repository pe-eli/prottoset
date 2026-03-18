import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { NewQuotePage } from './pages/NewQuotePage';
import { PackagesQuotePage } from './pages/PackagesQuotePage';
import { LeadsHub } from './pages/LeadsHub';
import { LeadsDashboard } from './pages/LeadsDashboard';
import { EmailBlastPage } from './pages/EmailBlastPage';
import { WhatsAppBlastPage } from './pages/WhatsAppBlastPage';
import { ContactsPage } from './pages/ContactsPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/novo" element={<NewQuotePage />} />
            <Route path="/pacotes" element={<PackagesQuotePage />} />
            <Route path="/leads" element={<LeadsHub />} />
            <Route path="/leads/prospeccao" element={<LeadsDashboard />} />
            <Route path="/leads/disparos" element={<EmailBlastPage />} />
            <Route path="/leads/whatsapp" element={<WhatsAppBlastPage />} />
            <Route path="/leads/contatos" element={<ContactsPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
