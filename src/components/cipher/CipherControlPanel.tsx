import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  CreditCard,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Sliders,
  FileText,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  DollarSign,
  ChevronRight,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  Bell,
  Home,
  LogOut,
  AlertCircle,
  Check,
  UserCheck,
  UserX,
  PlusCircle,
  MinusCircle,
  Pencil,
  ArrowRight,
} from 'lucide-react';
import { bankingApi, CipherStats, CipherUserRecord, CipherUserAccount, CipherAuditRecord, CipherAppConfig } from '../../services/bankingApi';
import { BankTransaction } from '../../types/banking';
import { formatCurrency } from '../../data/accountTiers';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getAuthoritativeBankInfo } from '../../utils/bankingIdentifiers';

interface CipherControlPanelProps {
  onNavigateHome: () => void;
}

type TabType = 'overview' | 'users' | 'individual' | 'balance' | 'transactions' | 'controls' | 'audit';

export const CipherControlPanel: React.FC<CipherControlPanelProps> = ({ onNavigateHome }) => {
  // Authentication & Verification
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [operatorEmail, setOperatorEmail] = useState('');
  const [authError, setAuthError] = useState('');

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Stats State
  const [stats, setStats] = useState<CipherStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Users State
  const [users, setUsers] = useState<CipherUserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<CipherUserRecord | null>(null);
  const [userTransactions, setUserTransactions] = useState<BankTransaction[]>([]);
  const [userAudits, setUserAudits] = useState<CipherAuditRecord[]>([]);

  // Balance Adjustment Form State
  const [adjustAccountId, setAdjustAccountId] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState('');
  const [adjustErrorMsg, setAdjustErrorMsg] = useState('');
  const [isConfirmingAdjustment, setIsConfirmingAdjustment] = useState(false);

  // Transfer Access Modal State
  const [transferAccessUser, setTransferAccessUser] = useState<CipherUserRecord | null>(null);
  const [newTransferAccessState, setNewTransferAccessState] = useState<'enabled' | 'restricted'>('enabled');
  const [transferAccessReason, setTransferAccessReason] = useState('');
  const [transferAccessLoading, setTransferAccessLoading] = useState(false);
  const [transferAccessModalOpen, setTransferAccessModalOpen] = useState(false);

  // Transactions State
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [txDirectionFilter, setTxDirectionFilter] = useState('all');
  const [txStatusFilter, setTxStatusFilter] = useState('all');
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);

  // Application Controls State
  const [appConfig, setAppConfig] = useState<CipherAppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [configSaveError, setConfigSaveError] = useState('');

  // Audit Log State
  const [audits, setAudits] = useState<CipherAuditRecord[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);

  // Sensitive number reveal state
  const [revealedAccounts, setRevealedAccounts] = useState<Record<string, boolean>>({});

  // Direct Balance Adjustment modal state (for individual customer view - PART 3)
  const [isDirectBalanceModalOpen, setIsDirectBalanceModalOpen] = useState(false);
  const [directBalanceAccountId, setDirectBalanceAccountId] = useState('');
  const [directBalanceMode, setDirectBalanceMode] = useState<'amount' | 'replacement'>('amount');
  const [directBalanceType, setDirectBalanceType] = useState<'credit' | 'debit'>('credit');
  const [directBalanceInput, setDirectBalanceInput] = useState('');
  const [directBalanceReason, setDirectBalanceReason] = useState('');
  const [directBalanceStep, setDirectBalanceStep] = useState<'input' | 'review'>('input');
  const [directBalanceLoading, setDirectBalanceLoading] = useState(false);
  const [directBalanceError, setDirectBalanceError] = useState('');
  const [directBalanceSuccess, setDirectBalanceSuccess] = useState('');

  // Transaction Correction modal state (for individual customer view - PART 4)
  const [isTxCorrectionModalOpen, setIsTxCorrectionModalOpen] = useState(false);
  const [correctingTx, setCorrectingTx] = useState<BankTransaction | null>(null);
  const [txCorrectionStep, setTxCorrectionStep] = useState<'edit' | 'review'>('edit');
  const [txCorrectionForm, setTxCorrectionForm] = useState({
    description: '',
    category: '',
    amount: '',
    timestamp: '',
    senderName: '',
    senderAccount: '',
    senderBank: '',
    recipientName: '',
    recipientAccount: '',
    recipientBank: '',
    status: 'completed' as 'completed' | 'pending' | 'failed',
  });
  const [txCorrectionReason, setTxCorrectionReason] = useState('');
  const [txCorrectionLoading, setTxCorrectionLoading] = useState(false);
  const [txCorrectionError, setTxCorrectionError] = useState('');
  const [txCorrectionSuccess, setTxCorrectionSuccess] = useState('');

  // 1. Initial Authorization Verification
  useEffect(() => {
    let isMounted = true;

    async function verifyCipher() {
      setCheckingAuth(true);
      setAuthError('');
      try {
        const res = await bankingApi.checkCipherAuth();
        if (isMounted) {
          if (res.authorized) {
            setAuthorized(true);
            setOperatorEmail(res.operator?.email || res.email || 'contact.cga.usa@gmail.com');
          } else {
            setAuthorized(false);
            setAuthError(res.error || 'Access Denied: Unprivileged Identity');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setAuthorized(false);
          setAuthError(err.message || 'Authorization check failed. Cipher credentials required.');
        }
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    }

    verifyCipher();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Data Methods
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await bankingApi.getCipherStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load Cipher stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await bankingApi.getCipherUsers();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load Cipher users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const data = await bankingApi.getCipherTransactions({
        search: txSearch || undefined,
        type: txTypeFilter !== 'all' ? txTypeFilter : undefined,
        direction: (txDirectionFilter === 'credit' || txDirectionFilter === 'debit') ? txDirectionFilter : undefined,
        status: txStatusFilter !== 'all' ? txStatusFilter : undefined,
      });
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Failed to load Cipher transactions:', err);
    } finally {
      setTxLoading(false);
    }
  }, [txSearch, txTypeFilter, txDirectionFilter, txStatusFilter]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const data = await bankingApi.getCipherConfig();
      setAppConfig(data.config);
    } catch (err) {
      console.error('Failed to load Cipher config:', err);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadAudits = useCallback(async () => {
    setAuditsLoading(true);
    try {
      const data = await bankingApi.getCipherAudits();
      setAudits(data.audits || []);
    } catch (err) {
      console.error('Failed to load Cipher audits:', err);
    } finally {
      setAuditsLoading(false);
    }
  }, []);

  // Refresh all privileged data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadStats(),
      loadUsers(),
      loadTransactions(),
      loadConfig(),
      loadAudits(),
    ]);
  }, [loadStats, loadUsers, loadTransactions, loadConfig, loadAudits]);

  // Load when authorized
  useEffect(() => {
    if (authorized) {
      refreshAll();
    }
  }, [authorized, refreshAll]);

  // Real-time Firestore customer & account synchronization (Section 2)
  useEffect(() => {
    if (!authorized) return;

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const fsUsers: CipherUserRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const accNum = d.accountNumber || '1029384756';
          const authBank = getAuthoritativeBankInfo(d.bankName);
          const routing = d.routingNumber || authBank.routingNumber;
          const swift = d.swiftCode || authBank.swiftCode;
          const balance = typeof d.balance === 'number' ? d.balance : 0;
          const avail = typeof d.availableBalance === 'number' ? d.availableBalance : balance;
          const accName = d.accountType || 'Premier Checking';
          const accType = accName.toLowerCase().includes('savings') ? 'savings' : 'checking';

          const accounts: CipherUserAccount[] =
            d.accounts && Array.isArray(d.accounts) && d.accounts.length > 0
              ? d.accounts.map((a: any, idx: number) => ({
                  id: a.id || `acc_${docSnap.id}_${idx + 1}`,
                  accountNumber: a.accountNumber || accNum,
                  routingNumber: a.routingNumber || routing,
                  swiftCode: a.swiftCode || swift,
                  type: a.type || accType,
                  name: a.name || accName,
                  balance: typeof a.balance === 'number' ? a.balance : balance,
                  availableBalance: typeof a.availableBalance === 'number' ? a.availableBalance : avail,
                  status: a.status || 'active',
                }))
              : [
                  {
                    id: `acc_${docSnap.id}_1`,
                    accountNumber: accNum,
                    routingNumber: routing,
                    swiftCode: swift,
                    type: accType,
                    name: accName,
                    balance,
                    availableBalance: avail,
                    status: d.status || 'active',
                  },
                ];

          return {
            id: d.id || `usr_${docSnap.id}`,
            clientId: d.clientId || `AR-${docSnap.id.slice(0, 6).toUpperCase()}`,
            firstName: d.firstName || '',
            middleName: d.middleName || undefined,
            lastName: d.lastName || '',
            email: d.email || '',
            phoneNumber: d.phoneNumber || '',
            bankName: d.bankName || authBank.name,
            role: d.role || 'customer',
            status: d.status || 'active',
            transferAccess: d.transferAccess === 'restricted' ? 'restricted' : 'enabled',
            transferRestrictionReason: d.transferRestrictionReason,
            flaggedForReview: Boolean(d.flaggedForReview),
            flagReason: d.flagReason,
            createdAt: d.createdAt || new Date().toISOString(),
            accounts,
            totalBalance: accounts.reduce((sum, a) => sum + (a.balance || 0), 0),
          };
        });

        setUsers((prevBackendUsers) => {
          if (!prevBackendUsers || prevBackendUsers.length === 0) {
            return fsUsers;
          }
          const merged = [...prevBackendUsers];
          fsUsers.forEach((fu) => {
            const existingIdx = merged.findIndex(
              (mu) =>
                mu.id === fu.id ||
                (fu.email && mu.email.toLowerCase() === fu.email.toLowerCase()) ||
                (fu.clientId && mu.clientId.toUpperCase() === fu.clientId.toUpperCase())
            );
            if (existingIdx >= 0) {
              merged[existingIdx] = {
                ...merged[existingIdx],
                transferAccess: fu.transferAccess,
                transferRestrictionReason: fu.transferRestrictionReason,
                bankName: fu.bankName,
                phoneNumber: fu.phoneNumber || merged[existingIdx].phoneNumber,
                accounts: merged[existingIdx].accounts.map((a) => {
                  const matchingFsAcc = fu.accounts.find(
                    (fa) => fa.id === a.id || fa.accountNumber === a.accountNumber
                  );
                  if (matchingFsAcc) {
                    return {
                      ...a,
                      balance: matchingFsAcc.balance,
                      availableBalance: matchingFsAcc.availableBalance,
                      swiftCode: a.swiftCode || matchingFsAcc.swiftCode,
                      routingNumber: a.routingNumber || matchingFsAcc.routingNumber,
                    };
                  }
                  return a;
                }),
              };
            } else {
              merged.push(fu);
            }
          });
          return merged;
        });
      },
      (err) => {
        console.warn('Cipher real-time Firestore synchronization notice:', err);
      }
    );

    return () => unsubscribe();
  }, [authorized]);

  // Handle User Selection for Individual View
  const handleSelectUser = async (u: CipherUserRecord) => {
    setSelectedUser(u);
    setActiveTab('individual');
    try {
      const detailed = await bankingApi.getCipherUser(u.id);
      setSelectedUser(detailed.user);
      setUserTransactions(detailed.transactions || []);
      setUserAudits(detailed.audits || []);
    } catch (err) {
      console.error('Failed to fetch detailed user:', err);
    }
  };

  // Toggle Masked Account Number
  const toggleAccountReveal = (accId: string) => {
    setRevealedAccounts((prev) => ({
      ...prev,
      [accId]: !prev[accId],
    }));
  };

  // Open Transfer Access Modal
  const openTransferAccessModal = (u: CipherUserRecord, newState: 'enabled' | 'restricted') => {
    setTransferAccessUser(u);
    setNewTransferAccessState(newState);
    setTransferAccessReason(
      newState === 'restricted'
        ? 'Unusual activity detected. New device security protocol activated.'
        : 'Authorized security clearance verified by Cipher operator.'
    );
    setTransferAccessModalOpen(true);
  };

  // Submit Transfer Access Change
  const submitTransferAccess = async () => {
    if (!transferAccessUser) return;
    setTransferAccessLoading(true);
    try {
      const res = await bankingApi.setCipherTransferAccess(
        transferAccessUser.id,
        newTransferAccessState,
        transferAccessReason.trim() || undefined
      );

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === transferAccessUser.id ? { ...u, transferAccess: res.transferAccess } : u))
      );

      if (selectedUser?.id === transferAccessUser.id) {
        setSelectedUser((prev) => (prev ? { ...prev, transferAccess: res.transferAccess } : null));
      }

      // Update Firestore document under users/{uid} for real-time propagation across app
      try {
        const uid = transferAccessUser.id.startsWith('usr_')
          ? transferAccessUser.id.slice(4)
          : transferAccessUser.id;
        await setDoc(
          doc(db, 'users', uid),
          {
            transferAccess: res.transferAccess,
            transferRestrictionReason: transferAccessReason.trim() || null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Firestore transfer access sync notice:', fsErr);
      }

      setTransferAccessModalOpen(false);
      await loadStats();
      await loadAudits();
    } catch (err: any) {
      alert(err.message || 'Failed to update transfer access');
    } finally {
      setTransferAccessLoading(false);
    }
  };

  // Execute Balance Adjustment
  const handleExecuteAdjustment = async () => {
    if (!adjustAccountId || !adjustAmount || !adjustReason.trim()) {
      setAdjustErrorMsg('Account, amount, and justification reason are strictly required.');
      return;
    }

    const numAmount = parseFloat(adjustAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAdjustErrorMsg('Please provide a positive numerical adjustment amount.');
      return;
    }

    if (adjustReason.trim().length < 5) {
      setAdjustErrorMsg('Reason must be at least 5 characters documenting authorization basis.');
      return;
    }

    setAdjustLoading(true);
    setAdjustErrorMsg('');
    setAdjustSuccessMsg('');

    try {
      const res = await bankingApi.executeBalanceAdjustment({
        accountId: adjustAccountId,
        type: adjustType,
        amount: numAmount,
        reason: adjustReason.trim(),
      });

      const updatedBalance = res.account?.balance ?? res.newBalance ?? (
        targetAccountForAdjustment
          ? (adjustType === 'credit'
              ? targetAccountForAdjustment.balance + numAmount
              : targetAccountForAdjustment.balance - numAmount)
          : 0
      );
      const auditRef = res.audit?.id ?? res.auditId ?? 'AUD-CIPHER';

      setAdjustSuccessMsg(
        `Adjustment executed successfully. New balance: ${formatCurrency(updatedBalance)} (Audit Ref: ${auditRef})`
      );
      setIsConfirmingAdjustment(false);
      setAdjustAmount('');
      setAdjustReason('');

      // Synchronize balance update to Firestore document for real-time propagation across app
      try {
        const targetUser = selectedUser || users.find((u) => u.accounts.some((a) => a.id === adjustAccountId));
        if (targetUser) {
          const uid = targetUser.id.startsWith('usr_') ? targetUser.id.slice(4) : targetUser.id;
          await setDoc(
            doc(db, 'users', uid),
            {
              balance: updatedBalance,
              availableBalance: updatedBalance,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (fsErr) {
        console.warn('Firestore balance adjustment sync notice:', fsErr);
      }

      await refreshAll();

      if (selectedUser) {
        const updated = await bankingApi.getCipherUser(selectedUser.id);
        setSelectedUser(updated.user);
        setUserTransactions(updated.transactions || []);
      }
    } catch (err: any) {
      setAdjustErrorMsg(err.message || 'Failed to execute balance adjustment.');
      setIsConfirmingAdjustment(false);
    } finally {
      setAdjustLoading(false);
    }
  };

  // Direct Balance Adjustment Handlers (PART 3)
  const handleOpenDirectBalanceModal = (accountId?: string) => {
    if (!selectedUser) return;
    const targetAcc = accountId
      ? selectedUser.accounts.find((a) => a.id === accountId)
      : selectedUser.accounts[0];
    setDirectBalanceAccountId(targetAcc?.id || selectedUser.accounts[0]?.id || '');
    setDirectBalanceMode('amount');
    setDirectBalanceType('credit');
    setDirectBalanceInput('');
    setDirectBalanceReason('');
    setDirectBalanceStep('input');
    setDirectBalanceError('');
    setDirectBalanceSuccess('');
    setIsDirectBalanceModalOpen(true);
  };

  const handleExecuteDirectBalanceAdjustment = async () => {
    if (!selectedUser || !directBalanceAccountId) return;
    const targetAcc = selectedUser.accounts.find((a) => a.id === directBalanceAccountId);
    if (!targetAcc) return;

    const val = parseFloat(directBalanceInput);
    if (isNaN(val) || val <= 0) {
      setDirectBalanceError('Please enter a valid positive numerical amount.');
      return;
    }

    if (!directBalanceReason || directBalanceReason.trim().length < 5) {
      setDirectBalanceError('A mandatory compliance reason (minimum 5 characters) is required.');
      return;
    }

    let calculatedAdjustmentAmount = val;
    let calculatedType: 'credit' | 'debit' = directBalanceType;

    if (directBalanceMode === 'replacement') {
      const diff = val - targetAcc.balance;
      if (diff === 0) {
        setDirectBalanceError('Replacement balance matches current balance. No adjustment required.');
        return;
      }
      calculatedType = diff > 0 ? 'credit' : 'debit';
      calculatedAdjustmentAmount = Math.abs(diff);
    }

    setDirectBalanceLoading(true);
    setDirectBalanceError('');
    try {
      const res = await bankingApi.executeBalanceAdjustment({
        targetUserId: selectedUser.id,
        targetAccountId: directBalanceAccountId,
        type: calculatedType,
        amount: calculatedAdjustmentAmount,
        reason: directBalanceReason.trim(),
      });

      const updatedAccount = res.account;

      // Update selectedUser accounts in state
      setSelectedUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === directBalanceAccountId ? updatedAccount : a
          ),
        };
      });

      // Update in users array
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === selectedUser.id) {
            return {
              ...u,
              accounts: u.accounts.map((a) =>
                a.id === directBalanceAccountId ? updatedAccount : a
              ),
            };
          }
          return u;
        })
      );

      // Refresh transactions and stats
      loadStats();
      const uData = await bankingApi.getCipherUser(selectedUser.id);
      if (uData.transactions) {
        setUserTransactions(uData.transactions);
      }

      // Synchronize balance update to Firestore document for real-time propagation across app
      try {
        const uid = selectedUser.id.startsWith('usr_') ? selectedUser.id.slice(4) : selectedUser.id;
        await setDoc(
          doc(db, 'users', uid),
          {
            balance: updatedAccount.balance,
            availableBalance: updatedAccount.availableBalance,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Firestore direct balance adjustment sync notice:', fsErr);
      }

      setDirectBalanceSuccess(
        `Successfully applied $${calculatedAdjustmentAmount.toFixed(2)} ${calculatedType.toUpperCase()} adjustment. New verified balance: ${formatCurrency(updatedAccount.balance)}.`
      );
      setTimeout(() => {
        setIsDirectBalanceModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setDirectBalanceError(err.message || 'Balance adjustment failed.');
    } finally {
      setDirectBalanceLoading(false);
    }
  };

  // Transaction Correction Handlers (PART 4)
  const handleOpenTxCorrection = (tx: BankTransaction) => {
    setCorrectingTx(tx);
    setTxCorrectionForm({
      description: tx.description || '',
      category: tx.category || 'General',
      amount: String(tx.amount || 0),
      timestamp: tx.timestamp || new Date().toISOString(),
      senderName: (tx as any).senderName || '',
      senderAccount: (tx as any).senderAccount || '',
      senderBank: (tx as any).senderBank || '',
      recipientName: (tx as any).recipientName || '',
      recipientAccount: (tx as any).recipientAccount || '',
      recipientBank: (tx as any).recipientBank || '',
      status: (tx.status as any) || 'completed',
    });
    setTxCorrectionReason('');
    setTxCorrectionStep('edit');
    setTxCorrectionError('');
    setTxCorrectionSuccess('');
    setIsTxCorrectionModalOpen(true);
  };

  const handleExecuteTxCorrection = async () => {
    if (!correctingTx) return;

    const numAmount = parseFloat(txCorrectionForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setTxCorrectionError('Please enter a valid positive numerical amount.');
      return;
    }

    if (!txCorrectionReason || txCorrectionReason.trim().length < 5) {
      setTxCorrectionError('A mandatory compliance reason (minimum 5 characters) is required for transaction corrections.');
      return;
    }

    setTxCorrectionLoading(true);
    setTxCorrectionError('');
    try {
      const res = await bankingApi.correctCipherTransaction(correctingTx.id, {
        reason: txCorrectionReason.trim(),
        description: txCorrectionForm.description.trim(),
        category: txCorrectionForm.category.trim(),
        amount: numAmount,
        timestamp: txCorrectionForm.timestamp,
        senderName: txCorrectionForm.senderName.trim() || undefined,
        senderAccount: txCorrectionForm.senderAccount.trim() || undefined,
        senderBank: txCorrectionForm.senderBank.trim() || undefined,
        recipientName: txCorrectionForm.recipientName.trim() || undefined,
        recipientAccount: txCorrectionForm.recipientAccount.trim() || undefined,
        recipientBank: txCorrectionForm.recipientBank.trim() || undefined,
        status: txCorrectionForm.status,
      });

      // Update in local transactions list
      setUserTransactions((prev) =>
        prev.map((t) => (t.id === correctingTx.id ? res.transaction : t))
      );

      // If account balance was reconciled, update selectedUser account
      if (res.account && selectedUser) {
        setSelectedUser((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            accounts: prev.accounts.map((a) => (a.id === res.account.id ? res.account : a)),
          };
        });
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === selectedUser.id) {
              return {
                ...u,
                accounts: u.accounts.map((a) => (a.id === res.account.id ? res.account : a)),
              };
            }
            return u;
          })
        );
      }

      setTxCorrectionSuccess('Transaction correction successfully committed and audited.');
      setTimeout(() => {
        setIsTxCorrectionModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setTxCorrectionError(err.message || 'Transaction correction failed.');
    } finally {
      setTxCorrectionLoading(false);
    }
  };

  // Quick Transfer Access Toggle (PART 5)
  const handleQuickToggleTransferAccess = async (targetStatus: 'enabled' | 'restricted') => {
    if (!selectedUser) return;
    try {
      const reason = targetStatus === 'restricted'
        ? 'Administrative security restriction applied via Cipher Control Panel'
        : 'Administrative clearance restored via Cipher Control Panel';

      const res = await bankingApi.setCipherTransferAccess(selectedUser.id, targetStatus, reason);

      setSelectedUser((prev) => (prev ? { ...prev, transferAccess: res.transferAccess } : null));
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, transferAccess: res.transferAccess } : u))
      );
      await loadAudits();
    } catch (err: any) {
      console.error('Failed to toggle transfer access:', err);
    }
  };

  // Save Application Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appConfig) return;

    setConfigLoading(true);
    setConfigSaveSuccess(false);
    setConfigSaveError('');

    try {
      const res = await bankingApi.updateCipherConfig(appConfig);
      setAppConfig(res.config);
      setConfigSaveSuccess(true);
      setTimeout(() => setConfigSaveSuccess(false), 4000);
      await loadAudits();
    } catch (err: any) {
      setConfigSaveError(err.message || 'Failed to save application controls.');
    } finally {
      setConfigLoading(false);
    }
  };

  // Filtered Users Directory
  const filteredUsers = users.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const email = u.email.toLowerCase();
    const clientId = u.clientId.toLowerCase();
    const hasMatchingAccount = u.accounts.some((acc) => acc.accountNumber.includes(q));
    return fullName.includes(q) || email.includes(q) || clientId.includes(q) || hasMatchingAccount;
  });

  // Selected Account for Adjustment
  const allAccountsList = users.flatMap((u) =>
    u.accounts.map((acc) => ({
      ...acc,
      holderName: `${u.firstName} ${u.lastName}`,
      clientId: u.clientId,
      userId: u.id,
    }))
  );

  const targetAccountForAdjustment = allAccountsList.find((a) => a.id === adjustAccountId);

  // RENDER: Loading or Access Denied
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1C2B4C] to-[#2E4057] flex items-center justify-center mb-4 shadow-xl border border-slate-700">
          <Activity className="w-8 h-8 text-[#C8102E] animate-pulse" />
        </div>
        <h2 className="text-xl font-mono tracking-widest text-slate-200">CIPHER GATEWAY</h2>
        <p className="text-xs text-slate-400 mt-2 font-mono">Verifying cryptographic authorization claims...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#070D1E] flex flex-col items-center justify-center p-6 text-white animate-fadeIn">
        <div className="max-w-md w-full bg-[#10192A] border border-red-900/50 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-600/50 flex items-center justify-center mx-auto text-red-500 shadow-lg">
            <Lock className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div>
            <span className="px-3 py-1 bg-red-900/40 border border-red-700/60 rounded-full text-red-400 text-[10px] font-mono tracking-widest uppercase">
              Security Protocol 403
            </span>
            <h1 className="text-2xl font-black tracking-wider text-white mt-3 font-mono">ACCESS DENIED</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              This administrative interface is strictly reserved for the designated <strong>CIPHER</strong> security operator. Unverified requests are cryptographically rejected and logged.
            </p>
            {authError && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-900 rounded-xl text-red-300 text-xs font-mono">
                {authError}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateHome}
              className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-2 cursor-pointer border border-slate-700"
            >
              <Home className="w-4 h-4" />
              <span>Return to Aurelith Reserve</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: Authorized Cipher Control Panel
  return (
    <div className="min-h-screen bg-[#0B1325] text-slate-200 flex flex-col font-sans selection:bg-[#C8102E] selection:text-white">
      {/* Top CIPHER Administrative Bar */}
      <header className="sticky top-0 z-40 bg-[#0E172E]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1C2B4C] to-[#C8102E] flex items-center justify-center text-white shadow-md border border-red-500/30 font-serif font-black text-base">
            C
          </div>
          <span className="text-lg font-black tracking-wider text-white font-mono">CIPHER</span>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshAll}
            disabled={statsLoading || usersLoading}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Synchronize Data with Server"
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading || usersLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Administrative Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 bg-[#0A1020] border-r border-slate-800 p-4 space-y-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#1C2B4C] text-white border border-blue-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4 text-blue-400" />
            <span>Overview &amp; Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#1C2B4C] text-white border border-blue-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>User Management</span>
            {stats && (stats.suspendedOrRestrictedAccounts > 0 || (stats.restrictedUsersCount ?? 0) > 0) && (
              <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                {stats.suspendedOrRestrictedAccounts ?? stats.restrictedUsersCount}
              </span>
            )}
          </button>

          {selectedUser && (
            <button
              onClick={() => setActiveTab('individual')}
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
                activeTab === 'individual'
                  ? 'bg-[#1C2B4C] text-white border border-blue-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span className="truncate">Profile: {selectedUser.firstName}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('balance')}
            className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
              activeTab === 'balance'
                ? 'bg-[#1C2B4C] text-white border border-blue-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>Balance Management</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-[#1C2B4C] text-white border border-blue-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
            <span>Transaction Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('controls')}
            className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
              activeTab === 'controls'
                ? 'bg-[#1C2B4C] text-white border border-blue-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Application Controls</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#1C2B4C] text-white border border-blue-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Administrative Audit</span>
          </button>
        </nav>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-7xl">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Cipher Intelligence &amp; Overview</h2>
                <p className="text-xs text-slate-400 mt-1">Real-time telemetry, ledger volumes, and account security metrics.</p>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Users */}
                <div className="bg-[#10192A] p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Registered Customers</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {stats?.totalRegisteredUsers ?? stats?.totalUsers ?? '...'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Active Accounts: <span className="text-emerald-400 font-bold">{stats?.activeAccounts ?? stats?.activeAccountsCount ?? 0}</span>
                  </div>
                </div>

                {/* Restricted Accounts */}
                <div className="bg-[#10192A] p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Transfer Access Restricted</span>
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {stats?.suspendedOrRestrictedAccounts ?? stats?.restrictedUsersCount ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Flagged for Review: <span className="text-red-400 font-bold">{stats?.accountsRequiringSecurityReview ?? stats?.flaggedForReviewCount ?? 0}</span>
                  </div>
                </div>

                {/* Outflow Volume */}
                <div className="bg-[#10192A] p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Total Outflow Volume</span>
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {stats ? formatCurrency(stats.totalOutgoingVolume ?? stats.outgoingVolume ?? 0) : '...'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Transactions: <span className="text-slate-200 font-bold">{stats?.totalOutgoingTransactions ?? stats?.outgoingTransactionsCount ?? 0}</span>
                  </div>
                </div>

                {/* Inflow Volume */}
                <div className="bg-[#10192A] p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Total Inflow Volume</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {stats ? formatCurrency(stats.totalIncomingVolume ?? stats.incomingVolume ?? 0) : '...'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Transactions: <span className="text-slate-200 font-bold">{stats?.totalIncomingTransactions ?? stats?.incomingTransactionsCount ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Quick Status Banners */}
              {appConfig && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#10192A] border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center space-x-2">
                        <span>Global Bank Transfers:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                          appConfig.globalTransfersEnabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                        }`}>
                          {appConfig.globalTransfersEnabled ? 'OPERATIONAL' : 'OFFLINE'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Controls interbank and P2P rails platform-wide.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('controls')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      Configure &rarr;
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#10192A] border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center space-x-2">
                        <span>Maintenance Banner:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                          appConfig.maintenanceNoticeEnabled ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {appConfig.maintenanceNoticeEnabled ? 'BROADCASTING' : 'INACTIVE'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Public announcement broadcast to customer portals.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('controls')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      Broadcast &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Transactions in Overview */}
              <div className="bg-[#10192A] rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Recent Banking Activity</h3>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    View All &rarr;
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E1524] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4">Client / Party</th>
                        <th className="py-3 px-4">Direction</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {(stats?.recentTransactions || []).slice(0, 5).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-200">{tx.reference || tx.id}</td>
                          <td className="py-3 px-4 font-sans text-slate-300">
                            {tx.recipientName || tx.senderName || (tx as any).accountHolderName || 'Aurelith Client'}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                tx.direction === 'credit' || (tx as any).direction === 'inflow' || tx.type === 'deposit'
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {tx.direction}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                            {new Date(tx.timestamp || (tx as any).date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(stats?.recentTransactions || []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                            No recent transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">Customer Directory</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage client profiles, inspect balances, and configure Transfer Access restrictions.
                  </p>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Client ID, Account #, or Name..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#10192A] border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Users Directory Table */}
              <div className="bg-[#10192A] rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E1524] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Client ID</th>
                        <th className="py-3 px-4">Customer Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Account Number</th>
                        <th className="py-3 px-4">Available Balance</th>
                        <th className="py-3 px-4">Transfer Access</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.map((u) => {
                        const primaryAcc = u.accounts[0];
                        const isRestricted = u.transferAccess === 'restricted';
                        return (
                          <tr key={u.id} className="hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-mono font-bold text-blue-400">
                              {u.clientId}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              {u.firstName} {u.lastName}
                              {u.flaggedForReview && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-red-950 text-red-300 border border-red-800">
                                  FLAGGED
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                              {u.email}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {primaryAcc?.accountNumber || 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              {formatCurrency(primaryAcc?.availableBalance ?? primaryAcc?.balance ?? 0)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                                  isRestricted
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {isRestricted ? (
                                  <>
                                    <Lock className="w-3 h-3 shrink-0" />
                                    <span>Restricted</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3 shrink-0" />
                                    <span>Enabled</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                onClick={() => handleSelectUser(u)}
                                className="py-1 px-2.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Manage
                              </button>
                              <button
                                onClick={() => openTransferAccessModal(u, isRestricted ? 'enabled' : 'restricted')}
                                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                  isRestricted
                                    ? 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400'
                                    : 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400'
                                }`}
                              >
                                {isRestricted ? 'Unrestrict' : 'Restrict'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No customers match query "{userSearchQuery}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INDIVIDUAL ACCOUNT MANAGEMENT */}
          {/* TAB 3: INDIVIDUAL ACCOUNT MANAGEMENT (SECTIONS 2, 3, 4, 5) */}
          {activeTab === 'individual' && selectedUser && (
            <div className="space-y-6 animate-fadeIn">
              {/* Top Navigation & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="text-xs text-blue-400 hover:underline cursor-pointer flex items-center space-x-1"
                  >
                    <span>&larr;</span>
                    <span>Customers Directory</span>
                  </button>
                  <h2 className="text-xl font-bold text-white tracking-wide mt-1">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedUser.email}</p>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenDirectBalanceModal()}
                    className="py-2 px-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Adjust Balance</span>
                  </button>
                </div>
              </div>

              {/* Authoritative Customer Profile Card (SECTION 2 & 5) */}
              <div className="bg-[#10192A] rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
                      Authoritative Profile Record
                    </span>
                    <div className="text-lg font-bold text-white">
                      {selectedUser.firstName} {selectedUser.middleName ? `${selectedUser.middleName} ` : ''}{selectedUser.lastName}
                    </div>
                  </div>

                  {/* Per-User Transfer Access Control (SECTION 5) */}
                  <div className="bg-[#0B1325] border border-slate-700/80 rounded-xl p-2.5 flex items-center space-x-3">
                    <div className="text-xs">
                      <span className="text-slate-400 font-medium block text-[11px]">Transfer Access</span>
                      <span className={`font-mono font-bold text-xs ${selectedUser.transferAccess === 'restricted' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {selectedUser.transferAccess === 'restricted' ? 'RESTRICTED' : 'ENABLED'}
                      </span>
                    </div>

                    <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleQuickToggleTransferAccess('enabled')}
                        className={`py-1 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                          selectedUser.transferAccess !== 'restricted'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>ENABLED</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickToggleTransferAccess('restricted')}
                        className={`py-1 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                          selectedUser.transferAccess === 'restricted'
                            ? 'bg-[#C8102E] text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        <span>RESTRICTED</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Grid of authoritative details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Email Address:</span>
                    <span className="text-slate-200 font-bold break-all">{selectedUser.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Phone Number:</span>
                    <span className="text-slate-200 font-bold">{selectedUser.phoneNumber || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Financial Institution:</span>
                    <span className="text-slate-200 font-bold">{(selectedUser as any).bankName || 'Aurelith Reserve'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Account Status:</span>
                    <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {selectedUser.status === 'active' ? 'Active / In Good Standing' : 'Pending Verification'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Client ID:</span>
                    <span className="text-blue-400 font-bold">{selectedUser.clientId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Total Ledger Balance:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {formatCurrency(
                        selectedUser.accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Total Available Balance:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {formatCurrency(
                        selectedUser.accounts.reduce((sum, a) => sum + (a.availableBalance ?? a.balance ?? 0), 0)
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Transfer Restriction:</span>
                    <span className={`font-bold ${selectedUser.transferAccess === 'restricted' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {selectedUser.transferAccess === 'restricted' ? 'Active Security Restriction' : 'No Restrictions'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transfer Access Warning Banner if Restricted */}
              {selectedUser.transferAccess === 'restricted' && (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-xs flex items-center space-x-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold">Transfer Access Is Restricted:</span> When attempting a transfer, customer will be presented with:
                    <span className="font-mono block text-red-300 bg-black/50 px-2.5 py-1.5 rounded-lg border border-red-800/50">
                      "New IP detected. Unusual activity. Wait 24 to 48 hours and try again."
                    </span>
                    {selectedUser.transferRestrictionReason && (
                      <span className="text-[11px] text-amber-300/80 block">
                        Reason on file: {selectedUser.transferRestrictionReason}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Accounts Card List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Deposit &amp; Custody Accounts</h3>
                  <span className="text-xs text-slate-400 font-mono">{selectedUser.accounts.length} Account(s)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedUser.accounts.map((acc) => {
                    const isRevealed = revealedAccounts[acc.id];
                    return (
                      <div key={acc.id} className="p-5 rounded-2xl bg-[#10192A] border border-slate-800 space-y-4 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase">{acc.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-950 text-blue-300 border border-blue-800">
                            {acc.type}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 block font-mono">Available Balance:</span>
                            <div className="text-xl font-black text-emerald-400 font-mono">
                              {formatCurrency(acc.availableBalance ?? acc.balance)}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 block font-mono">Ledger Balance:</span>
                            <div className="text-xl font-black text-slate-200 font-mono">
                              {formatCurrency(acc.balance)}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Account Number:</span>
                            <div className="flex items-center space-x-1.5 text-white font-bold">
                              <span>
                                {isRevealed
                                  ? acc.accountNumber
                                  : `•••• •••• ${acc.accountNumber.slice(-4)}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleAccountReveal(acc.id)}
                                className="p-1 hover:text-blue-400 transition-colors cursor-pointer"
                                title={isRevealed ? 'Hide account number' : 'Reveal full account number'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Routing (ABA):</span>
                            <span className="text-slate-300 font-bold">{acc.routingNumber || '111301122'}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">SWIFT / BIC:</span>
                            <span className="text-slate-300 font-bold">{acc.swiftCode || 'AURUS33D'}</span>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDirectBalanceModal(acc.id)}
                            className="w-full py-2 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Adjust Balance for This Account</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions Ledger for this individual user (SECTION 4) */}
              <div className="bg-[#10192A] rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Client Transaction Ledger</h3>
                    <p className="text-[11px] text-slate-400">Inspect transaction records or initiate authorized financial corrections</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{userTransactions.length} Record(s)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E1524] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4">Description / Recipient</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {userTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-200">
                            {tx.reference || tx.id}
                            {(tx as any).correctionHistory && (tx as any).correctionHistory.length > 0 && (
                              <span className="block text-[9px] text-amber-400 font-sans">
                                (Amended {(tx as any).correctionHistory.length}x)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-300">
                            {tx.recipientName || (tx as any).note || tx.description || 'Transaction'}
                          </td>
                          <td className="py-3 px-4 font-sans uppercase text-[10px]">
                            {tx.type}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                            {new Date(tx.timestamp || (tx as any).date).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenTxCorrection(tx)}
                              className="py-1 px-2.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-lg text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center space-x-1"
                              title="Authorized Transaction Correction"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Correct</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {userTransactions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                            No transactions recorded for this account.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BALANCE MANAGEMENT */}
          {activeTab === 'balance' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Balance Management &amp; Adjustments</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Execute authorized administrative credit or debit balance adjustments. All changes require documented justification and generate immutable audit logs.
                </p>
              </div>

              {adjustSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-600/50 text-emerald-200 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{adjustSuccessMsg}</span>
                </div>
              )}

              {adjustErrorMsg && (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-600/50 text-red-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{adjustErrorMsg}</span>
                </div>
              )}

              <div className="bg-[#10192A] p-6 rounded-2xl border border-slate-800 space-y-4">
                {/* Target Account Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Select Target Account
                  </label>
                  <select
                    value={adjustAccountId}
                    onChange={(e) => setAdjustAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#0B1325] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  >
                    <option value="">-- Choose Account from Directory --</option>
                    {allAccountsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.clientId} | {a.holderName} | {a.name} ({a.accountNumber}) | Current: {formatCurrency(a.balance)}
                      </option>
                    ))}
                  </select>
                </div>

                {targetAccountForAdjustment && (
                  <div className="p-4 rounded-xl bg-[#0B1325] border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Holder:</span>
                      <span className="text-white font-bold">{targetAccountForAdjustment.holderName} ({targetAccountForAdjustment.clientId})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Ledger Balance:</span>
                      <span className="text-emerald-400 font-mono font-bold">{formatCurrency(targetAccountForAdjustment.balance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Available Balance:</span>
                      <span className="text-emerald-400 font-mono font-bold">{formatCurrency(targetAccountForAdjustment.availableBalance ?? targetAccountForAdjustment.balance)}</span>
                    </div>
                  </div>
                )}

                {/* Adjustment Direction */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Adjustment Direction
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAdjustType('credit')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-colors cursor-pointer ${
                        adjustType === 'credit'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500'
                          : 'bg-[#0B1325] text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <PlusCircle className="w-4 h-4 text-emerald-400" />
                      <span>Credit (+) Balance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdjustType('debit')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-colors cursor-pointer ${
                        adjustType === 'debit'
                          ? 'bg-rose-950/60 text-rose-300 border-rose-500'
                          : 'bg-[#0B1325] text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <MinusCircle className="w-4 h-4 text-rose-400" />
                      <span>Debit (-) Balance</span>
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Adjustment Amount ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 bg-[#0B1325] border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Mandatory Justification / Reason (min 5 chars)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Authorized wire adjustment per settlement ticket #90214"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#0B1325] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Projected New Balance Preview */}
                {targetAccountForAdjustment && parseFloat(adjustAmount) > 0 && (
                  <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-900/40 text-xs flex justify-between items-center font-mono">
                    <span className="text-blue-300 font-sans">Projected Balance After Adjustment:</span>
                    <span className="text-base font-bold text-white">
                      {formatCurrency(
                        adjustType === 'credit'
                          ? targetAccountForAdjustment.balance + parseFloat(adjustAmount)
                          : targetAccountForAdjustment.balance - parseFloat(adjustAmount)
                      )}
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!adjustAccountId || !adjustAmount || adjustReason.trim().length < 5 || adjustLoading}
                    onClick={() => setIsConfirmingAdjustment(true)}
                    className="w-full py-3 px-4 bg-[#C8102E] hover:bg-[#A00B22] text-white font-bold text-xs sm:text-sm rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md flex items-center justify-center space-x-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Review &amp; Execute Adjustment</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TRANSACTION MONITORING */}
          {activeTab === 'transactions' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">Global Transaction Ledger</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Universal ledger of all domestic, interbank, book, and administrative transfers.
                  </p>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Reference, Recipient, or Client ID..."
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#10192A] border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Direction</label>
                  <select
                    value={txDirectionFilter}
                    onChange={(e) => setTxDirectionFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#10192A] border border-slate-800 rounded-lg text-xs text-white"
                  >
                    <option value="all">All Directions</option>
                    <option value="inflow">Inflow (+)</option>
                    <option value="outflow">Outflow (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Type</label>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#10192A] border border-slate-800 rounded-lg text-xs text-white"
                  >
                    <option value="all">All Types</option>
                    <option value="wire">Wire / External</option>
                    <option value="transfer">Internal / P2P</option>
                    <option value="deposit">Deposit</option>
                    <option value="adjustment">Administrative Adjustment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
                  <select
                    value={txStatusFilter}
                    onChange={(e) => setTxStatusFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#10192A] border border-slate-800 rounded-lg text-xs text-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={loadTransactions}
                    className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>

              {/* Transaction Ledger Table */}
              <div className="bg-[#10192A] rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E1524] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4">Counterparty / Description</th>
                        <th className="py-3 px-4">Bank / Rail</th>
                        <th className="py-3 px-4">Direction</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-200">{tx.reference || tx.id}</td>
                          <td className="py-3 px-4 font-sans text-slate-300">
                            {tx.recipientName || tx.senderName || (tx as any).accountHolderName || tx.description || 'Transfer'}
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                            {tx.recipientBank || tx.senderBank || (tx as any).bankName || 'Aurelith Reserve'}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                tx.direction === 'credit' || (tx as any).direction === 'inflow' || tx.type === 'deposit'
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {tx.direction}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                            {new Date(tx.timestamp || (tx as any).date).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-sans">
                            <button
                              onClick={() => setSelectedTx(tx)}
                              className="text-blue-400 hover:underline cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                            No transactions found matching criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: APPLICATION CONTROLS */}
          {activeTab === 'controls' && appConfig && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Application Controls &amp; Settings</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage platform maintenance broadcasts, emergency transfer kill-switches, and customer service notices.
                </p>
              </div>

              {configSaveSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-600/50 text-emerald-200 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Platform configuration successfully saved and synchronized.</span>
                </div>
              )}

              {configSaveError && (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-600/50 text-red-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{configSaveError}</span>
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="space-y-6">
                {/* Global Transfers Switch */}
                <div className="bg-[#10192A] p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Global Bank Transfers Availability</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Controls whether users across the platform can initiate transfers.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appConfig.globalTransfersEnabled}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, globalTransfersEnabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>

                {/* Maintenance Announcement */}
                <div className="bg-[#10192A] p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Maintenance Announcement Broadcast</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Displays an urgent or informative banner across customer screens.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appConfig.maintenanceNoticeEnabled}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, maintenanceNoticeEnabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {appConfig.maintenanceNoticeEnabled && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                          Notice Severity
                        </label>
                        <select
                          value={appConfig.maintenanceSeverity}
                          onChange={(e: any) =>
                            setAppConfig({ ...appConfig, maintenanceSeverity: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-xs text-white"
                        >
                          <option value="info">Information (Blue)</option>
                          <option value="warning">Warning (Amber)</option>
                          <option value="alert">Critical Alert (Red)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                          Announcement Text
                        </label>
                        <textarea
                          rows={2}
                          value={appConfig.maintenanceNoticeText}
                          onChange={(e) =>
                            setAppConfig({ ...appConfig, maintenanceNoticeText: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Service Notice */}
                <div className="bg-[#10192A] p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Customer Service Notice</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Controls contact information presented to clients when accounts are restricted.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appConfig.customerServiceNoticeEnabled}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, customerServiceNoticeEnabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Support Hotline
                      </label>
                      <input
                        type="text"
                        value={appConfig.customerServicePhone}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, customerServicePhone: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Operating Hours
                      </label>
                      <input
                        type="text"
                        value={appConfig.customerServiceHours}
                        onChange={(e) =>
                          setAppConfig({ ...appConfig, customerServiceHours: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={configLoading}
                    className="w-full py-3 px-4 bg-[#1C2B4C] hover:bg-[#2A3E6D] text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer border border-blue-500/40 shadow-md flex items-center justify-center space-x-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{configLoading ? 'Saving Settings...' : 'Save Application Controls'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 7: ADMINISTRATIVE AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Administrative Audit Ledger</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Cryptographically verified, immutable record of all operator actions, balance changes, and transfer access adjustments.
                </p>
              </div>

              <div className="bg-[#10192A] rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E1524] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Audit ID</th>
                        <th className="py-3 px-4">Operator</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Target</th>
                        <th className="py-3 px-4">Changes</th>
                        <th className="py-3 px-4">Reason / Basis</th>
                        <th className="py-3 px-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {audits.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-300">{a.id}</td>
                          <td className="py-3 px-4 text-blue-400">{a.operatorEmail}</td>
                          <td className="py-3 px-4 font-sans font-bold text-white">{a.action}</td>
                          <td className="py-3 px-4 text-slate-300">{a.targetType}: {a.targetId}</td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {a.previousValue !== undefined && (
                              <span>{String(a.previousValue)} &rarr; {String(a.newValue)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-300 max-w-xs truncate" title={a.reason}>
                            {a.reason || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                            {new Date(a.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {audits.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                            No administrative audit records logged yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: TRANSFER ACCESS MODAL */}
      {transferAccessModalOpen && transferAccessUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fadeIn">
          <div className="bg-[#10192A] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  newTransferAccessState === 'restricted'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}
              >
                {newTransferAccessState === 'restricted' ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <Unlock className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {newTransferAccessState === 'restricted' ? 'Restrict Transfer Access' : 'Enable Transfer Access'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {transferAccessUser.firstName} {transferAccessUser.lastName} ({transferAccessUser.clientId})
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed">
              {newTransferAccessState === 'restricted' ? (
                <p>
                  Setting status to <strong>Restricted</strong> blocks all outgoing transfers for this user. When attempting a transfer, the user will see:
                  <span className="block mt-2 font-mono p-2.5 rounded-xl bg-[#0B1325] border border-amber-800/40 text-amber-300 font-semibold">
                    "Unusual activity detected. New device. Please contact your bank."
                  </span>
                </p>
              ) : (
                <p>
                  Setting status to <strong>Enabled</strong> restores full normal transfer capabilities for this client.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Administrative Justification / Reason
              </label>
              <textarea
                rows={2}
                value={transferAccessReason}
                onChange={(e) => setTransferAccessReason(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTransferAccessModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transferAccessLoading}
                onClick={submitTransferAccess}
                className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  newTransferAccessState === 'restricted'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {transferAccessLoading ? 'Updating...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BALANCE ADJUSTMENT CONFIRMATION MODAL */}
      {isConfirmingAdjustment && targetAccountForAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fadeIn">
          <div className="bg-[#10192A] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-[#C8102E]/20 text-[#C8102E] border border-red-500/40 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Balance Adjustment</h3>
                <p className="text-xs text-slate-400">Irreversible financial ledger entry</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1325] border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between font-sans">
                <span className="text-slate-400">Target Customer:</span>
                <span className="text-white font-bold">{targetAccountForAdjustment.holderName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Account:</span>
                <span className="text-slate-200">{targetAccountForAdjustment.name} ({targetAccountForAdjustment.accountNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Current Balance:</span>
                <span className="text-slate-300">{formatCurrency(targetAccountForAdjustment.balance)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-400 font-sans">Action:</span>
                <span className={adjustType === 'credit' ? 'text-emerald-400' : 'text-rose-400'}>
                  {adjustType === 'credit' ? '+ CREDIT' : '- DEBIT'} {formatCurrency(parseFloat(adjustAmount))}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                <span className="text-slate-400 font-sans">New Balance:</span>
                <span className="text-white text-sm">
                  {formatCurrency(
                    adjustType === 'credit'
                      ? targetAccountForAdjustment.balance + parseFloat(adjustAmount)
                      : targetAccountForAdjustment.balance - parseFloat(adjustAmount)
                  )}
                </span>
              </div>
              <div className="pt-1 text-[11px] text-slate-400 font-sans">
                <span className="font-bold text-slate-300">Reason:</span> "{adjustReason}"
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingAdjustment(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={adjustLoading}
                onClick={handleExecuteAdjustment}
                className="flex-1 py-2.5 bg-[#C8102E] hover:bg-[#A00B22] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
              >
                {adjustLoading ? 'Executing...' : 'Authorize & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSACTION INSPECT MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fadeIn">
          <div className="bg-[#10192A] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Transaction Inspector</h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-slate-400 hover:text-white cursor-pointer text-xs"
              >
                Close &times;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1325] border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Reference:</span>
                <span className="text-white font-bold">{selectedTx.reference || selectedTx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Amount:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(selectedTx.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Counterparty:</span>
                <span className="text-slate-200">{selectedTx.recipientName || selectedTx.senderName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Bank:</span>
                <span className="text-slate-200">{selectedTx.recipientBank || selectedTx.senderBank || (selectedTx as any).bankName || 'Aurelith Reserve'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Routing:</span>
                <span className="text-slate-200">{(selectedTx as any).routingNumber || '111301122'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">SWIFT:</span>
                <span className="text-slate-200">{(selectedTx as any).swiftCode || 'AURUS33D'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Note / Narration:</span>
                <span className="text-slate-200 font-sans">{(selectedTx as any).note || selectedTx.description || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Timestamp:</span>
                <span className="text-slate-400 font-sans">{new Date(selectedTx.timestamp || (selectedTx as any).date).toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DIRECT BALANCE ADJUSTMENT MODAL (SECTION 3) */}
      {isDirectBalanceModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#10192A] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-600/40 flex items-center justify-center text-emerald-400 font-bold">
                  $
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Direct Balance Adjustment</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.clientId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectBalanceModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {directBalanceSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{directBalanceSuccess}</span>
              </div>
            )}

            {directBalanceError && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{directBalanceError}</span>
              </div>
            )}

            {directBalanceStep === 'input' ? (
              <div className="space-y-4 text-xs">
                {/* Target Account Selector */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                    Select Account
                  </label>
                  <select
                    value={directBalanceAccountId}
                    onChange={(e) => setDirectBalanceAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {selectedUser.accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountNumber}) — Current: {formatCurrency(acc.balance)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Current Verified Balances display */}
                {(() => {
                  const targetAcc = selectedUser.accounts.find((a) => a.id === directBalanceAccountId) || selectedUser.accounts[0];
                  if (!targetAcc) return null;
                  return (
                    <div className="p-3.5 rounded-xl bg-[#0B1325] border border-slate-800 grid grid-cols-2 gap-3 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Current Ledger Balance:</span>
                        <span className="text-sm font-bold text-emerald-400">{formatCurrency(targetAcc.balance)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Available Balance:</span>
                        <span className="text-sm font-bold text-emerald-400">{formatCurrency(targetAcc.availableBalance ?? targetAcc.balance)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Adjustment Mode Selector */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1.5 text-[11px]">
                    Adjustment Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-[#0B1325] p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setDirectBalanceMode('amount')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        directBalanceMode === 'amount'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Adjustment Amount
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectBalanceMode('replacement')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        directBalanceMode === 'replacement'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Replacement Balance
                    </button>
                  </div>
                </div>

                {/* Direction (if in amount mode) */}
                {directBalanceMode === 'amount' && (
                  <div>
                    <label className="block text-slate-400 font-bold uppercase mb-1.5 text-[11px]">
                      Direction
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDirectBalanceType('credit')}
                        className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                          directBalanceType === 'credit'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                            : 'bg-[#0B1325] text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ Credit (Increase)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirectBalanceType('debit')}
                        className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                          directBalanceType === 'debit'
                            ? 'bg-red-950 text-red-300 border-red-500'
                            : 'bg-[#0B1325] text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>- Debit (Decrease)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Amount / Replacement Balance Input */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                    {directBalanceMode === 'amount' ? 'Adjustment Amount ($ USD)' : 'Exact Replacement Balance ($ USD)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={directBalanceMode === 'amount' ? '5000.00' : '25000.00'}
                      value={directBalanceInput}
                      onChange={(e) => setDirectBalanceInput(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-[#0B1325] border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Resulting Balance Live Preview */}
                {(() => {
                  const targetAcc = selectedUser.accounts.find((a) => a.id === directBalanceAccountId) || selectedUser.accounts[0];
                  if (!targetAcc) return null;
                  const num = parseFloat(directBalanceInput);
                  if (isNaN(num) || num <= 0) return null;

                  let previewNewBalance = targetAcc.balance;
                  let delta = 0;
                  let directionText = '';

                  if (directBalanceMode === 'replacement') {
                    previewNewBalance = num;
                    delta = num - targetAcc.balance;
                    directionText = delta >= 0 ? `+ Credit of ${formatCurrency(delta)}` : `- Debit of ${formatCurrency(Math.abs(delta))}`;
                  } else {
                    delta = directBalanceType === 'credit' ? num : -num;
                    previewNewBalance = targetAcc.balance + delta;
                    directionText = directBalanceType === 'credit' ? `+ Credit of ${formatCurrency(num)}` : `- Debit of ${formatCurrency(num)}`;
                  }

                  return (
                    <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-600/40 space-y-1 font-mono">
                      <span className="text-[10px] text-blue-300 block uppercase font-sans font-bold">Live Resulting Balance Preview:</span>
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-slate-400">{formatCurrency(targetAcc.balance)}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-sm font-bold text-white">{formatCurrency(previewNewBalance)}</span>
                      </div>
                      <span className="text-[11px] text-blue-300 block font-sans font-medium">({directionText})</span>
                    </div>
                  );
                })()}

                {/* Reason */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                    Mandatory Audit Justification
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Document administrative justification for this balance adjustment..."
                    value={directBalanceReason}
                    onChange={(e) => setDirectBalanceReason(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDirectBalanceModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!directBalanceInput || !directBalanceReason.trim()}
                    onClick={() => {
                      const val = parseFloat(directBalanceInput);
                      if (isNaN(val) || val <= 0) {
                        setDirectBalanceError('Please enter a valid positive numerical amount.');
                        return;
                      }
                      if (!directBalanceReason || directBalanceReason.trim().length < 5) {
                        setDirectBalanceError('Reason must be at least 5 characters documenting authorization basis.');
                        return;
                      }
                      setDirectBalanceError('');
                      setDirectBalanceStep('review');
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <span>Review Adjustment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Review & Confirmation Step */
              <div className="space-y-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-[#0B1325] border border-slate-800 space-y-2.5">
                  <div className="flex justify-between font-sans">
                    <span className="text-slate-400">Target Account Holder:</span>
                    <span className="text-white font-bold">{selectedUser.firstName} {selectedUser.lastName}</span>
                  </div>
                  {(() => {
                    const targetAcc = selectedUser.accounts.find((a) => a.id === directBalanceAccountId) || selectedUser.accounts[0];
                    if (!targetAcc) return null;
                    const num = parseFloat(directBalanceInput);
                    let finalNewBalance = targetAcc.balance;
                    let adjAmount = num;
                    let actionText = '';

                    if (directBalanceMode === 'replacement') {
                      finalNewBalance = num;
                      adjAmount = Math.abs(num - targetAcc.balance);
                      actionText = num >= targetAcc.balance ? `+ CREDIT ${formatCurrency(adjAmount)}` : `- DEBIT ${formatCurrency(adjAmount)}`;
                    } else {
                      finalNewBalance = directBalanceType === 'credit' ? targetAcc.balance + num : targetAcc.balance - num;
                      actionText = directBalanceType === 'credit' ? `+ CREDIT ${formatCurrency(num)}` : `- DEBIT ${formatCurrency(num)}`;
                    }

                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-sans">Account:</span>
                          <span className="text-slate-200">{targetAcc.name} ({targetAcc.accountNumber})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-sans">Current Verified Balance:</span>
                          <span className="text-slate-300">{formatCurrency(targetAcc.balance)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400 font-sans">Adjustment Action:</span>
                          <span className={actionText.includes('+') ? 'text-emerald-400' : 'text-rose-400'}>
                            {actionText}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                          <span className="text-slate-400 font-sans">New Authoritative Balance:</span>
                          <span className="text-white text-sm">{formatCurrency(finalNewBalance)}</span>
                        </div>
                        <div className="pt-1 text-[11px] text-slate-400 font-sans">
                          <span className="font-bold text-slate-300">Audit Justification:</span> "{directBalanceReason}"
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDirectBalanceStep('input')}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    disabled={directBalanceLoading}
                    onClick={handleExecuteDirectBalanceAdjustment}
                    className="flex-1 py-2.5 bg-[#C8102E] hover:bg-[#A00B22] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    {directBalanceLoading ? 'Executing...' : 'Confirm & Apply Adjustment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: TRANSACTION CORRECTION MODAL (SECTION 4) */}
      {isTxCorrectionModalOpen && correctingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#10192A] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-950 border border-blue-600/40 flex items-center justify-center text-blue-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Authorized Transaction Correction</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Reference: {correctingTx.reference || correctingTx.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTxCorrectionModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {txCorrectionSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{txCorrectionSuccess}</span>
              </div>
            )}

            {txCorrectionError && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{txCorrectionError}</span>
              </div>
            )}

            {txCorrectionStep === 'edit' ? (
              <div className="space-y-3.5 text-xs">
                {/* Description / Memo */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                    Description / Memo
                  </label>
                  <input
                    type="text"
                    value={txCorrectionForm.description}
                    onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                      Transaction Amount ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={txCorrectionForm.amount}
                      onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, amount: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                      Classification / Category
                    </label>
                    <input
                      type="text"
                      value={txCorrectionForm.category}
                      onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, category: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Counterparty: Recipient Details */}
                <div className="p-3.5 rounded-xl bg-[#0B1325] border border-slate-800 space-y-2.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Counterparty / Recipient Information</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Recipient Name:</span>
                      <input
                        type="text"
                        value={txCorrectionForm.recipientName}
                        onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, recipientName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#10192A] border border-slate-700 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Recipient Account:</span>
                      <input
                        type="text"
                        value={txCorrectionForm.recipientAccount}
                        onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, recipientAccount: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#10192A] border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Recipient Bank:</span>
                      <input
                        type="text"
                        value={txCorrectionForm.recipientBank}
                        onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, recipientBank: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#10192A] border border-slate-700 rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Counterparty: Sender Details */}
                <div className="p-3.5 rounded-xl bg-[#0B1325] border border-slate-800 space-y-2.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Originator / Sender Information</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sender Name:</span>
                      <input
                        type="text"
                        value={txCorrectionForm.senderName}
                        onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, senderName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#10192A] border border-slate-700 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sender Account:</span>
                      <input
                        type="text"
                        value={txCorrectionForm.senderAccount}
                        onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, senderAccount: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#10192A] border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sender Bank:</span>
                      <input
                        type="text"
                        value={txCorrectionForm.senderBank}
                        onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, senderBank: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#10192A] border border-slate-700 rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Date & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                      Date &amp; Time (ISO String)
                    </label>
                    <input
                      type="text"
                      value={txCorrectionForm.timestamp}
                      onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, timestamp: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                      Transaction Status
                    </label>
                    <select
                      value={txCorrectionForm.status}
                      onChange={(e) => setTxCorrectionForm({ ...txCorrectionForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white text-xs"
                    >
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                {/* Reason for Correction */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1 text-[11px]">
                    Mandatory Correction Justification Reason
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Document audit reason for correcting this transaction record..."
                    value={txCorrectionReason}
                    onChange={(e) => setTxCorrectionReason(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#0B1325] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTxCorrectionModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!txCorrectionReason.trim()}
                    onClick={() => {
                      if (!txCorrectionReason || txCorrectionReason.trim().length < 5) {
                        setTxCorrectionError('Reason must be at least 5 characters documenting audit reason.');
                        return;
                      }
                      setTxCorrectionError('');
                      setTxCorrectionStep('review');
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <span>Review Changes</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Review Changes Step */
              <div className="space-y-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-[#0B1325] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
                    <span className="font-bold text-white">Audit Comparison: Original vs. Corrected</span>
                    <span className="text-[11px] text-slate-400">Reference: {correctingTx.reference}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/60 font-sans">
                      <span className="text-slate-400 font-bold">Field</span>
                      <span className="text-slate-400 font-bold">Original Value</span>
                      <span className="text-blue-400 font-bold">Amended Value</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                      <span className="text-slate-400 font-sans">Description</span>
                      <span className="text-slate-300 truncate">{correctingTx.description}</span>
                      <span className="text-white font-bold truncate">{txCorrectionForm.description}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                      <span className="text-slate-400 font-sans">Amount</span>
                      <span className="text-slate-300">{formatCurrency(correctingTx.amount)}</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(parseFloat(txCorrectionForm.amount) || 0)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                      <span className="text-slate-400 font-sans">Recipient</span>
                      <span className="text-slate-300 truncate">{(correctingTx as any).recipientName || 'N/A'}</span>
                      <span className="text-white font-bold truncate">{txCorrectionForm.recipientName || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                      <span className="text-slate-400 font-sans">Bank</span>
                      <span className="text-slate-300 truncate">{(correctingTx as any).recipientBank || 'Aurelith Reserve'}</span>
                      <span className="text-white font-bold truncate">{txCorrectionForm.recipientBank || 'Aurelith Reserve'}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                      <span className="text-slate-400 font-sans">Status</span>
                      <span className="text-slate-300">{correctingTx.status}</span>
                      <span className="text-white font-bold">{txCorrectionForm.status}</span>
                    </div>
                  </div>

                  {/* Ledger reconciliation notice if amount changed */}
                  {parseFloat(txCorrectionForm.amount) !== correctingTx.amount && (
                    <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-sans space-y-1">
                      <span className="font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Automatic Ledger Balance Reconciliation</span>
                      </span>
                      <p className="text-[11px] text-amber-300/90">
                        Amount modified from {formatCurrency(correctingTx.amount)} to {formatCurrency(parseFloat(txCorrectionForm.amount) || 0)} (delta of {formatCurrency(Math.abs((parseFloat(txCorrectionForm.amount) || 0) - correctingTx.amount))}). The account ledger balance will be automatically adjusted to preserve financial integrity.
                      </p>
                    </div>
                  )}

                  <div className="pt-1 text-[11px] text-slate-400 font-sans">
                    <span className="font-bold text-slate-300">Justification:</span> "{txCorrectionReason}"
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTxCorrectionStep('edit')}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    disabled={txCorrectionLoading}
                    onClick={handleExecuteTxCorrection}
                    className="flex-1 py-2.5 bg-[#C8102E] hover:bg-[#A00B22] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    {txCorrectionLoading ? 'Executing...' : 'Confirm Correction'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
