import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PersonalizedService } from './components/PersonalizedService';
import { TexasMapSection } from './components/TexasMapSection';
import { MobileAppSection } from './components/MobileAppSection';
import { ArticlesSection } from './components/ArticlesSection';
import { ResourcesSection } from './components/ResourcesSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { CustomerStoryAndNewsletter } from './components/CustomerStoryAndNewsletter';
import { ScamAlertBanner } from './components/ScamAlertBanner';
import { Footer } from './components/Footer';
import { ContactPage } from './components/ContactPage';
import { OpenAccountPage } from './components/OpenAccountPage';
import { LoginModal } from './components/LoginModal';
import { CalculatorModal } from './components/CalculatorModal';
import { LocationSearchModal } from './components/LocationSearchModal';
import { ArticleModal } from './components/ArticleModal';
import { Article } from './types';

// Banking & Auth
import { useBankingAuth } from './context/BankingAuthContext';
import { SignInPage } from './components/auth/SignInPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { NewDeviceVerificationScreen } from './components/auth/NewDeviceVerificationScreen';
import { BankingLayout, BankingTab } from './components/banking/BankingLayout';
import { BankingHomeScreen } from './components/banking/BankingHomeScreen';
import { BankingOverview } from './components/banking/BankingOverview';
import { AccountsView } from './components/banking/AccountsView';
import { TransfersView } from './components/banking/TransfersView';
import { BillsAndPaymentsView } from './components/banking/BillsAndPaymentsView';
import { CardsView } from './components/banking/CardsView';
import { LoansView } from './components/banking/LoansView';
import { SavingsGoalsView } from './components/banking/SavingsGoalsView';
import { TransactionsView } from './components/banking/TransactionsView';
import { StatementsView } from './components/banking/StatementsView';
import { NotificationsView } from './components/banking/NotificationsView';
import { ProfileSettingsView } from './components/banking/ProfileSettingsView';
import { SettingsView } from './components/banking/SettingsView';
import { SupportView } from './components/banking/SupportView';
import { TransactionModal } from './components/banking/TransactionModal';
import { PostLoginPinSetupManager } from './components/banking/PostLoginPinSetupManager';
import { BankTransaction } from './types/banking';

import { FooterContentPage } from './components/footer/FooterContentPage';
import { FOOTER_PAGES } from './data/footerContent';
import { CipherControlPanel } from './components/cipher/CipherControlPanel';
import { useTheme } from './context/ThemeContext';
import lightLogo from './assets/images/aurelith_logo_light.png';
import darkLogo from './assets/images/aurelith_logo_dark.png';

type PageType = 'home' | 'contact' | 'open-account' | 'sign-in' | 'register' | 'banking' | 'footer-page' | 'cipher';

export default function App() {
  const { isDark } = useTheme();
  const { user, loading, pendingVerification, cancelDeviceVerification } = useBankingAuth();

  const VALID_BANKING_TABS: BankingTab[] = [
    'home', 'overview', 'accounts', 'transfers', 'bills', 'cards',
    'loans', 'savings', 'transactions', 'statements', 'notifications',
    'profile', 'settings', 'support'
  ];

  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [currentBankingTab, setCurrentBankingTab] = useState<BankingTab>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      if (pathname.startsWith('/banking') || pathname.startsWith('/dashboard')) {
        const parts = pathname.split('/').filter(Boolean);
        const subTab = parts[1] as BankingTab;
        if (subTab && VALID_BANKING_TABS.includes(subTab)) {
          return subTab;
        }
      }
      try {
        const savedTab = sessionStorage.getItem('ar_active_banking_tab') as BankingTab;
        if (savedTab && VALID_BANKING_TABS.includes(savedTab)) {
          return savedTab;
        }
      } catch {}
    }
    return 'home';
  });
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [selectedAccountType, setSelectedAccountType] = useState<string>('Premier Checking');

  const [loginOpen, setLoginOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeFooterPageId, setActiveFooterPageId] = useState<string>('who-we-are');

  // Tab selection handler that updates state, sessionStorage, and browser URL history
  const handleSelectBankingTab = (tab: BankingTab) => {
    setCurrentBankingTab(tab);
    try {
      sessionStorage.setItem('ar_active_banking_tab', tab);
      const targetUrl = tab === 'home' ? '/banking' : `/banking/${tab}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    } catch {}
  };

  // Synchronize URL pathname & hash with application views (on initial mount, popstate, and hashchange)
  useEffect(() => {
    const syncRouteFromLocation = () => {
      const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      const hash = window.location.hash.replace('#', '').toLowerCase();

      // 1. Check footer pages via hash or path (e.g. /who-we-are or #who-we-are)
      const cleanPathId = pathname.replace(/^\//, '');
      if (hash && FOOTER_PAGES[hash]) {
        setActiveFooterPageId(hash);
        setCurrentPage('footer-page');
        return;
      }
      if (cleanPathId && FOOTER_PAGES[cleanPathId]) {
        setActiveFooterPageId(cleanPathId);
        setCurrentPage('footer-page');
        return;
      }

      // 2. Check primary application routes
      if (pathname === '/cipher' || pathname.startsWith('/cipher')) {
        setCurrentPage('cipher');
      } else if (pathname === '/sign-in' || pathname === '/login') {
        setCurrentPage('sign-in');
      } else if (pathname === '/register' || pathname === '/signup') {
        setCurrentPage('register');
      } else if (pathname === '/open-account' || pathname === '/accounts/open') {
        setCurrentPage('open-account');
      } else if (pathname === '/contact' || pathname === '/support') {
        setCurrentPage('contact');
      } else if (pathname.startsWith('/banking') || pathname.startsWith('/dashboard')) {
        // Parse banking sub-tab if specified (e.g. /banking/transfers)
        const parts = pathname.split('/').filter(Boolean);
        const subTab = parts[1] as BankingTab;
        if (subTab && VALID_BANKING_TABS.includes(subTab)) {
          setCurrentBankingTab(subTab);
          try {
            sessionStorage.setItem('ar_active_banking_tab', subTab);
          } catch {}
        } else {
          try {
            const saved = sessionStorage.getItem('ar_active_banking_tab') as BankingTab;
            if (saved && VALID_BANKING_TABS.includes(saved)) {
              setCurrentBankingTab(saved);
            }
          } catch {}
        }
        setCurrentPage('banking');
      } else {
        // Default to home for '/' or unrecognized paths
        setCurrentPage('home');
      }
    };

    syncRouteFromLocation();
    window.addEventListener('popstate', syncRouteFromLocation);
    window.addEventListener('hashchange', syncRouteFromLocation);
    return () => {
      window.removeEventListener('popstate', syncRouteFromLocation);
      window.removeEventListener('hashchange', syncRouteFromLocation);
    };
  }, []);

  // Automatic session restoration & strict routing access synchronization
  useEffect(() => {
    if (loading) return;

    // 1. Authenticated customer & Cipher operator session restoration
    if (user && !pendingVerification) {
      const isCipher = user.role === 'cipher' || user.email?.toLowerCase() === 'contact.cga.usa@gmail.com';
      const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';

      if (isCipher) {
        // Cipher administrative identity must ALWAYS be in Cipher Control Panel (/cipher)
        // Cipher is strictly isolated from ordinary customer banking views
        if (currentPage !== 'cipher' || pathname !== '/cipher') {
          setCurrentPage('cipher');
          try {
            window.history.replaceState(null, '', '/cipher');
          } catch {}
        }
      } else {
        // ORDINARY CUSTOMER
        // 1. Strict separation: Ordinary customers must NEVER access Cipher Control Panel
        if (currentPage === 'cipher' || pathname === '/cipher' || pathname.startsWith('/cipher')) {
          const targetTab = currentBankingTab || 'home';
          const targetUrl = targetTab === 'home' ? '/banking' : `/banking/${targetTab}`;
          setCurrentPage('banking');
          try {
            window.history.replaceState(null, '', targetUrl);
          } catch {}
          return;
        }

        // 2. Persistent Customer Login:
        // When customer refreshes or reopens at '/', '/sign-in', '/register', etc.
        // Keep them inside their authenticated banking dashboard, preserving their exact sub-tab
        if (pathname === '/' || pathname === '/sign-in' || pathname === '/login' || pathname === '/register') {
          let targetTab: BankingTab = currentBankingTab;
          try {
            const saved = sessionStorage.getItem('ar_active_banking_tab') as BankingTab;
            if (saved && VALID_BANKING_TABS.includes(saved)) {
              targetTab = saved;
              setCurrentBankingTab(saved);
            }
          } catch {}

          setCurrentPage('banking');
          try {
            const targetUrl = targetTab === 'home' ? '/banking' : `/banking/${targetTab}`;
            window.history.replaceState(null, '', targetUrl);
          } catch {}
        } else if (pathname.startsWith('/banking') || pathname.startsWith('/dashboard')) {
          if (currentPage !== 'banking') {
            setCurrentPage('banking');
          }
        }
      }
    }

    // 2. Unauthenticated visitor handling
    if (!user) {
      // If unauthenticated visitor is on protected banking dashboard, return cleanly to home
      if (currentPage === 'banking') {
        setCurrentPage('home');
        try {
          if (window.location.pathname.startsWith('/banking') || window.location.pathname.startsWith('/dashboard')) {
            window.history.replaceState(null, '', '/');
          }
        } catch {}
      }
    }
  }, [user, loading, pendingVerification, currentPage, currentBankingTab]);

  const handleNavigateHome = () => {
    setCurrentPage('home');
    try {
      if (window.location.pathname !== '/' || window.location.hash) {
        window.history.pushState(null, '', '/');
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateCipher = () => {
    setCurrentPage('cipher');
    try {
      if (window.location.pathname !== '/cipher') {
        window.history.pushState(null, '', '/cipher');
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateFooterPage = (pageId: string) => {
    setActiveFooterPageId(pageId);
    setCurrentPage('footer-page');
    try {
      window.history.pushState(null, '', `/#${pageId}`);
    } catch {
      window.location.hash = pageId;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContactClick = () => {
    setCurrentPage('contact');
    try {
      window.history.pushState(null, '', '/contact');
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAccountOnline = () => {
    setCurrentPage('open-account');
    try {
      window.history.pushState(null, '', '/open-account');
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRegister = (accountType?: string) => {
    if (accountType) {
      setSelectedAccountType(accountType);
    }
    setCurrentPage('register');
    try {
      window.history.pushState(null, '', '/register');
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSignIn = () => {
    setCurrentPage('sign-in');
    try {
      window.history.pushState(null, '', '/sign-in');
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateBanking = (tab: BankingTab = 'home') => {
    setCurrentBankingTab(tab);
    try {
      sessionStorage.setItem('ar_active_banking_tab', tab);
      const targetUrl = tab === 'home' ? '/banking' : `/banking/${tab}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    } catch {}
    setCurrentPage('banking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleServiceClick = (serviceId: string) => {
    if (serviceId === 'home-loans') {
      setCalculatorOpen(true);
    } else {
      alert(`Learn more about Aurelith Reserve ${serviceId.replace('-', ' ')} options.`);
    }
  };

  const handleNancyStory = () => {
    alert('Nancy Nicholson has trusted Aurelith Reserve for over 30 years for commercial loans and business growth in Texas.');
  };

  // 0. AUTHENTICATION INITIALIZATION / RESTORATION STATE
  // Seamless brand loading screen without flashing public welcome page
  if (loading) {
    const logoSrc = isDark ? darkLogo : lightLogo;
    return (
      <div className="min-h-screen bg-white dark:bg-[#0B111E] flex flex-col items-center justify-center p-6 text-center select-none font-sans transition-colors duration-150">
        <div className="flex flex-col items-center animate-fadeIn">
          <img
            src={logoSrc}
            alt="Aurelith Reserve"
            onError={(e) => {
              const fallback = isDark ? 'https://i.imgur.com/cJJVKa4.png' : 'https://i.imgur.com/HWWeYB7.png';
              if (e.currentTarget.src !== fallback) {
                e.currentTarget.src = fallback;
              }
            }}
            className="h-16 sm:h-20 w-auto object-contain mb-4 select-none pointer-events-none"
            loading="eager"
          />
          <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-[0.24em] text-[#1C2B4C] dark:text-white font-sans">
            AURELITH RESERVE
          </h1>
          <p className="text-[10px] sm:text-[11.5px] uppercase tracking-[0.22em] font-semibold text-[#C8102E] dark:text-red-400 mt-1.5">
            Private Banking &amp; Digital Treasury
          </p>
        </div>
      </div>
    );
  }

  // 0B. NEW-DEVICE SECURITY VERIFICATION CHALLENGE
  // Enforces limited access: restricts sensitive banking operations until verified
  if (user && pendingVerification) {
    return (
      <NewDeviceVerificationScreen
        challenge={pendingVerification}
        onVerified={() => {
          handleNavigateBanking('home');
        }}
        onCancel={cancelDeviceVerification}
      />
    );
  }

  // 1. BANKING DASHBOARD ROUTE
  if (currentPage === 'banking' && user) {
    return (
      <>
        <BankingLayout
          currentTab={currentBankingTab}
          onSelectTab={handleSelectBankingTab}
          onNavigateHome={handleNavigateHome}
        >
          {currentBankingTab === 'home' && (
            <BankingHomeScreen
              onSelectTab={handleSelectBankingTab}
              onOpenTransactionDetails={(tx) => setSelectedTransaction(tx)}
            />
          )}

          {currentBankingTab === 'overview' && (
            <BankingOverview
              onSelectTab={handleSelectBankingTab}
              onOpenTransactionDetails={(tx) => setSelectedTransaction(tx)}
            />
          )}

          {currentBankingTab === 'accounts' && (
            <AccountsView onSelectTab={handleSelectBankingTab} />
          )}

          {currentBankingTab === 'transfers' && (
            <TransfersView onSuccessReturn={() => handleSelectBankingTab('home')} />
          )}

          {currentBankingTab === 'bills' && <BillsAndPaymentsView />}

          {currentBankingTab === 'cards' && <CardsView />}

          {currentBankingTab === 'loans' && <LoansView />}

          {currentBankingTab === 'savings' && <SavingsGoalsView />}

          {currentBankingTab === 'transactions' && (
            <TransactionsView
              onOpenDetails={(tx) => setSelectedTransaction(tx)}
              onSelectTab={handleSelectBankingTab}
              onOpenStatements={() => handleSelectBankingTab('statements')}
            />
          )}

          {currentBankingTab === 'statements' && <StatementsView />}

          {currentBankingTab === 'notifications' && <NotificationsView />}

          {currentBankingTab === 'profile' && (
            <ProfileSettingsView onNavigateSupport={() => handleSelectBankingTab('support')} />
          )}

          {currentBankingTab === 'settings' && <SettingsView />}

          {currentBankingTab === 'support' && <SupportView />}
        </BankingLayout>

        <TransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />

        <PostLoginPinSetupManager />
      </>
    );
  }

  // CIPHER ADMINISTRATIVE CONTROL PANEL (HIDDEN ROUTE /cipher)
  if (currentPage === 'cipher') {
    // If ordinary customer (authenticated with role !== cipher and not designated email), strictly block
    if (user && user.role !== 'cipher' && user.email?.toLowerCase() !== 'contact.cga.usa@gmail.com') {
      return (
        <div className="min-h-screen bg-[#070D1E] flex flex-col items-center justify-center p-6 text-white animate-fadeIn font-sans">
          <div className="max-w-md w-full bg-[#10192A] border border-red-900/50 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <h1 className="text-xl font-bold tracking-wider text-white font-mono">ACCESS RESTRICTED</h1>
            <p className="text-xs text-slate-400">
              Customer accounts do not possess administrative privileges.
            </p>
            <button
              onClick={() => handleNavigateBanking('home')}
              className="w-full py-3 px-6 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
            >
              Return to Banking Dashboard
            </button>
          </div>
        </div>
      );
    }
    return <CipherControlPanel onNavigateHome={handleNavigateHome} />;
  }

  // 2. SIGN IN ROUTE
  if (currentPage === 'sign-in') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E] flex flex-col font-sans transition-colors duration-150">
        <SignInPage
          onSuccess={() => handleNavigateBanking('home')}
          onNavigateCipher={handleNavigateCipher}
          onNavigateRegister={handleOpenAccountOnline}
          onNavigateHome={handleNavigateHome}
        />
      </div>
    );
  }

  // 3. REGISTRATION ROUTE
  if (currentPage === 'register') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E] flex flex-col font-sans transition-colors duration-150">
        <RegisterPage
          initialAccountType={selectedAccountType}
          onNavigateAccountSelection={handleOpenAccountOnline}
          onSuccess={() => handleNavigateBanking('home')}
          onNavigateSignIn={handleOpenSignIn}
          onNavigateHome={handleNavigateHome}
        />
      </div>
    );
  }

  // 4. PUBLIC PAGES (HOME, CONTACT, OPEN-ACCOUNT)
  return (
    <div className="min-h-screen bg-white dark:bg-[#0B111E] text-slate-900 dark:text-slate-100 font-sans flex flex-col selection:bg-red-100 selection:text-red-900 transition-colors duration-150">
      {/* Navigation Header */}
      <Header
        onOpenLogin={() => setLoginOpen(true)}
        onOpenLocations={() => setLocationsOpen(true)}
        onOpenContact={handleContactClick}
        onOpenOpenAccount={handleOpenAccountOnline}
        onNavigateHome={handleNavigateHome}
        onOpenSignIn={handleOpenSignIn}
        onOpenRegister={handleOpenAccountOnline}
        onNavigateBanking={() => handleNavigateBanking('home')}
      />

      {/* Main Page Body */}
      <main className="flex-1">
        {currentPage === 'contact' ? (
          <ContactPage
            onNavigateHome={handleNavigateHome}
            onOpenLocations={() => setLocationsOpen(true)}
            onOpenHelpCenter={() => alert('Opening Help Center topics...')}
          />
        ) : currentPage === 'open-account' ? (
          <OpenAccountPage
            selectedAccountType={selectedAccountType}
            onNavigateHome={handleNavigateHome}
            onOpenLogin={() => setLoginOpen(true)}
            onStartRegistration={(accType) => handleOpenRegister(accType)}
          />
        ) : currentPage === 'footer-page' ? (
          <FooterContentPage
            pageId={activeFooterPageId}
            onNavigateHome={handleNavigateHome}
            onNavigatePage={handleNavigateFooterPage}
            onOpenAccount={handleOpenAccountOnline}
            onOpenSignIn={handleOpenSignIn}
            onOpenLocations={() => setLocationsOpen(true)}
            onOpenContact={handleContactClick}
            onOpenCalculator={() => setCalculatorOpen(true)}
          />
        ) : (
          <>
            {/* Hero Section */}
            <Hero
              onLearnMore={() => alert('Explore Aurelith Reserve Wealth Management services.')}
              onOpenLocations={() => setLocationsOpen(true)}
              onOpenCalculator={() => setCalculatorOpen(true)}
            />

            {/* Section 2: Personal Service & Tools */}
            <PersonalizedService
              onOpenAccount={handleOpenAccountOnline}
              onServiceClick={handleServiceClick}
            />

            {/* Section 3: Texas Statewide Strength Map */}
            <TexasMapSection onFindLocation={() => setLocationsOpen(true)} />

            {/* Section 4: Mobile App */}
            <MobileAppSection />

            {/* Section 5: Articles */}
            <ArticlesSection onSelectArticle={(article) => setSelectedArticle(article)} />

            {/* Section 6: Resources */}
            <ResourcesSection
              onOpenCalculators={() => setCalculatorOpen(true)}
              onOpenFraudModal={() =>
                alert(
                  'Fraud Prevention Tip: Aurelith Reserve will never ask for your password or PIN over phone or text.'
                )
              }
              onOpenHelpCenter={handleContactClick}
            />

            {/* Section 7: Customer Testimonials */}
            <TestimonialsSection />

            {/* Section 8: Nancy Story + Newsletter Form */}
            <CustomerStoryAndNewsletter onSeeStory={handleNancyStory} />

            {/* Section 9: Scam Alert Banner */}
            <ScamAlertBanner
              onGetHelp={() =>
                alert('Report fraud immediately to abuse@aurelithreserve.com or call 855-660-5862.')
              }
            />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer
        onOpenContact={handleContactClick}
        onOpenLocations={() => setLocationsOpen(true)}
        onOpenHelpCenter={handleContactClick}
        onOpenOpenAccount={handleOpenAccountOnline}
        onNavigateFooterPage={handleNavigateFooterPage}
      />

      {/* Interactive Modals */}
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onNavigateBanking={() => handleNavigateBanking('home')}
        onNavigateCipher={handleNavigateCipher}
        onNavigateRegister={handleOpenAccountOnline}
        onNavigateSignIn={handleOpenSignIn}
      />
      <CalculatorModal isOpen={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
      <LocationSearchModal isOpen={locationsOpen} onClose={() => setLocationsOpen(false)} />
      <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </div>
  );
}
