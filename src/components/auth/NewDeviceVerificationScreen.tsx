import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  AlertCircle,
  Loader2,
  ArrowRight,
  Mail,
  KeyRound,
  LogOut,
  Check,
  Smartphone,
  Globe,
  Clock,
  RotateCw,
} from 'lucide-react';
import { DeviceVerificationChallenge } from '../../types/banking';
import { bankingApi } from '../../services/bankingApi';
import { useBankingAuth } from '../../context/BankingAuthContext';
import { BrandLogo } from '../common/BrandLogo';

interface NewDeviceVerificationScreenProps {
  challenge: DeviceVerificationChallenge;
  onVerified: () => void;
  onCancel: () => void;
}

export const NewDeviceVerificationScreen: React.FC<NewDeviceVerificationScreenProps> = ({
  challenge,
  onVerified,
  onCancel,
}) => {
  const { completeDeviceVerification, logout } = useBankingAuth();

  const [clientId, setClientId] = useState<string>('');
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpDispatched, setOtpDispatched] = useState<boolean>(false);
  const [otpMessage, setOtpMessage] = useState<string>('');
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null);
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const pinRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  // Auto-send OTP when challenge first mounts if contact is available
  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Lockout countdown timer
  useEffect(() => {
    let timer: any = null;
    if (lockoutRemainingSeconds > 0) {
      timer = setInterval(() => {
        setLockoutRemainingSeconds((prev) => {
          if (prev <= 1) {
            setLockoutMinutes(null);
            setErrorMessage('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutRemainingSeconds]);

  const handleDigitChange = (index: number, value: string) => {
    if (lockoutMinutes !== null) return;
    setErrorMessage('');

    const cleaned = value.replace(/[^0-9]/g, '');
    const char = cleaned.slice(-1);

    const newDigits = [...pinDigits];
    newDigits[index] = char;
    setPinDigits(newDigits);

    if (char && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
    if (!pasteData) return;

    const newDigits = ['', '', '', ''];
    for (let i = 0; i < pasteData.length; i++) {
      newDigits[i] = pasteData[i];
    }
    setPinDigits(newDigits);

    const nextIndex = Math.min(pasteData.length, 3);
    pinRefs[nextIndex].current?.focus();
  };

  const handleSendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    setIsSendingOtp(true);
    setErrorMessage('');
    try {
      const res = await bankingApi.sendDeviceOtp(challenge.verificationToken);
      setOtpDispatched(true);
      setResendCooldown(60);
      setOtpMessage(res.message);
      if (res.demoCode) {
        setOtpMessage(`${res.message} (Security Authorization Code: ${res.demoCode})`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutMinutes !== null) return;

    const pin = pinDigits.join('');
    if (pin.length !== 4) {
      setErrorMessage('Please enter your 4-digit transaction security PIN.');
      return;
    }

    if (otpDispatched && (!otpCode || otpCode.trim().length < 6)) {
      setErrorMessage('Please enter the 6-digit one-time authorization code sent to your registered contact.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await completeDeviceVerification({
        paymentPin: pin,
        otpCode: otpCode.trim() || undefined,
        clientId: clientId.trim() || undefined,
      });
      onVerified();
    } catch (err: any) {
      if (err.isLocked || err.status === 429) {
        setLockoutMinutes(5);
        setLockoutRemainingSeconds(300);
        setErrorMessage('Too many incorrect attempts. For security, please wait 5 minutes before trying again.');
      } else {
        if (typeof err.attemptsRemaining === 'number') {
          setAttemptsRemaining(err.attemptsRemaining);
        }
        setErrorMessage(
          err.message || 'Verification failed. Please review your credentials and try again.'
        );
        // Clear PIN digits for secure retry
        setPinDigits(['', '', '', '']);
        pinRefs[0].current?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const isPinComplete = pinDigits.every((d) => d.length === 1);
  const isFormValid = isPinComplete && (!otpDispatched || otpCode.trim().length === 6);

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0B111E] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-amber-100 selection:text-amber-900 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8 animate-fadeIn">
        {/* Brand Emblem */}
        <div className="flex flex-col items-center text-center">
          <BrandLogo
            showText={true}
            imgClassName="h-12 w-auto object-contain mb-2"
            textClassName="text-lg font-extrabold tracking-widest text-[#1C2B4C] dark:text-white"
            subtext="Private Banking & Digital Treasury"
            subtextClassName="text-[10px] text-amber-600 dark:text-amber-400 font-bold tracking-widest uppercase"
          />
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/90 dark:border-slate-800 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-700/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto shadow-xs">
              <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#1C2B4C] dark:text-white tracking-tight">
              Verify Your Account
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
              For your protection, sign-in from an unrecognized device requires multi-factor authentication before granting access to your banking dashboard.
            </p>
          </div>

          {/* Unrecognized Device Context Badge */}
          <div className="bg-slate-50 dark:bg-[#10192A] rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5">
            <div className="flex items-center justify-between font-semibold text-[#1C2B4C] dark:text-white">
              <span className="flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                <span>{challenge.deviceInfo?.deviceName || 'New Web Browser'}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold bg-amber-100/60 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300/40 dark:border-amber-700/40">
                Unrecognized Device
              </span>
            </div>
            {challenge.deviceInfo?.ipAddress && (
              <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[10px]">
                <Globe className="w-3 h-3" />
                <span>Client IP: {challenge.deviceInfo.ipAddress}</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300 text-xs flex items-start space-x-2.5 animate-shake"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium space-y-0.5">
                <div>{errorMessage}</div>
                {lockoutRemainingSeconds > 0 && (
                  <div className="text-[11px] text-red-700 dark:text-red-400 font-mono">
                    Time remaining: {Math.floor(lockoutRemainingSeconds / 60)}:
                    {(lockoutRemainingSeconds % 60).toString().padStart(2, '0')}
                  </div>
                )}
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <div className="text-[10px] text-red-600 dark:text-red-400">
                    {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before account lockout.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3-Factor Verification Form */}
          <form onSubmit={handleVerify} className="space-y-5">
            {/* Factor 1: Client ID Verification */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#1C2B4C] dark:text-slate-200 uppercase tracking-wider">
                  1. Client ID
                </label>
                <span className="text-[10px] text-slate-400 font-medium">e.g. AR-882190</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="AR-XXXXXX"
                  disabled={loading || lockoutMinutes !== null}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono tracking-wider text-[#1C2B4C] dark:text-white uppercase focus:bg-white dark:focus:bg-[#152033] focus:border-[#1C2B4C] dark:focus:border-slate-400 focus:outline-none transition-all disabled:opacity-50"
                />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Your unique client identifier assigned at onboarding.
              </p>
            </div>

            {/* Factor 2: 4-Digit Transaction Security PIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#1C2B4C] dark:text-slate-200 uppercase tracking-wider">
                  2. 4-Digit Security PIN
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Payment PIN</span>
              </div>

              <div className="flex justify-center gap-3">
                {pinDigits.map((digit, idx) => (
                  <div key={idx} className="relative w-12 h-12 sm:w-14 sm:h-14">
                    <input
                      ref={pinRefs[idx]}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      disabled={loading || lockoutMinutes !== null}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className="w-full h-full text-center text-xl sm:text-2xl font-bold font-mono bg-slate-50 dark:bg-[#10192A] border-2 border-slate-200 dark:border-slate-700 rounded-xl text-[#1C2B4C] dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:border-[#1C2B4C] dark:focus:border-slate-400 focus:outline-none transition-all disabled:opacity-40"
                    />
                    {digit && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="w-3 h-3 rounded-full bg-[#1C2B4C] dark:bg-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-1.5">
                Digits are masked for your privacy and security.
              </p>
            </div>

            {/* Factor 3: 6-Digit One-Time Passcode (OTP) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#1C2B4C] dark:text-slate-200 uppercase tracking-wider">
                  3. One-Time Passcode (OTP)
                </label>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp || resendCooldown > 0 || lockoutMinutes !== null}
                  className="text-[11px] text-[#1C2B4C] dark:text-amber-400 hover:text-[#C8102E] font-semibold cursor-pointer transition-colors flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingOtp ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : resendCooldown > 0 ? (
                    <span className="text-slate-400">Resend in {resendCooldown}s</span>
                  ) : (
                    <>
                      <RotateCw className="w-3 h-3 mr-1" />
                      <span>{otpDispatched ? 'Resend Code' : 'Send Code'}</span>
                    </>
                  )}
                </button>
              </div>

              {challenge.maskedEmail && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dispatched to registered contact: <strong className="text-slate-800 dark:text-slate-200 font-mono">{challenge.maskedEmail}</strong>
                </p>
              )}

              {otpMessage && (
                <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-300 font-medium animate-fadeIn">
                  {otpMessage}
                </div>
              )}

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit authorization code"
                disabled={loading || lockoutMinutes !== null}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-center tracking-widest text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:border-[#1C2B4C] dark:focus:border-slate-400 focus:outline-none transition-all disabled:opacity-50"
              />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={loading || !isFormValid || lockoutMinutes !== null}
                className="w-full py-3.5 px-6 bg-[#1C2B4C] hover:bg-[#152033] dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-full shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Verify and Access Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-40"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cancel and Sign Out</span>
              </button>
            </div>
          </form>
        </div>

        {/* Security Assurance Footer */}
        <div className="text-center space-y-1">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Aurelith Reserve Private Banking • Member FDIC • Institutional Security
          </p>
          <p className="text-[10px] text-slate-400/80 dark:text-slate-500/80">
            Sessions are preserved securely. Verification cannot be bypassed.
          </p>
        </div>
      </div>
    </div>
  );
};
