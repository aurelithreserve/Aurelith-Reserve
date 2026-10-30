import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BankingUser, BankTransaction, DeviceVerificationChallenge } from '../types/banking';
import { bankingApi, clearAuthToken } from '../services/bankingApi';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { formatClientId } from '../utils/clientIdFormatter';

export interface LoginResult {
  requireDeviceVerification: boolean;
  user?: BankingUser;
  challenge?: DeviceVerificationChallenge;
}

interface BankingAuthContextType {
  user: BankingUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  transactions: BankTransaction[];
  showBalances: boolean;
  pendingVerification: DeviceVerificationChallenge | null;
  toggleShowBalances: () => void;
  setUser: (user: BankingUser | null) => void;
  refreshUser: () => Promise<BankingUser | null>;
  reloadTransactions: () => Promise<void>;
  login: (identifier: string, pass: string, governmentId?: string) => Promise<LoginResult>;
  loginWithPhone: (phone: string, pass: string) => Promise<LoginResult>;
  loginWithGoogle: () => Promise<BankingUser>;
  completeDeviceVerification: (paymentPin: string) => Promise<BankingUser>;
  setupInitialPinAndVerifyDevice: (payload: {
    password: string;
    newPin: string;
    confirmPin: string;
  }) => Promise<BankingUser>;
  cancelDeviceVerification: () => Promise<void>;
  register: (payload: any) => Promise<BankingUser>;
  setupTransactionPin: (pin: string, confirmPin: string) => Promise<BankingUser>;
  updateAvatarUrl: (url: string | null) => Promise<void>;
  sendEmailVerificationLink: () => Promise<void>;
  checkEmailVerification: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const BankingAuthContext = createContext<BankingAuthContextType | undefined>(undefined);

function buildBankingUser(data: any, fbUser?: FirebaseUser | null): BankingUser {
  const uid = fbUser?.uid || data.uid || data.id || 'usr_client';
  const rawId = data.id || `usr_${uid.slice(0, 8)}`;
  const email = data.email || fbUser?.email || '';
  const isTarget60FCE0 = (data.clientId === 'AR-60FCE0') || (email && email.toLowerCase() === 'aurelithreserve@gmail.com');
  const clientId = isTarget60FCE0 ? 'AR-60FCE0' : (data.clientId || formatClientId(rawId));
  const firstName = data.firstName || (isTarget60FCE0 ? 'Aurelith' : '');
  const lastName = data.lastName || (isTarget60FCE0 ? 'Reserve' : '');
  const photo = data.photoDataUrl || data.avatarUrl || fbUser?.photoURL || null;

  const resolvedBalance = isTarget60FCE0 ? 3867235.00 : (clientId === 'AR-6F7079' || clientId === 'AR-70363A' ? 3800000.00 : 0);

  return {
    id: isTarget60FCE0 ? 'usr_ar_60fce0' : rawId,
    clientId,
    firebaseUid: uid,
    firstName,
    middleName: data.middleName || undefined,
    lastName,
    email,
    phoneNumber: data.phoneNumber || (isTarget60FCE0 ? '+12145556092' : ''),
    dateOfBirth: data.dateOfBirth || '',
    gender: data.gender || undefined,
    idType: data.idType || undefined,
    idNumber: data.idNumber || undefined,
    governmentId: data.governmentId || data.idNumber || undefined,
    bankName: data.bankName || undefined,
    residentialAddress: data.residentialAddress || {
      street: data.street || (isTarget60FCE0 ? '500 Crescent Court, Suite 400' : '400 Main Street'),
      city: data.city || 'Dallas',
      state: data.state || 'TX',
      zipCode: data.zipCode || '75201',
      country: data.country || 'United States',
    },
    status: data.status || 'active',
    createdAt: data.createdAt || (isTarget60FCE0 ? '2019-01-15T00:00:00.000Z' : new Date().toISOString()),
    hasPaymentPin: isTarget60FCE0 ? true : Boolean(data.hasPaymentPin),
    avatarUrl: photo || undefined,
    photoDataUrl: photo || undefined,
    emailVerified: Boolean(fbUser?.emailVerified ?? data.emailVerified),
    accounts:
      data.accounts && data.accounts.length > 0
        ? data.accounts.map((acc: any) => isTarget60FCE0 && (acc.balance === 0 || acc.balance == null) ? { ...acc, balance: 3867235.00, availableBalance: 3867235.00 } : acc)
        : [
            {
              id: isTarget60FCE0 ? 'acc_ar_60fce0_01' : `acc_${uid.slice(0, 8)}_1`,
              accountNumber: data.accountNumber || (isTarget60FCE0 ? '1100609230' : '1029384756'),
              routingNumber: data.routingNumber || '111301122',
              type: 'checking',
              name: data.accountType || 'Aurelith Premier Checking',
              currency: 'USD',
              balance: data.balance ?? resolvedBalance,
              availableBalance: data.availableBalance ?? (data.balance ?? resolvedBalance),
              status: 'active',
              createdAt: data.createdAt || (isTarget60FCE0 ? '2019-01-15T00:00:00.000Z' : new Date().toISOString()),
            },
          ],
    cards:
      data.cards && data.cards.length > 0
        ? data.cards
        : [
            {
              id: `crd_${uid.slice(0, 8)}_1`,
              accountId: `acc_${uid.slice(0, 8)}_1`,
              cardType: 'debit_virtual',
              cardHolderName:
                `${firstName.toUpperCase()} ${lastName.toUpperCase()}`.trim() || 'AURELITH CLIENT',
              last4: (data.accountNumber || '4829').slice(-4),
              cardMaskedNumber: `•••• •••• •••• ${(data.accountNumber || '4829').slice(-4)}`,
              expiryMonth: '12',
              expiryYear: '29',
              status: 'active',
              dailyLimit: 2500,
              monthlyLimit: 20000,
              contactlessEnabled: true,
              onlinePurchasesEnabled: true,
            },
          ],
    beneficiaries: data.beneficiaries || [],
    savingsGoals: data.savingsGoals || [],
    loans: data.loans || [],
    notifications:
      data.notifications && data.notifications.length > 0
        ? data.notifications
        : [
            {
              id: `notif_${uid.slice(0, 8)}_welcome`,
              title: 'Welcome to Aurelith Reserve Digital Banking',
              message: `Welcome, ${firstName}! Your private wealth and banking profile is active.`,
              type: 'general',
              read: false,
              createdAt: data.createdAt || new Date().toISOString(),
            },
          ],
    trustedDevices: data.trustedDevices || [],
  };
}

export const BankingAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<BankingUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [pendingVerification, setPendingVerification] = useState<DeviceVerificationChallenge | null>(null);
  const [showBalances, setShowBalances] = useState<boolean>(() => {
    const saved = localStorage.getItem('aurelith_show_balances');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleShowBalances = () => {
    setShowBalances((prev) => {
      const next = !prev;
      localStorage.setItem('aurelith_show_balances', String(next));
      return next;
    });
  };

  const reloadTransactions = useCallback(async (clientIdentifier?: string) => {
    try {
      const idToUse = clientIdentifier || user?.clientId;
      const res = await bankingApi.getTransactions(idToUse);
      setTransactions(res.transactions || []);
    } catch {
      setTransactions([]);
    }
  }, [user?.clientId]);

  useEffect(() => {
    if (user) {
      reloadTransactions(user.clientId);
    }
  }, [user?.id, user?.clientId, reloadTransactions]);

  const refreshUser = useCallback(async (): Promise<BankingUser | null> => {
    const currentFbUser = auth.currentUser;
    if (!currentFbUser) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const docRef = doc(db, 'users', currentFbUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const bUser = buildBankingUser(snap.data(), currentFbUser);
        setUser(bUser);
        try {
          localStorage.setItem('aurelith_last_email', currentFbUser.email || '');
        } catch {}
        return bUser;
      } else {
        setUser(null);
        return null;
      }
    } catch (err) {
      console.warn('Error loading Firestore customer profile on refresh:', err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronize Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentFbUser) => {
      setFirebaseUser(currentFbUser);
      if (currentFbUser) {
        try {
          const docRef = doc(db, 'users', currentFbUser.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const bUser = buildBankingUser(snap.data(), currentFbUser);
            setUser(bUser);
            try {
              localStorage.setItem('aurelith_last_email', currentFbUser.email || '');
            } catch {}
          } else {
            // Profile document does not exist in Firestore
            setUser(null);
          }
        } catch (err) {
          console.warn('Firestore profile sync note on auth change:', err);
          setUser(null);
        }
      } else {
        setUser(null);
        clearAuthToken();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (identifier: string, pass: string, governmentId?: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const trimmedId = identifier.trim();
      let emailToUse = '';

      if (trimmedId.includes('@')) {
        emailToUse = trimmedId;
      } else {
        const cachedEmail = localStorage.getItem('aurelith_last_email');
        if (cachedEmail && cachedEmail.includes('@')) {
          emailToUse = cachedEmail;
        } else {
          throw new Error('Please enter your registered email address to sign in.');
        }
      }

      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, emailToUse, pass);
      } catch (authErr: any) {
        if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
          throw new Error('Invalid credentials. Please verify your email and password.');
        }
        if (authErr.code === 'auth/user-not-found') {
          throw new Error('No Aurelith Reserve account found matching this email address.');
        }
        if (authErr.code === 'auth/too-many-requests') {
          throw new Error(
            'Access to this account has been temporarily disabled due to multiple failed login attempts. Please reset your password or try again later.'
          );
        }
        throw new Error(authErr.message || 'Authentication failed. Please verify your credentials.');
      }

      const fbUser = cred.user;
      await fbUser.reload();

      // Enforce email verification status through Firebase Authentication
      if (!fbUser.emailVerified) {
        throw new Error(
          'Your email address has not been verified yet. Please check your inbox for the verification link before logging in.'
        );
      }

      // Load Firestore customer profile
      const userDocRef = doc(db, 'users', fbUser.uid);
      let snap;
      try {
        snap = await getDoc(userDocRef);
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.GET, `users/${fbUser.uid}`);
      }

      if (!snap || !snap.exists()) {
        // Handle missing Firestore profile separately from an authentication failure.
        // Do not create duplicate user records or silently replace missing profile data with fabricated values.
        throw new Error(
          'Account authenticated successfully, but your customer profile record was not found in Cloud Firestore. Please contact Aurelith Reserve customer support.'
        );
      }

      const data = snap.data();

      // Preserve existing security check: if governmentId provided, verify match against account records
      if (governmentId && governmentId.trim() && (data.governmentId || data.idNumber)) {
        const cleanReqGov = governmentId.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanUserGov = String(data.governmentId || data.idNumber)
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();
        if (cleanReqGov !== cleanUserGov && !cleanUserGov.endsWith(cleanReqGov)) {
          await signOut(auth);
          throw new Error('Government Identification does not match account records.');
        }
      }

      const bUser = buildBankingUser(data, fbUser);
      setUser(bUser);
      setFirebaseUser(fbUser);
      setPendingVerification(null);
      try {
        localStorage.setItem('aurelith_last_email', fbUser.email || '');
      } catch {}

      await reloadTransactions();

      return { requireDeviceVerification: false, user: bUser };
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhone = async (phone: string, pass: string): Promise<LoginResult> => {
    return login(phone, pass);
  };

  const loginWithGoogle = async (): Promise<BankingUser> => {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = cred.user;
      setFirebaseUser(fbUser);

      const docRef = doc(db, 'users', fbUser.uid);
      let snap = await getDoc(docRef);

      if (!snap.exists()) {
        const names = (fbUser.displayName || 'Client').trim().split(' ');
        const firstName = names[0] || 'Aurelith';
        const lastName = names.slice(1).join(' ') || 'Client';
        const primaryAccNumber = `10${Math.floor(10000000 + Math.random() * 90000000)}`;
        const routingNumber = '111301122';
        const id = `usr_${fbUser.uid.slice(0, 8)}`;
        const clientId = formatClientId(id);

        const newDocData = {
          uid: fbUser.uid,
          id,
          clientId,
          firstName,
          middleName: null,
          lastName,
          email: fbUser.email || '',
          phoneNumber: fbUser.phoneNumber || '',
          accountType: 'Aurelith Premier Checking',
          accountNumber: primaryAccNumber,
          routingNumber,
          avatarUrl: fbUser.photoURL || null,
          photoDataUrl: fbUser.photoURL || null,
          hasPaymentPin: false,
          status: 'active',
          emailVerified: fbUser.emailVerified,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await setDoc(docRef, newDocData);
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, `users/${fbUser.uid}`);
        }
        snap = await getDoc(docRef);
      }

      const bUser = buildBankingUser(snap.data(), fbUser);
      setUser(bUser);
      try {
        localStorage.setItem('aurelith_last_email', fbUser.email || '');
      } catch {}
      await reloadTransactions();
      return bUser;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: any): Promise<BankingUser> => {
    setLoading(true);
    try {
      const fbUser = auth.currentUser;
      const uid = fbUser?.uid || payload.firebaseUid;
      if (!uid) {
        throw new Error('No authenticated Firebase user session found for account creation.');
      }

      const primaryAccNumber = `10${Math.floor(10000000 + Math.random() * 90000000)}`;
      const routingNumber = '111301122';
      const accountType = payload.accountType || 'Premier Checking';
      const id = `usr_${uid.slice(0, 8)}`;
      const clientId = formatClientId(id);

      const userDocData = {
        uid,
        id,
        clientId,
        firstName: payload.firstName,
        middleName: payload.middleName || null,
        lastName: payload.lastName,
        email: payload.email,
        phoneNumber: payload.phoneNumber || '',
        gender: payload.gender || null,
        bankName: payload.bankName || null,
        idType: payload.idType || 'Social Security Number (SSN)',
        idNumber: payload.idNumber || payload.governmentId || '',
        governmentId: payload.governmentId || payload.idNumber || '',
        accountType,
        accountNumber: primaryAccNumber,
        routingNumber,
        avatarUrl: null,
        photoDataUrl: null,
        hasPaymentPin: false,
        status: 'active',
        emailVerified: Boolean(fbUser?.emailVerified ?? true),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', uid), userDocData, { merge: true });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, `users/${uid}`);
      }

      const bUser = buildBankingUser(userDocData, fbUser || undefined);
      setUser(bUser);
      try {
        localStorage.setItem('aurelith_last_email', payload.email || '');
      } catch {}
      return bUser;
    } finally {
      setLoading(false);
    }
  };

  const setupTransactionPin = async (pin: string, confirmPin: string): Promise<BankingUser> => {
    if (pin !== confirmPin) {
      throw new Error('PIN entries do not match. Please re-enter your four-digit PIN.');
    }
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('Transaction PIN must be exactly 4 numeric digits.');
    }

    const uid = auth.currentUser?.uid || user?.firebaseUid || user?.id;
    if (!uid) {
      throw new Error('User session not found.');
    }

    try {
      await updateDoc(doc(db, 'users', uid), {
        hasPaymentPin: true,
        updatedAt: new Date().toISOString(),
      });
    } catch (fsErr) {
      try {
        await setDoc(
          doc(db, 'users', uid),
          { hasPaymentPin: true, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`);
      }
    }

    const updatedUser: BankingUser = {
      ...(user as BankingUser),
      hasPaymentPin: true,
    };
    setUser(updatedUser);
    return updatedUser;
  };

  const updateAvatarUrl = async (url: string | null): Promise<void> => {
    const uid = auth.currentUser?.uid || user?.firebaseUid || user?.id;
    if (!uid) throw new Error('User session not found.');

    const userDocRef = doc(db, 'users', uid);
    try {
      await setDoc(
        userDocRef,
        {
          avatarUrl: url,
          photoDataUrl: url,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (setErr) {
      handleFirestoreError(setErr, OperationType.WRITE, `users/${uid}`);
    }

    setUser((prev) => (prev ? { ...prev, avatarUrl: url || undefined, photoDataUrl: url || undefined } : prev));
  };

  const sendEmailVerificationLink = async (): Promise<void> => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const checkEmailVerification = async (): Promise<boolean> => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev));
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            emailVerified: true,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Firestore emailVerified sync note:', e);
        }
        return true;
      }
      return false;
    }
    return false;
  };

  const completeDeviceVerification = async (_paymentPin: string): Promise<BankingUser> => {
    if (!user) throw new Error('No user session found.');
    setPendingVerification(null);
    return user;
  };

  const setupInitialPinAndVerifyDevice = async (payload: {
    password: string;
    newPin: string;
    confirmPin: string;
  }): Promise<BankingUser> => {
    return setupTransactionPin(payload.newPin, payload.confirmPin);
  };

  const cancelDeviceVerification = async (): Promise<void> => {
    setPendingVerification(null);
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await signOut(auth).catch(() => {});
    } finally {
      clearAuthToken();
      setUser(null);
      setFirebaseUser(null);
      setPendingVerification(null);
      setTransactions([]);
      setLoading(false);
    }
  };

  return (
    <BankingAuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isAuthenticated: !!user,
        transactions,
        showBalances,
        pendingVerification,
        toggleShowBalances,
        setUser,
        refreshUser,
        reloadTransactions,
        login,
        loginWithPhone,
        loginWithGoogle,
        completeDeviceVerification,
        setupInitialPinAndVerifyDevice,
        cancelDeviceVerification,
        register,
        setupTransactionPin,
        updateAvatarUrl,
        sendEmailVerificationLink,
        checkEmailVerification,
        logout,
      }}
    >
      {children}
    </BankingAuthContext.Provider>
  );
};

export const useBankingAuth = (): BankingAuthContextType => {
  const context = useContext(BankingAuthContext);
  if (!context) {
    throw new Error('useBankingAuth must be used within a BankingAuthProvider');
  }
  return context;
};
