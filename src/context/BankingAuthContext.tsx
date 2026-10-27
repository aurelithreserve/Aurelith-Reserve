import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BankingUser, BankTransaction, DeviceVerificationChallenge } from '../types/banking';
import { bankingApi, getAuthToken, clearAuthToken } from '../services/bankingApi';
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
  createUserWithEmailAndPassword,
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

  const reloadTransactions = useCallback(async () => {
    try {
      const res = await bankingApi.getTransactions();
      setTransactions(res.transactions);
    } catch (err) {
      console.warn('Could not fetch transactions:', err);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<BankingUser | null> => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await bankingApi.getCurrentUser();
      const currentUser = res?.user;
      if (!currentUser) {
        clearAuthToken();
        setUser(null);
        return null;
      }

      // Check Firestore profile for persistent photo and bank selection
      const uid = auth.currentUser?.uid || currentUser.firebaseUid;
      if (uid) {
        try {
          const docRef = doc(db, 'users', uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const persistentPhoto = data.photoDataUrl || data.avatarUrl;
            if (persistentPhoto) {
              currentUser.avatarUrl = persistentPhoto;
              currentUser.photoDataUrl = persistentPhoto;
            }
            if (data.bankName && !currentUser.bankName) {
              currentUser.bankName = data.bankName;
            }
            if (data.middleName && !currentUser.middleName) {
              currentUser.middleName = data.middleName;
            }
            if (data.clientId && !currentUser.clientId) {
              currentUser.clientId = data.clientId;
            }
            if (data.hasPaymentPin !== undefined) {
              currentUser.hasPaymentPin = Boolean(data.hasPaymentPin);
            }
          }
        } catch (fsErr) {
          console.warn('Firestore refresh note:', fsErr);
        }
      }

      if (!currentUser.clientId || !/^AR-[A-Z0-9]{6}$/i.test(currentUser.clientId)) {
        currentUser.clientId = formatClientId(currentUser.id, currentUser.clientId);
      }

      setUser(currentUser);
      await reloadTransactions();
      return currentUser;
    } catch (err) {
      console.warn('Session expired or error loading user profile:', err);
      clearAuthToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [reloadTransactions]);

  // Synchronize Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentFbUser) => {
      setFirebaseUser(currentFbUser);
      if (currentFbUser) {
        // Synchronize Firestore profile
        try {
          const docRef = doc(db, 'users', currentFbUser.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const persistentPhoto = data.photoDataUrl || data.avatarUrl;
            if (persistentPhoto) {
              setUser((prev) => (prev ? { ...prev, avatarUrl: persistentPhoto, photoDataUrl: persistentPhoto } : prev));
            }
            if (data.bankName) {
              setUser((prev) => (prev ? { ...prev, bankName: data.bankName } : prev));
            }
            if (data.middleName) {
              setUser((prev) => (prev ? { ...prev, middleName: data.middleName } : prev));
            }
            if (data.clientId) {
              setUser((prev) => (prev ? { ...prev, clientId: data.clientId } : prev));
            }
            if (data.hasPaymentPin !== undefined) {
              setUser((prev) => (prev ? { ...prev, hasPaymentPin: Boolean(data.hasPaymentPin) } : prev));
            }
          }
        } catch (err) {
          console.warn('Firestore profile sync note:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const syncFirebaseAuth = async (email: string, pass: string, currentUserData?: BankingUser) => {
    if (!auth.currentUser && email && pass) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        setFirebaseUser(cred.user);
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential') {
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            setFirebaseUser(cred.user);
          } catch {
            // Non-blocking fallback
          }
        }
      }
    }

    // Sync Firestore profile document if Firebase user is signed in
    if (auth.currentUser && currentUserData) {
      try {
        if (!currentUserData.clientId || !/^AR-[A-Z0-9]{6}$/i.test(currentUserData.clientId)) {
          currentUserData.clientId = formatClientId(currentUserData.id, currentUserData.clientId);
        }
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            uid: auth.currentUser.uid,
            id: currentUserData.id,
            clientId: currentUserData.clientId,
            firstName: currentUserData.firstName,
            middleName: currentUserData.middleName || null,
            lastName: currentUserData.lastName,
            email: currentUserData.email,
            phoneNumber: currentUserData.phoneNumber,
            accountType: currentUserData.accounts[0]?.name || 'Aurelith Premier Checking',
            accountNumber: currentUserData.accounts[0]?.accountNumber || '',
            routingNumber: currentUserData.accounts[0]?.routingNumber || '111301122',
            avatarUrl: currentUserData.avatarUrl || null,
            hasPaymentPin: Boolean(currentUserData.hasPaymentPin),
            status: 'active',
            emailVerified: Boolean(auth.currentUser.emailVerified || currentUserData.emailVerified),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          const data = snap.data();
          let needsUpdate = false;
          if (data.avatarUrl && !currentUserData.avatarUrl) {
            currentUserData.avatarUrl = data.avatarUrl;
            needsUpdate = true;
          }
          if (data.middleName && !currentUserData.middleName) {
            currentUserData.middleName = data.middleName;
            needsUpdate = true;
          }
          if (data.hasPaymentPin !== undefined && currentUserData.hasPaymentPin !== Boolean(data.hasPaymentPin)) {
            currentUserData.hasPaymentPin = Boolean(data.hasPaymentPin);
            needsUpdate = true;
          }
          if (needsUpdate) {
            setUser({ ...currentUserData });
          }
        }
      } catch (fsErr) {
        console.warn('Firestore profile check note:', fsErr);
      }
    }
  };

  const login = async (identifier: string, pass: string, governmentId?: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const res = await bankingApi.login(identifier, pass, governmentId);
      if (res.requireDeviceVerification) {
        setPendingVerification(res);
        return { requireDeviceVerification: true, challenge: res };
      }

      setPendingVerification(null);
      const verifiedRes = res as { requireDeviceVerification: false; token: string; user: BankingUser; message: string };
      if (!verifiedRes?.user) {
        throw new Error('Authentication response was missing user account details. Please try again.');
      }
      setUser(verifiedRes.user);
      await reloadTransactions();

      // Establish Firebase Auth session
      await syncFirebaseAuth(verifiedRes.user.email, pass, verifiedRes.user);

      return { requireDeviceVerification: false, user: verifiedRes.user };
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhone = async (phone: string, pass: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const res = await bankingApi.loginWithPhone(phone, pass);
      if (res.requireDeviceVerification) {
        setPendingVerification(res);
        return { requireDeviceVerification: true, challenge: res };
      }

      setPendingVerification(null);
      const verifiedRes = res as { requireDeviceVerification: false; token: string; user: BankingUser; message: string };
      if (!verifiedRes?.user) {
        throw new Error('Authentication response was missing user account details. Please try again.');
      }
      setUser(verifiedRes.user);
      await reloadTransactions();

      // Establish Firebase Auth session using registered account email
      await syncFirebaseAuth(verifiedRes.user.email, pass, verifiedRes.user);

      return { requireDeviceVerification: false, user: verifiedRes.user };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<BankingUser> => {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = cred.user;
      setFirebaseUser(fbUser);

      const res = await bankingApi.loginWithGoogle({
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName,
        photoUrl: fbUser.photoURL,
      });

      // Synchronize / create Firestore profile document
      try {
        const docRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            uid: fbUser.uid,
            id: res.user.id,
            firstName: res.user.firstName,
            lastName: res.user.lastName,
            email: res.user.email,
            phoneNumber: res.user.phoneNumber,
            accountType: res.user.accounts[0]?.name || 'Aurelith Premier Checking',
            accountNumber: res.user.accounts[0]?.accountNumber || '',
            routingNumber: res.user.accounts[0]?.routingNumber || '111301122',
            avatarUrl: fbUser.photoURL || null,
            status: 'active',
            emailVerified: fbUser.emailVerified,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          await updateDoc(docRef, {
            updatedAt: new Date().toISOString(),
            emailVerified: fbUser.emailVerified,
          });
        }
      } catch (fsErr) {
        console.warn('Firestore profile sync note:', fsErr);
      }

      setUser(res.user);
      await reloadTransactions();
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const updateAvatarUrl = async (url: string | null): Promise<void> => {
    const res = await bankingApi.updateProfilePhoto(url);
    setUser(res.user);

    // Persist in Firestore profile document under /users/{uid}
    const uid = auth.currentUser?.uid || res.user.firebaseUid || res.user.id;
    if (uid) {
      const userDocRef = doc(db, 'users', uid);
      try {
        await setDoc(
          userDocRef,
          {
            uid,
            id: res.user.id,
            firstName: res.user.firstName,
            lastName: res.user.lastName,
            email: res.user.email,
            avatarUrl: url,
            photoDataUrl: url,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (setErr) {
        handleFirestoreError(setErr, OperationType.WRITE, `users/${uid}`);
      }
    }
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

  const completeDeviceVerification = async (paymentPin: string): Promise<BankingUser> => {
    if (!pendingVerification) {
      throw new Error('No pending device verification session found.');
    }
    const res = await bankingApi.verifyNewDevice(pendingVerification.verificationToken, paymentPin);
    setUser(res.user);
    setPendingVerification(null);
    await reloadTransactions();
    return res.user;
  };

  const setupInitialPinAndVerifyDevice = async (payload: {
    password: string;
    newPin: string;
    confirmPin: string;
  }): Promise<BankingUser> => {
    if (!pendingVerification) {
      throw new Error('No pending device verification session found.');
    }
    const res = await bankingApi.setupInitialPinForDevice({
      verificationToken: pendingVerification.verificationToken,
      ...payload,
    });
    setUser(res.user);
    setPendingVerification(null);
    await reloadTransactions();
    return res.user;
  };

  const cancelDeviceVerification = async (): Promise<void> => {
    if (pendingVerification) {
      await bankingApi.cancelDeviceVerification(pendingVerification.verificationToken);
      setPendingVerification(null);
    }
  };

  const register = async (payload: any): Promise<BankingUser> => {
    setLoading(true);
    try {
      const res = await bankingApi.register(payload);
      setUser(res.user);
      await reloadTransactions();
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const setupTransactionPin = async (pin: string, confirmPin: string): Promise<BankingUser> => {
    const res = await bankingApi.setupTransactionPin({ pin, confirmPin });
    const updatedUser = res.user;

    // Persist setup status to Firestore profile document under /users/{uid}
    const uid = auth.currentUser?.uid || updatedUser.firebaseUid;
    if (uid) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          hasPaymentPin: true,
          updatedAt: new Date().toISOString(),
        });
      } catch (fsErr) {
        try {
          await setDoc(doc(db, 'users', uid), { hasPaymentPin: true, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (e) {
          console.warn('Firestore PIN status sync note:', e);
        }
      }
    }

    setUser(updatedUser);
    return updatedUser;
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await signOut(auth).catch(() => {});
      await bankingApi.logout();
    } finally {
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
