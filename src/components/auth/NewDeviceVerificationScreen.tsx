import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Lock, AlertCircle, Loader2, ArrowRight, Mail, KeyRound, LogOut, Check } from 'lucide-react';
import { DeviceVerificationChallenge } from '../../types/banking';
import { bankingApi } from '../../services/bankingApi';

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
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpDispatched, setOtpDispatched] = useState<boolean>(false);
  const [otpMessage, setOtpMessage] = useState<string>('');
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null);

  const inputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  // Auto-focus first PIN input box on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    if (lockoutMinutes !== null) return;
    setErrorMessage('');

    // Only allow single numeric digit
    const cleaned = value.replace(/[^0-9]/g, '');
    const char = cleaned.slice(-1);

    const newDigits = [...pinDigits];
    newDigits[index] = char;
    setPinDigits(newDigits);

    // Auto-advance to next input
    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
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
    inputRefs[nextIndex].current?.focus();
  };

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setErrorMessage('');
    try {
      const res = await bankingApi.sendDeviceOtp(challenge.verificationToken);
      setOtpDispatched(true);
      setOtpMessage(res.message);
      if (res.demoCode) {
        // For testing convenience
        setOtpMessage(`${res.message} (Authorization code: ${res.demoCode})`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code. Please enter your 4-digit PIN.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pin = pinDigits.join('');
    if (pin.length !== 4) {
      setErrorMessage('Please enter your 4-digit transfer security PIN.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await bankingApi.verifyNewDevice(
        challenge.verificationToken,
        pin,
        otpDispatched ? otpCode : undefined
      );
      onVerified();
    } catch (err: any) {
      if (err.isLocked || err.status === 429) {
        setLockoutMinutes(5);
        setErrorMessage('Too many incorrect attempts. For security, please wait 5 minutes before trying again.');
      } else {
        setErrorMessage(err.message || 'Incorrect payment PIN. Please try again.');
        // Clear digits for retry and refocus first box
        setPinDigits(['', '', '', '']);
        inputRefs[0].current?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const isPinComplete = pinDigits.every((d) => d.length === 1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-red-100 selection:text-red-900 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8 animate-fadeIn">
        {/* Brand Emblem */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1C2B4C] dark:bg-slate-800 text-amber-400 border border-amber-500/30 flex items-center justify-center font-serif font-bold text-xl shadow-lg mb-3">
            AR
          </div>
          <h1 className="text-xs font-extrabold text-[#1C2B4C] dark:text-white uppercase tracking-widest">
            Aurelith Reserve
          </h1>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold tracking-tight">
            Private Banking &amp; Digital Treasury
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto shadow-xs">
              <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-[#1C2B4C] dark:text-white tracking-tight">
              Verify This Device
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
              For your account security, verify this device before accessing your banking account.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300 text-xs flex items-start space-x-2.5 animate-shake"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleVerify} className="space-y-6">
            {/* 4-Digit PIN Input Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#1C2B4C] dark:text-slate-200 uppercase tracking-wider">
                  Transfer Security PIN
                </label>
                <span className="text-[10px] text-slate-400 font-medium">4 digits</span>
              </div>

              <div className="flex justify-center gap-3">
                {pinDigits.map((digit, idx) => (
                  <div key={idx} className="relative w-14 h-14 sm:w-16 sm:h-16">
                    <input
                      ref={inputRefs[idx]}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      disabled={loading || lockoutMinutes !== null}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className="w-full h-full text-center text-2xl font-bold font-mono bg-slate-50 dark:bg-[#10192A] border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-[#1C2B4C] dark:text-white focus:bg-white dark:focus:bg-[#152033] focus:border-[#1C2B4C] dark:focus:border-slate-400 focus:outline-none transition-all disabled:opacity-40"
                    />
                    {digit && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#1C2B4C] dark:bg-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
                Digits are masked for your privacy and security.
              </p>
            </div>

            {/* Optional Additional One-Time Passcode */}
            {challenge.maskedEmail && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                {!otpDispatched ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="w-full text-center text-xs text-[#1C2B4C] dark:text-slate-300 hover:text-[#C8102E] dark:hover:text-red-400 font-semibold cursor-pointer py-1.5 transition-colors flex items-center justify-center space-x-1.5"
                  >
                    {isSendingOtp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    <span>Send one-time code to {challenge.maskedEmail}</span>
                  </button>
                ) : (
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-[#10192A] rounded-xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      {otpMessage || `Enter the 6-digit code sent to ${challenge.maskedEmail}:`}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit verification code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-3 py-2 bg-white dark:bg-[#152033] border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-center tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#1C2B4C]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={loading || !isPinComplete || lockoutMinutes !== null}
                className="w-full py-3.5 px-6 bg-[#1C2B4C] hover:bg-[#152033] dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-full shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Verifying Security Credentials...</span>
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

        {/* Security Assurance */}
        <div className="text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Aurelith Reserve Private Banking • Member FDIC • Zero-Trust Device Architecture
          </p>
        </div>
      </div>
    </div>
  );
};
