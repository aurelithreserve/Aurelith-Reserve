import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  Search,
  Loader2,
  Users,
  Wallet,
  Share2,
  Download,
  Lock,
  X,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
  MessageCircle,
} from 'lucide-react';
import { useBankingAuth } from '../../context/BankingAuthContext';
import {
  TransferReceipt,
  BankBeneficiary,
  BankInstitution,
  VerifiedRecipientAccount,
} from '../../types/banking';
import { bankingApi } from '../../services/bankingApi';
import { getAccountTier, formatCurrency } from '../../data/accountTiers';
import {
  shareReceipt,
  shareViaWhatsApp,
  saveReceiptPdf,
  saveReceiptImage,
  maskAccountNumber,
} from '../../utils/receiptGenerator';
import { TransactionPinSetupModal } from './TransactionPinSetupModal';
import confetti from 'canvas-confetti';

interface TransfersViewProps {
  onSuccessReturn?: () => void;
}

export const TransfersView: React.FC<TransfersViewProps> = ({ onSuccessReturn }) => {
  const { user, refreshUser, reloadTransactions } = useBankingAuth();

  const [transferType, setTransferType] = useState<'internal' | 'other_aurelith' | 'external'>('external');
  const [sourceAccountId, setSourceAccountId] = useState(user?.accounts[0]?.id || '');

  // Supported Institutions
  const [supportedBanks, setSupportedBanks] = useState<BankInstitution[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);

  // Recipient Account & Automatic Verification State
  const [accountNumber, setAccountNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // Discovered Recipient (found by verification service, awaiting sender confirmation)
  const [discoveredRecipient, setDiscoveredRecipient] = useState<VerifiedRecipientAccount | null>(null);

  // Confirmed Recipient Details (after sender confirms / selects)
  const [verifiedRecipient, setVerifiedRecipient] = useState<VerifiedRecipientAccount | null>(null);
  const [isRecipientConfirmed, setIsRecipientConfirmed] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [wasBankAutoSelected, setWasBankAutoSelected] = useState(false);

  // Field 2: Populated Recipient Bank Name
  const [selectedBank, setSelectedBank] = useState<BankInstitution | null>(null);
  const [verificationSource, setVerificationSource] = useState('');
  const [requiresBankSelection, setRequiresBankSelection] = useState(false);
  const [ambiguousBanks, setAmbiguousBanks] = useState<string[]>([]);

  // Field 3: Populated Routing Number
  const [routingNumber, setRoutingNumber] = useState('');

  // Field 4: Populated SWIFT/BIC Code
  const [swiftCode, setSwiftCode] = useState('');

  // Field 5: Transfer Amount
  const [amount, setAmount] = useState('');

  // Field 6: Payment Reference
  const [paymentReference, setPaymentReference] = useState('');

  // Additional options
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);
  const [beneficiaryNickname, setBeneficiaryNickname] = useState('');

  // Internal & P2P simple transfer state
  const [internalTargetAccount, setInternalTargetAccount] = useState('');
  const [p2pAccountNumber, setP2pAccountNumber] = useState('');
  const [p2pRecipientName, setP2pRecipientName] = useState('');
  const [p2pVerified, setP2pVerified] = useState(false);

  // Flow states
  const [isReviewing, setIsReviewing] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinSetupModalOpen, setIsPinSetupModalOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemainingSecs, setLockoutRemainingSecs] = useState(0);

  // Execution & receipt states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [showRestrictedIpPopup, setShowRestrictedIpPopup] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bankDropdownRef = useRef<HTMLDivElement | null>(null);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);
  const isSubmittingRef = useRef<boolean>(false);
  const verificationSeqRef = useRef<number>(0);

  // Previously Used Recipient vs New Recipient
  const [isPreviouslyUsedRecipient, setIsPreviouslyUsedRecipient] = useState(false);
  const [lastTransferDate, setLastTransferDate] = useState<string | undefined>(undefined);

  // Live validation states for Routing & SWIFT
  const [routingValid, setRoutingValid] = useState(false);
  const [swiftValid, setSwiftValid] = useState(false);
  const [routingError, setRoutingError] = useState('');
  const [swiftError, setSwiftError] = useState('');

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemainingSecs(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setPinAttempts(0);
        setPinError('');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Fetch supported banks on mount
  useEffect(() => {
    let isMounted = true;
    bankingApi
      .getSupportedBanks()
      .then((res) => {
        if (isMounted && res.banks) {
          setSupportedBanks(res.banks);
        }
      })
      .catch((err) => {
        console.error('Failed to load banks directory:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle outside click to close bank dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setIsBankDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const sourceAccount = user.accounts.find((a) => a.id === sourceAccountId) || user.accounts[0];

  // Automatic Recipient Verification with sequence tracking to eliminate race conditions
  const triggerRecipientVerification = async (accToVerify: string, bankNameToVerify?: string) => {
    const cleanAcc = accToVerify.trim().replace(/[\s\r\n\t]+/g, '');
    const digitsOnly = cleanAcc.replace(/\D/g, '');
    if (!cleanAcc || (digitsOnly.length < 6 && cleanAcc.length < 6)) {
      setDiscoveredRecipient(null);
      setVerifiedRecipient(null);
      setIsRecipientConfirmed(false);
      setIsPreviouslyUsedRecipient(false);
      setLastTransferDate(undefined);
      setRecipientName('');
      setRoutingNumber('');
      setSwiftCode('');
      setRoutingValid(false);
      setSwiftValid(false);
      setRoutingError('');
      setSwiftError('');
      if (wasBankAutoSelected) {
        setSelectedBank(null);
        setWasBankAutoSelected(false);
      }
      setRequiresBankSelection(false);
      setAmbiguousBanks([]);
      setVerificationError('');
      return;
    }

    const currentSeq = ++verificationSeqRef.current;
    setIsVerifying(true);
    setVerificationError('');
    setRequiresBankSelection(false);
    setAmbiguousBanks([]);

    try {
      const res = await bankingApi.verifyRecipient({
        bankName: bankNameToVerify, // do not constrain by stale selectedBank
        accountNumber: cleanAcc,
      });

      // Discard stale responses if input changed while async request was in flight
      if (currentSeq !== verificationSeqRef.current) return;

      if (res.verified && res.recipient) {
        setDiscoveredRecipient(res.recipient);
        setVerifiedRecipient(res.recipient);
        setIsRecipientConfirmed(true);
        setRecipientName(res.recipient.recipientName);
        setVerificationSource(res.source || 'Authorized Interbank Clearing Directory (FedACH / Fedwire Verified)');
        setVerificationError('');
        setRequiresBankSelection(false);
        setAmbiguousBanks([]);

        const matched = supportedBanks.find(
          (b) =>
            b.name.toLowerCase() === res.recipient!.bankName.toLowerCase() ||
            b.shortName.toLowerCase() === res.recipient!.bankName.toLowerCase() ||
            res.recipient!.bankName.toLowerCase().includes(b.shortName.toLowerCase()) ||
            b.name.toLowerCase().includes(res.recipient!.bankName.toLowerCase())
        );

        const activeBank = matched || {
          id: 'inst_' + res.recipient.accountNumber,
          name: res.recipient.bankName,
          shortName: res.recipient.bankName,
          routingNumber: res.recipient.routingNumber || '',
          swiftCode: res.recipient.swiftCode || '',
          country: 'United States',
          countryCode: 'US',
          currency: 'USD',
          supportedRails: ['Fedwire', 'FedACH'],
        };
        setSelectedBank(activeBank);
        setWasBankAutoSelected(true);

        // Check if Previously Used Recipient (Section 5 & 6)
        if (res.isPreviouslyUsed) {
          setIsPreviouslyUsedRecipient(true);
          setLastTransferDate(res.lastTransferDate);
          const rNum = res.recipient.routingNumber || activeBank.routingNumber;
          const sCode = res.recipient.swiftCode || activeBank.swiftCode;
          setRoutingNumber(rNum);
          setSwiftCode(sCode);
          setRoutingValid(Boolean(rNum));
          setSwiftValid(Boolean(sCode));
          setRoutingError('');
          setSwiftError('');
        } else {
          // Scenario A: NEW RECIPIENT -> SWIFT & Routing MUST BE BLANK!
          setIsPreviouslyUsedRecipient(false);
          setLastTransferDate(undefined);
          setRoutingNumber('');
          setSwiftCode('');
          setRoutingValid(false);
          setSwiftValid(false);
          setRoutingError('');
          setSwiftError('');
        }
      } else if (res.requiresBankSelection) {
        setDiscoveredRecipient(null);
        setVerifiedRecipient(null);
        setIsRecipientConfirmed(false);
        setIsPreviouslyUsedRecipient(false);
        setLastTransferDate(undefined);
        setRecipientName('');
        setRequiresBankSelection(true);
        setAmbiguousBanks(res.ambiguousBanks || []);
        setVerificationError('');
      } else {
        setDiscoveredRecipient(null);
        setVerifiedRecipient(null);
        setIsRecipientConfirmed(false);
        setIsPreviouslyUsedRecipient(false);
        setLastTransferDate(undefined);
        setRecipientName('');
        setRequiresBankSelection(false);
        setAmbiguousBanks([]);
        setVerificationError(
          res.error ||
            `Account number not found in authorized bank directory. Please check the number with the recipient.`
        );
      }
    } catch (err: any) {
      if (currentSeq !== verificationSeqRef.current) return;
      setDiscoveredRecipient(null);
      setVerifiedRecipient(null);
      setIsRecipientConfirmed(false);
      setIsPreviouslyUsedRecipient(false);
      setLastTransferDate(undefined);
      setRecipientName('');
      setRequiresBankSelection(false);
      setAmbiguousBanks([]);
      setVerificationError(err.message || 'Interbank verification request failed.');
    } finally {
      if (currentSeq === verificationSeqRef.current) {
        setIsVerifying(false);
      }
    }
  };

  // Handle Account Number change with debounce (automatically triggers verification)
  const handleAccountNumberChange = (val: string, immediate = false) => {
    // Normalize harmless formatting differences (spaces, tabs, newlines)
    const clean = val.replace(/[\s\r\n\t]+/g, '');
    setAccountNumber(clean);
    setDiscoveredRecipient(null);
    setVerifiedRecipient(null);
    setIsRecipientConfirmed(false);
    setIsPreviouslyUsedRecipient(false);
    setLastTransferDate(undefined);
    setRecipientName('');
    setRoutingNumber('');
    setSwiftCode('');
    setRoutingValid(false);
    setSwiftValid(false);
    setRoutingError('');
    setSwiftError('');
    if (wasBankAutoSelected) {
      setSelectedBank(null);
      setWasBankAutoSelected(false);
    }
    setRequiresBankSelection(false);
    setAmbiguousBanks([]);
    setVerificationError('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const digits = clean.replace(/\D/g, '');
    if (clean.length >= 6 || digits.length >= 6) {
      if (immediate) {
        triggerRecipientVerification(clean);
      } else {
        debounceTimerRef.current = setTimeout(() => {
          triggerRecipientVerification(clean);
        }, 350);
      }
    }
  };

  // Handle Clipboard Paste for Account Number (Section 1)
  const handlePasteAccountNumber = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const cleaned = pasted.trim().replace(/[\s\r\n\t]+/g, '');
    if (cleaned) {
      handleAccountNumberChange(cleaned, true);
    }
  };

  // Live validation for Routing Number (Section 4)
  const handleRoutingChange = (val: string) => {
    const clean = val.trim();
    setRoutingNumber(clean);
    if (!selectedBank) {
      setRoutingValid(false);
      setRoutingError('');
      return;
    }
    const expected = selectedBank.routingNumber.replace(/\s+/g, '');
    const cleanNoSpaces = clean.replace(/\s+/g, '');
    if (cleanNoSpaces === expected) {
      setRoutingValid(true);
      setRoutingError('');
    } else {
      setRoutingValid(false);
      if (cleanNoSpaces.length >= 9 || cleanNoSpaces.length >= expected.length) {
        setRoutingError(`Routing number does not match ${selectedBank.name} records. Expected 9-digit routing number for this institution.`);
      } else {
        setRoutingError('');
      }
    }
  };

  // Live validation for SWIFT Code (Section 4)
  const handleSwiftChange = (val: string) => {
    const clean = val.trim().toUpperCase();
    setSwiftCode(clean);
    if (!selectedBank) {
      setSwiftValid(false);
      setSwiftError('');
      return;
    }
    const expected = selectedBank.swiftCode.toUpperCase();
    const matches = clean === expected || clean === `${expected}XXX` || (expected.length === 11 && clean === expected.slice(0, 8));
    if (matches) {
      setSwiftValid(true);
      setSwiftError('');
    } else {
      setSwiftValid(false);
      if (clean.length >= 8) {
        setSwiftError(`SWIFT code does not match ${selectedBank.name} records.`);
      } else {
        setSwiftError('');
      }
    }
  };

  // Clear recipient
  const handleClearRecipient = () => {
    setDiscoveredRecipient(null);
    setVerifiedRecipient(null);
    setIsRecipientConfirmed(false);
    setIsPreviouslyUsedRecipient(false);
    setLastTransferDate(undefined);
    setRecipientName('');
    setRoutingNumber('');
    setSwiftCode('');
    setRoutingValid(false);
    setSwiftValid(false);
    setRoutingError('');
    setSwiftError('');
    if (wasBankAutoSelected) {
      setSelectedBank(null);
      setWasBankAutoSelected(false);
    }
    setVerificationError('');
  };

  // Handle Bank Selection
  const handleSelectBank = (bank: BankInstitution) => {
    setSelectedBank(bank);
    setIsBankDropdownOpen(false);
    setBankSearch('');
    setRequiresBankSelection(false);
    setAmbiguousBanks([]);
    setWasBankAutoSelected(false);
    setVerificationError('');

    if (isPreviouslyUsedRecipient) {
      setRoutingNumber(bank.routingNumber);
      setSwiftCode(bank.swiftCode);
      setRoutingValid(true);
      setSwiftValid(true);
    } else {
      if (routingNumber) {
        const expectedRouting = bank.routingNumber.replace(/\s+/g, '');
        const cleanRouting = routingNumber.trim().replace(/\s+/g, '');
        const isValid = cleanRouting === expectedRouting;
        setRoutingValid(isValid);
        setRoutingError(isValid ? '' : (cleanRouting.length >= 9 ? `Routing number does not match ${bank.name} records.` : ''));
      }
      if (swiftCode) {
        const expectedSwift = bank.swiftCode.toUpperCase();
        const cleanSwift = swiftCode.trim().toUpperCase();
        const isValid = cleanSwift === expectedSwift || cleanSwift === `${expectedSwift}XXX`;
        setSwiftValid(isValid);
        setSwiftError(isValid ? '' : (cleanSwift.length >= 8 ? `SWIFT code does not match ${bank.name} records.` : ''));
      }
    }

    if (accountNumber.length >= 6) {
      triggerRecipientVerification(accountNumber, bank.name);
    }
  };

  const handleSelectBeneficiary = (b: BankBeneficiary) => {
    setTransferType('external');
    setAccountNumber(b.accountNumber);
    setRoutingNumber(b.routingNumber || '');
    setVerificationError('');
    setIsVerifying(true);
    setIsPreviouslyUsedRecipient(true);
    triggerRecipientVerification(b.accountNumber, b.bankName);
  };

  // Action: "Review Transfer" (proceeds to Transfer Review Screen, does NOT execute or ask PIN yet)
  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMessage('Please enter a transfer amount greater than $0.00.');
      return;
    }

    const calculatedFee = Number((numAmount * 0.001).toFixed(2));
    const totalRequired = Number((numAmount + calculatedFee).toFixed(2));

    if (totalRequired > sourceAccount.availableBalance) {
      setErrorMessage(
        `Insufficient available funds. Transfer of $${numAmount.toFixed(2)} plus 0.1% fee ($${calculatedFee.toFixed(2)}) requires $${totalRequired.toFixed(2)}. Current available balance is $${sourceAccount.availableBalance.toFixed(2)}.`
      );
      return;
    }

    // Balance Range Constraint Validations
    const sourceTier = getAccountTier(sourceAccount.name);
    if (sourceTier?.minBalance !== undefined && sourceAccount.balance - totalRequired < sourceTier.minBalance) {
      setErrorMessage(
        `Transfer rejected. This transaction would leave ${sourceAccount.name} below its required Minimum balance of ${formatCurrency(sourceTier.minBalance)}.`
      );
      return;
    }

    if (transferType === 'internal') {
      const targetAcc = user.accounts.find((a) => a.accountNumber === internalTargetAccount);
      if (targetAcc) {
        const targetTier = getAccountTier(targetAcc.name);
        if (targetTier?.maxBalance !== undefined && targetAcc.balance + numAmount > targetTier.maxBalance) {
          setErrorMessage(
            `Transfer rejected. This transaction would cause ${targetAcc.name} to exceed its Maximum balance limit of ${formatCurrency(targetTier.maxBalance)}.`
          );
          return;
        }
      }
    }

    if (transferType === 'external') {
      if (!accountNumber || accountNumber.length < 6) {
        setErrorMessage('Please enter a valid recipient account number.');
        return;
      }
      if (!verifiedRecipient) {
        setErrorMessage('Recipient account has not been verified. Please enter a valid account number from the authorized directory.');
        return;
      }
      if (!selectedBank) {
        setErrorMessage('Recipient financial institution could not be determined.');
        return;
      }
      if (!routingNumber.trim()) {
        setErrorMessage('Routing number is required for interbank wire settlement.');
        return;
      }
      if (!routingValid) {
        setErrorMessage(`Routing number does not match authoritative records for ${selectedBank.name}.`);
        return;
      }
      if (!swiftCode.trim()) {
        setErrorMessage('SWIFT/BIC code is required for bank transfer verification.');
        return;
      }
      if (!swiftValid) {
        setErrorMessage(`SWIFT/BIC code does not match authoritative records for ${selectedBank.name}.`);
        return;
      }
    } else if (transferType === 'internal') {
      if (!internalTargetAccount) {
        setErrorMessage('Please select a destination account.');
        return;
      }
    } else if (transferType === 'other_aurelith') {
      if (!p2pAccountNumber.trim()) {
        setErrorMessage('Please provide the recipient Aurelith Reserve account number.');
        return;
      }
    }

    // Validations passed: switch to Review Screen (no execution, no PIN prompt on screen)
    setIsReviewing(true);
  };

  // User clicks "Confirm and Execute Transfer" on review screen -> triggers PIN modal
  const handleProceedToPinAuthorization = () => {
    setPinDigits(['', '', '', '']);
    setPinError('');
    setIsPinModalOpen(true);
    setTimeout(() => {
      pinInputRefs.current[0]?.focus();
    }, 150);
  };

  // Handle PIN digit typing
  const handlePinDigitChange = (index: number, val: string) => {
    if (loading || isSubmittingRef.current || Boolean(lockoutUntil)) return;

    const digit = val.replace(/\D/g, '').slice(-1);
    const updated = [...pinDigits];
    updated[index] = digit;
    setPinDigits(updated);
    setPinError('');

    if (digit && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }

    // When 4th digit entered, auto-trigger execution without duplicate submissions
    if (digit && index === 3 && updated.every((d) => d !== '')) {
      if (!isSubmittingRef.current && !loading) {
        isSubmittingRef.current = true;
        const fullPin = updated.join('');
        executeAuthorizedTransfer(fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  // Submit transfer to authorized processor after PIN verification
  const executeAuthorizedTransfer = async (pinToUse: string) => {
    if (lockoutUntil && lockoutUntil > Date.now()) {
      setPinError(`Account locked. Please wait ${lockoutRemainingSecs} seconds.`);
      isSubmittingRef.current = false;
      return;
    }

    if (pinToUse.length !== 4) {
      setPinError('Transaction PIN must consist of four numeric digits.');
      isSubmittingRef.current = false;
      return;
    }

    if (user?.transferAccess === 'restricted') {
      setIsPinModalOpen(false);
      setIsReviewing(false);
      setPinDigits(['', '', '', '']);
      isSubmittingRef.current = false;
      setShowRestrictedIpPopup(true);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setPinError('');

    try {
      let targetAccountNum = accountNumber;
      let targetRouting = routingNumber;
      let targetSwift = swiftCode;
      let targetRecipientName = verifiedRecipient?.recipientName || '';
      let targetBankName = selectedBank?.name || 'External Bank';

      if (transferType === 'internal') {
        targetAccountNum = internalTargetAccount;
        targetRouting = '111301122';
        targetSwift = 'AURUS33D';
        targetRecipientName = `${user.firstName} ${user.lastName}`;
        targetBankName = 'Aurelith Reserve';
      } else if (transferType === 'other_aurelith') {
        targetAccountNum = p2pAccountNumber;
        targetRouting = '111301122';
        targetSwift = 'AURUS33D';
        targetRecipientName = p2pRecipientName || 'Aurelith Client';
        targetBankName = 'Aurelith Reserve';
      }

      // Submit transfer payload to authorized processor
      const res = await bankingApi.transferMoney({
        sourceAccountId: sourceAccount.id,
        destinationType: transferType,
        destinationAccountNumber: targetAccountNum.trim(),
        destinationRoutingNumber: targetRouting.trim(),
        swiftCode: targetSwift.trim(),
        recipientName: targetRecipientName.trim(),
        bankName: targetBankName,
        amount: parseFloat(amount),
        note: paymentReference.trim(),
        paymentReference: paymentReference.trim(),
        saveBeneficiary: transferType === 'external' ? saveBeneficiary : false,
        nickname: beneficiaryNickname.trim() || undefined,
        paymentPin: pinToUse,
      });

      // Transfer successfully authorized by processor!
      setReceipt(res.receipt);
      setIsPinModalOpen(false);
      setIsReviewing(false);
      setPinDigits(['', '', '', '']);
      setPinAttempts(0);

      await refreshUser();
      await reloadTransactions();

      try {
        confetti({
          particleCount: 120,
          spread: 85,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }
    } catch (err: any) {
      const errMsg: string = err.message || '';

      if (
        (err as any)?.code === 'TRANSFER_ACCESS_RESTRICTED' ||
        errMsg.includes('New IP detected') ||
        errMsg.includes('Unusual activity') ||
        errMsg.includes('RESTRICTED')
      ) {
        setIsPinModalOpen(false);
        setIsReviewing(false);
        setPinDigits(['', '', '', '']);
        setShowRestrictedIpPopup(true);
        return;
      }

      // Check if PIN was incorrect
      if (errMsg.toLowerCase().includes('pin') || errMsg.toLowerCase().includes('authorization pin')) {
        const nextAttempts = pinAttempts + 1;
        setPinAttempts(nextAttempts);
        setPinDigits(['', '', '', '']);

        if (nextAttempts >= 5) {
          const lockoutTime = Date.now() + 5 * 60 * 1000;
          setLockoutUntil(lockoutTime);
          setPinError('Too many incorrect PIN attempts. Security lockout active for 5 minutes.');
        } else {
          setPinError(`Incorrect Transaction PIN. ${5 - nextAttempts} attempt(s) remaining.`);
          setTimeout(() => {
            pinInputRefs.current[0]?.focus();
          }, 50);
        }
      } else {
        // Processor error or server processor missing
        setErrorMessage(errMsg || 'Authorized processor rejected transfer. Please verify account parameters.');
        setIsPinModalOpen(false);
        setPinDigits(['', '', '', '']);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const resetForm = () => {
    setReceipt(null);
    setIsReviewing(false);
    setIsPinModalOpen(false);
    setAmount('');
    setPaymentReference('');
    setAccountNumber('');
    setSelectedBank(null);
    setRoutingNumber('');
    setSwiftCode('');
    setRoutingValid(false);
    setSwiftValid(false);
    setRoutingError('');
    setSwiftError('');
    setVerifiedRecipient(null);
    setIsPreviouslyUsedRecipient(false);
    setLastTransferDate(undefined);
    setRequiresBankSelection(false);
    setAmbiguousBanks([]);
    setVerificationError('');
    setSaveBeneficiary(false);
    setBeneficiaryNickname('');
    setPinDigits(['', '', '', '']);
    setPinError('');
    setErrorMessage('');
    setShareFeedback(null);
  };

  const copyRefToClipboard = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // Handle Share Receipt with Web Share API and fallback
  const handleShareReceipt = async () => {
    if (!receipt) return;
    setIsSharing(true);
    setShareFeedback(null);
    try {
      const result = await shareReceipt(receipt);
      if (result.shared) {
        setShareFeedback('Receipt shared successfully.');
      } else if (result.downloadedFallback) {
        setShareFeedback('Receipt image downloaded to device.');
      }
    } catch {
      setShareFeedback('Unable to complete sharing action.');
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareFeedback(null), 4000);
    }
  };

  // Handle Save PDF
  const handleSavePdf = () => {
    if (!receipt) return;
    saveReceiptPdf(receipt);
  };

  // Handle Save Image
  const handleSaveImage = () => {
    if (!receipt) return;
    saveReceiptImage(receipt);
  };

  // Filter banks for searchable selector
  const filteredBanks = supportedBanks.filter(
    (b) =>
      b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
      b.shortName.toLowerCase().includes(bankSearch.toLowerCase()) ||
      (b.country && b.country.toLowerCase().includes(bankSearch.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C2B4C] dark:text-white">Secure Bank Transfer</h1>
      </div>

      {user?.transferAccess === 'restricted' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-semibold flex items-center space-x-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Unusual activity detected. New device. Please contact your bank.</span>
        </div>
      )}

      {receipt ? (
        /* ==================================================== */
        /* 8. TRANSFER RECEIPT SCREEN (Sent Status Confirmed)   */
        /* Strictly no remaining account balance or PIN shown   */
        /* ==================================================== */
        <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800 shadow-xl max-w-xl mx-auto text-center space-y-6 animate-fadeIn">
          {/* Top Brand Seal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3 text-left">
              <div className="w-10 h-10 rounded-2xl bg-[#1C2B4C] dark:bg-slate-800 text-amber-400 border border-amber-500/40 flex items-center justify-center font-serif font-bold text-base shadow-xs">
                AR
              </div>
              <div>
                <div className="text-xs font-extrabold text-[#1C2B4C] dark:text-white uppercase tracking-wider">
                  Aurelith Reserve
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tracking-tight">
                  Private Banking & Digital Treasury
                </div>
              </div>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold rounded-full border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
              <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" />
              <span>Sent • Completed</span>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#1C2B4C] dark:text-white font-mono my-2.5">
              ${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Electronic wire payment to {receipt.recipientName} successfully authorized and settled via interbank network.
            </p>
          </div>

          {/* Receipt Breakdown Table */}
          <div className="bg-slate-50 dark:bg-[#10192A] rounded-2xl p-4 sm:p-5 text-xs space-y-3 text-left border border-slate-200/70 dark:border-slate-800">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Transaction Reference:</span>
              <div className="flex items-center space-x-1.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                <span>{receipt.reference}</span>
                <button
                  type="button"
                  onClick={() => copyRefToClipboard(receipt.reference)}
                  className="p-1 hover:text-[#C8102E] dark:hover:text-red-400 cursor-pointer transition-colors"
                  title="Copy reference"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Transfer Status:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" />
                <span>Sent • Settled via Interbank Network</span>
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Funding Account:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {receipt.sourceAccountName} ({maskAccountNumber(receipt.sourceAccountNumber)})
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Recipient Bank:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.recipientBank || 'Aurelith Reserve'}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Verified Recipient:</span>
              <span className="font-bold text-[#1C2B4C] dark:text-white">{receipt.recipientName}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Recipient Account:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {maskAccountNumber(receipt.recipientAccountNumber)}
              </span>
            </div>

            {receipt.routingNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Routing Transit (ABA):</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{receipt.routingNumber}</span>
              </div>
            )}

            {receipt.swiftCode && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">SWIFT / BIC Code:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{receipt.swiftCode}</span>
              </div>
            )}

            {receipt.paymentReference && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Payment Reference:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 italic">{receipt.paymentReference}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Transfer Fee (0.1%):</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                ${(receipt.fee ?? Number((receipt.amount * 0.001).toFixed(2))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-sm">
              <span className="font-bold text-[#1C2B4C] dark:text-white">Total Amount Debited:</span>
              <span className="font-extrabold text-[#C8102E] dark:text-red-400 font-mono">
                ${(receipt.amount + (receipt.fee ?? Number((receipt.amount * 0.001).toFixed(2)))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
              <span>Settlement Timestamp:</span>
              <span>{new Date(receipt.timestamp).toLocaleString()}</span>
            </div>

            {/* Official Certification Text (Section 9) */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 text-center space-y-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                This electronic document certifies that the above funds transfer was authorized and debited.
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Aurelith Reserve Private Banking • Member FDIC • Official Wire Settlement Record
              </p>
            </div>
          </div>

          {shareFeedback && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
              {shareFeedback}
            </div>
          )}

          {/* Share & Save Receipt Actions (Section 10) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              type="button"
              onClick={handleShareReceipt}
              disabled={isSharing}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1C2B4C] dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-[#C8102E]" />
              )}
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (receipt) shareViaWhatsApp(receipt);
              }}
              title="Share Receipt via WhatsApp"
              className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5 border border-emerald-200 dark:border-emerald-800"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleSavePdf}
              title="Download PDF Receipt"
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1C2B4C] dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1"
            >
              <FileText className="w-3.5 h-3.5 text-red-500" />
              <span>Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSaveImage}
              title="Download PNG Receipt Image"
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1C2B4C] dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
              <span>Save PNG</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-3 px-5 bg-[#1C2B4C] hover:bg-[#152033] dark:bg-[#C8102E] dark:hover:bg-red-700 text-white font-bold text-xs rounded-full shadow-md transition-colors cursor-pointer"
            >
              Make Another Transfer
            </button>
            {onSuccessReturn && (
              <button
                type="button"
                onClick={onSuccessReturn}
                className="py-3 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-full transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      ) : isReviewing ? (
        /* ==================================================== */
        /* 5. TRANSFER REVIEW SCREEN                            */
        /* Dedicated screen with full summary.                   */
        /* Does NOT ask for PIN here. Does NOT execute on view.  */
        /* Actions: "Edit Transfer" and "Confirm and Execute"    */
        /* ==================================================== */
        <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-md max-w-xl mx-auto space-y-6 animate-fadeIn">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1C2B4C] dark:text-white">Review Transfer</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Please review your recipient banking information and transfer parameters before authorizing.
              </p>
            </div>
          </div>

          {/* Full Summary Required by Section 5 */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#10192A] rounded-2xl space-y-3 text-xs border border-slate-200/60 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Transfer Type:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {transferType === 'internal'
                  ? 'Between My Aurelith Accounts'
                  : transferType === 'other_aurelith'
                  ? 'Aurelith Reserve Client (P2P)'
                  : 'Interbank Other Bank (Wire / FedACH)'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Funding Account:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {sourceAccount.name} ({maskAccountNumber(sourceAccount.accountNumber)})
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Recipient Bank Name:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {transferType === 'external' ? selectedBank?.name : 'Aurelith Reserve'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Recipient Confirmation Info:</span>
              <span className="font-bold text-[#1C2B4C] dark:text-white flex items-center space-x-1">
                <span>
                  {verifiedRecipient?.recipientName ||
                    (transferType === 'internal'
                      ? `${user.firstName} ${user.lastName}`
                      : p2pRecipientName || 'Aurelith Client')}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline" />
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Masked Recipient Account:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {maskAccountNumber(
                  transferType === 'external'
                    ? accountNumber
                    : transferType === 'internal'
                    ? internalTargetAccount
                    : p2pAccountNumber
                )}
              </span>
            </div>

            {transferType === 'external' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Routing Number:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{routingNumber}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">SWIFT Code:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{swiftCode}</span>
                </div>
              </>
            )}

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Transfer Currency:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">USD ($)</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Payment Reference:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 italic">
                {paymentReference ? `"${paymentReference}"` : 'General Wire Transfer'}
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Transfer Amount:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Transfer Fee (0.1%):</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                ${(parseFloat(amount) * 0.001).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-sm">
              <span className="font-bold text-[#1C2B4C] dark:text-white">Total Debit Amount:</span>
              <span className="font-extrabold text-[#C8102E] dark:text-red-400 font-mono">
                ${(parseFloat(amount) + Number((parseFloat(amount) * 0.001).toFixed(2))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Two Clear Actions (Requirement #5) */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              className="flex-1 py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-full transition-colors cursor-pointer"
            >
              Edit Transfer
            </button>
            <button
              type="button"
              onClick={handleProceedToPinAuthorization}
              className="flex-1 py-3.5 px-4 bg-[#C8102E] hover:bg-[#A00B22] text-white font-bold text-xs rounded-full shadow-md transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Confirm and Execute</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* ==================================================== */
        /* 3. MAIN TRANSFER FORM                                */
        /* Exact Sequence:                                      */
        /* 1. Recipient account number                          */
        /* 2. Populated recipient bank name                     */
        /* 3. Populated routing number                          */
        /* 4. Populated SWIFT/BIC code                          */
        /* 5. Transfer amount                                   */
        /* 6. Payment reference                                 */
        /* ==================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form */}
          <div className="lg:col-span-2 bg-white dark:bg-[#152033] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            {errorMessage && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Transfer Type Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-[#10192A] rounded-2xl mb-6 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setTransferType('external');
                  setErrorMessage('');
                }}
                className={`py-2.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center space-x-1.5 ${
                  transferType === 'external'
                    ? 'bg-[#1C2B4C] dark:bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Other Bank</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferType('internal');
                  setErrorMessage('');
                  const target = user.accounts.find((a) => a.id !== sourceAccountId);
                  if (target) {
                    setInternalTargetAccount(target.accountNumber);
                  }
                }}
                className={`py-2.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center space-x-1.5 ${
                  transferType === 'internal'
                    ? 'bg-[#1C2B4C] dark:bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Between Accounts</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferType('other_aurelith');
                  setErrorMessage('');
                }}
                className={`py-2.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center space-x-1.5 ${
                  transferType === 'other_aurelith'
                    ? 'bg-[#1C2B4C] dark:bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Related Client</span>
              </button>
            </div>

            {/* Available Balance Display Only (Funding Account Details & Product Limits Removed) */}
            <div className="mb-6">
              {user.accounts.length > 1 ? (
                <div className="inline-block">
                  <select
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="text-2xl sm:text-3xl font-extrabold font-mono text-[#1C2B4C] dark:text-white bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-0"
                  >
                    {user.accounts.map((acc) => (
                      <option
                        key={acc.id}
                        value={acc.id}
                        className="text-base font-normal font-sans text-slate-900 bg-white dark:bg-slate-800 dark:text-white"
                      >
                        ${acc.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#1C2B4C] dark:text-white">
                  ${sourceAccount.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>

            {/* OTHER BANK / INTERBANK TRANSFER FORM */}
            {transferType === 'external' && (
              <form onSubmit={handleReview} className="space-y-5">
                {/* Account Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Account Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      inputMode="text"
                      placeholder="Enter account number"
                      value={accountNumber}
                      onChange={(e) => handleAccountNumberChange(e.target.value)}
                      onPaste={handlePasteAccountNumber}
                      className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] rounded-xl text-xs sm:text-sm font-mono font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none transition-colors ${
                        verifiedRecipient && isRecipientConfirmed
                          ? 'border-2 border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                          : verificationError
                          ? 'border-2 border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#1C2B4C]'
                      } ${isVerifying ? 'pr-10' : ''}`}
                    />
                    {isVerifying && (
                      <div className="absolute right-3.5 top-3 flex items-center pointer-events-none">
                        <Loader2 className="w-4 h-4 text-[#1C2B4C] dark:text-slate-300 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Verified Recipient Summary (Compact Presentation - Section 2) */}
                {verifiedRecipient && isRecipientConfirmed && (
                  <div className="p-3.5 sm:p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl flex items-start justify-between gap-3 animate-fadeIn">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Verified Account Holder</span>
                        </span>
                        {isPreviouslyUsedRecipient && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                            <Users className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>
                              Previously Used Recipient
                              {lastTransferDate ? ` (${new Date(lastTransferDate).toLocaleDateString()})` : ''}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-extrabold text-[#1C2B4C] dark:text-white truncate">
                        {verifiedRecipient.recipientName}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center space-x-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-medium">{verifiedRecipient.bankName}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearRecipient}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer shrink-0"
                      title="Clear and change recipient"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Error Notice */}
                {verificationError && !verifiedRecipient && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300 text-xs flex items-center space-x-2 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>{verificationError}</span>
                  </div>
                )}

                {/* Ambiguous Bank Selection (Section 2, Req 3) */}
                {requiresBankSelection && ambiguousBanks.length > 0 && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2 animate-fadeIn">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Select Receiving Institution for this Account</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-400">
                      This account number format is recognized across multiple institutions. Choose the intended destination:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ambiguousBanks.map((bName) => (
                        <button
                          key={bName}
                          type="button"
                          onClick={() => {
                            const found = supportedBanks.find((b) => b.name === bName || b.shortName === bName);
                            if (found) {
                              handleSelectBank(found);
                            } else {
                              triggerRecipientVerification(accountNumber, bName);
                            }
                          }}
                          className="px-3 py-1.5 bg-white dark:bg-[#10192A] border border-amber-300 dark:border-amber-700 hover:border-[#1C2B4C] dark:hover:border-slate-400 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                        >
                          {bName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bank Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Bank Name
                  </label>
                  <div className="relative" ref={bankDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                      className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border rounded-xl text-left flex items-center justify-between cursor-pointer transition-colors ${
                        selectedBank
                          ? 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs sm:text-sm truncate">
                          {selectedBank ? selectedBank.name : 'Select Bank'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-semibold ml-2">▾</span>
                    </button>

                    {isBankDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-[#152033] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 max-h-64 overflow-y-auto animate-fadeIn">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search supported bank by name..."
                            value={bankSearch}
                            onChange={(e) => setBankSearch(e.target.value)}
                            className="w-full px-3 py-1.5 pl-8 bg-slate-50 dark:bg-[#10192A] border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1C2B4C] dark:focus:ring-slate-500"
                            autoFocus
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        </div>
                        <div className="space-y-1">
                          {filteredBanks.map((bank) => {
                            const isCurrent = selectedBank?.id === bank.id;
                            return (
                              <div
                                key={bank.id}
                                onClick={() => handleSelectBank(bank)}
                                className={`px-3 py-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                                  isCurrent
                                    ? 'bg-slate-100 dark:bg-slate-800 text-[#1C2B4C] dark:text-white font-bold'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <div>
                                  <div className="font-semibold">{bank.name}</div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {bank.country} • ABA: {bank.routingNumber} • SWIFT: {bank.swiftCode}
                                  </div>
                                </div>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />}
                              </div>
                            );
                          })}
                          {filteredBanks.length === 0 && (
                            <div className="py-3 text-center text-xs text-slate-400">
                              No banks match "{bankSearch}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Routing Number & SWIFT Code (Sections 3, 4, 6) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                        Routing Number (ABA)
                      </label>
                      {routingValid && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isPreviouslyUsedRecipient ? 'Routing number' : 'Enter 9-digit routing number'}
                        value={routingNumber}
                        onChange={(e) => handleRoutingChange(e.target.value)}
                        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] rounded-xl text-xs sm:text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-[#152033] focus:outline-none transition-colors ${
                          routingValid
                            ? 'border-2 border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                            : routingError
                            ? 'border-2 border-red-500 focus:ring-1 focus:ring-red-500'
                            : 'border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#1C2B4C]'
                        }`}
                      />
                      {routingValid && (
                        <div className="absolute right-3.5 top-3 flex items-center pointer-events-none text-emerald-500">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    {routingError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 font-medium">{routingError}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                        SWIFT / BIC Code
                      </label>
                      {swiftValid && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isPreviouslyUsedRecipient ? 'SWIFT code' : 'Enter 8 or 11-char SWIFT code'}
                        value={swiftCode}
                        onChange={(e) => handleSwiftChange(e.target.value)}
                        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] rounded-xl text-xs sm:text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-[#152033] focus:outline-none transition-colors ${
                          swiftValid
                            ? 'border-2 border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                            : swiftError
                            ? 'border-2 border-red-500 focus:ring-1 focus:ring-red-500'
                            : 'border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#1C2B4C]'
                        }`}
                      />
                      {swiftValid && (
                        <div className="absolute right-3.5 top-3 flex items-center pointer-events-none text-emerald-500">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    {swiftError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 font-medium">{swiftError}</p>
                    )}
                  </div>
                </div>

                {/* Transfer Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Transfer Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-lg font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-base font-bold font-mono text-[#1C2B4C] dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                    />
                  </div>
                </div>

                {/* Payment Reference */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Payment Reference <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Real Estate Escrow, Consulting Retainer, Invoice #4081"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                  />
                </div>

                {/* Save Beneficiary Option */}
                <div className="pt-1 bg-slate-50 dark:bg-[#10192A] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <label className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveBeneficiary}
                      onChange={(e) => setSaveBeneficiary(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-[#C8102E] focus:ring-[#C8102E]"
                    />
                    <span>Save verified recipient to my address book for future transfers</span>
                  </label>
                  {saveBeneficiary && (
                    <input
                      type="text"
                      placeholder="Custom Nickname (e.g. Real Estate Escrow, Corporate Supplier)"
                      value={beneficiaryNickname}
                      onChange={(e) => setBeneficiaryNickname(e.target.value)}
                      className="mt-2 w-full px-3 py-1.5 bg-white dark:bg-[#152033] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs"
                    />
                  )}
                </div>

                {/* Primary CTA Button: Review Transfer */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!verifiedRecipient || !isRecipientConfirmed || !selectedBank || !routingValid || !swiftValid}
                    className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A00B22] text-white font-bold text-xs sm:text-sm rounded-full shadow-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <span>Review Transfer</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* INTERNAL TRANSFER BETWEEN ACCOUNTS */}
            {transferType === 'internal' && (
              <form onSubmit={handleReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Destination Account
                  </label>
                  <select
                    value={internalTargetAccount}
                    onChange={(e) => setInternalTargetAccount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                  >
                    <option value="">Select destination account</option>
                    {user.accounts
                      .filter((a) => a.id !== sourceAccountId)
                      .map((acc) => (
                        <option key={acc.id} value={acc.accountNumber}>
                          {acc.nickname ? `${acc.nickname} (${acc.name})` : acc.name} ({acc.accountNumber}) — Current: ${acc.balance.toFixed(2)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Transfer Amount ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-lg font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-base font-bold font-mono text-[#1C2B4C] dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Payment Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rebalance liquid reserves, savings deposit"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A00B22] text-white font-bold text-xs sm:text-sm rounded-full shadow-md transition-colors cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>Review Transfer</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* AURELITH P2P CLIENT TRANSFER */}
            {transferType === 'other_aurelith' && (
              <form onSubmit={handleReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Aurelith Account Number or Client ID (e.g. AR-XXXXXX)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Enter 10-digit account number or Client ID (AR-XXXXXX)"
                      value={p2pAccountNumber}
                      onChange={async (e) => {
                        const val = e.target.value.trim();
                        setP2pAccountNumber(val);
                        const isAccNum = /^\d{10}$/.test(val);
                        const isClientId = /^AR-[A-Za-z0-9]{6}$/i.test(val);
                        if (isAccNum || isClientId) {
                          try {
                            const res = await bankingApi.verifyRecipient({
                              bankName: 'Aurelith Reserve',
                              accountNumber: val,
                            });
                            if (res.verified && res.recipient) {
                              setP2pRecipientName(res.recipient.recipientName);
                              setP2pVerified(true);
                            } else {
                              setP2pVerified(false);
                            }
                          } catch {
                            setP2pVerified(false);
                          }
                        } else {
                          setP2pVerified(false);
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                    />
                  </div>
                  {p2pVerified && p2pRecipientName && (
                    <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified Client: {p2pRecipientName}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Transfer Amount ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-lg font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-base font-bold font-mono text-[#1C2B4C] dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Payment Reference / Narration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dinner split, Consulting fee"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A00B22] text-white font-bold text-xs sm:text-sm rounded-full shadow-md transition-colors cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>Review Transfer</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Col: Saved Beneficiaries */}
          <div className="space-y-6">

            {/* Saved Beneficiaries Card */}
            <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#1C2B4C] dark:text-white" />
                <h3 className="text-sm font-bold text-[#1C2B4C] dark:text-white">Saved Beneficiaries</h3>
              </div>

              {user.beneficiaries.length === 0 ? (
                <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                  No saved recipients yet. When you transfer funds, check "Save verified recipient" to save for future transfers.
                </div>
              ) : (
                <div className="space-y-2">
                  {user.beneficiaries.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBeneficiary(b)}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#10192A] hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 cursor-pointer transition-all hover:border-[#1C2B4C] dark:hover:border-slate-600 flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#C8102E] dark:group-hover:text-red-400">
                          {b.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {b.bankName} • {maskAccountNumber(b.accountNumber)}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. TRANSACTION PIN MODAL                             */}
      {/* Exact Heading: "Input Transaction PIN"               */}
      {/* Triggered only when clicking Confirm and Execute      */}
      {/* ==================================================== */}
      {/* ==================================================== */}
      {/* 6. REDESIGNED COMPACT TRANSACTION PIN POPUP          */}
      {/* Essential info only: Amount, Recipient, PIN inputs   */}
      {/* Discreet top close icon; No bottom action buttons    */}
      {/* Automatic execution upon entering 4th digit          */}
      {/* ==================================================== */}
      {isPinModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white dark:bg-[#152033] rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col p-6 relative animate-scaleUp">
            {/* Discreet top close icon */}
            <button
              type="button"
              onClick={() => {
                if (!loading && !isSubmittingRef.current) {
                  setIsPinModalOpen(false);
                  setPinDigits(['', '', '', '']);
                  setPinError('');
                }
              }}
              disabled={loading}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {!user.hasPaymentPin ? (
              /* User does not have a PIN setup yet */
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-2xl flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1C2B4C] dark:text-white">
                    Transaction PIN Required
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    Please set up your verified 4-digit PIN to authorize transfers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setIsPinSetupModalOpen(true);
                  }}
                  className="w-full py-3 px-5 bg-[#C8102E] hover:bg-[#A00B22] text-white font-bold text-xs rounded-full shadow-md transition-colors cursor-pointer"
                >
                  Set Up Transaction PIN
                </button>
              </div>
            ) : (
              <div className="pt-2 space-y-5">
                {/* 1. Transfer Amount & 2. Recipient Name */}
                <div className="text-center space-y-1">
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#1C2B4C] dark:text-white">
                    ${parseFloat(amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    <span className="text-xs font-sans font-bold text-slate-400">USD</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold truncate max-w-xs mx-auto">
                    {verifiedRecipient?.recipientName === 'Verified Account Holder'
                      ? 'Enter Payment Pin'
                      : (verifiedRecipient?.recipientName ||
                        (transferType === 'internal'
                          ? `${user.firstName} ${user.lastName}`
                          : p2pRecipientName || 'Aurelith Client'))}
                  </div>
                </div>

                {/* 3. PIN Input Field */}
                <div className="space-y-3">
                  <div className="flex justify-center space-x-3">
                    {pinDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          pinInputRefs.current[idx] = el;
                        }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        pattern="[0-9]*"
                        disabled={loading || isSubmittingRef.current || Boolean(lockoutUntil)}
                        value={digit}
                        onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handlePinKeyDown(idx, e)}
                        className="w-12 h-14 bg-slate-50 dark:bg-[#0B111E] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl text-center text-2xl font-mono font-bold focus:bg-white dark:focus:bg-[#10192A] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C] dark:focus:ring-slate-500 transition-all shadow-xs disabled:opacity-50"
                      />
                    ))}
                  </div>

                  {/* Loading spinner while verifying & executing */}
                  {loading && (
                    <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 dark:text-slate-400 animate-fadeIn pt-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1C2B4C] dark:text-slate-300" />
                      <span>Authorizing transfer...</span>
                    </div>
                  )}

                  {/* Subtle error feedback */}
                  {pinError && !loading && (
                    <div className="text-center text-xs text-red-600 dark:text-red-400 font-medium animate-fadeIn">
                      {pinError}
                    </div>
                  )}

                  {lockoutUntil && (
                    <div className="text-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Security lockout active: {lockoutRemainingSecs}s
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Setup PIN Modal if user needs to establish their PIN first */}
      <TransactionPinSetupModal
        isOpen={isPinSetupModalOpen}
        onClose={() => setIsPinSetupModalOpen(false)}
        onSuccess={() => {
          setIsPinSetupModalOpen(false);
          // Return to review state ready for PIN confirmation
          handleProceedToPinAuthorization();
        }}
      />

      {/* Restricted Transfer Warning Popup (PART 7) */}
      {showRestrictedIpPopup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#101726] border border-red-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-scaleUp">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-950/70 border border-red-500/50 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-red-400 leading-relaxed px-2">
              New IP detected. Unusual activity. Wait 24 to 48 hours and try again.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRestrictedIpPopup(false);
                  setIsReviewing(false);
                  setIsPinModalOpen(false);
                  if (onSuccessReturn) {
                    onSuccessReturn();
                  }
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
