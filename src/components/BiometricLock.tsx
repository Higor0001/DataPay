'use client';

import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  Lock,
  ShieldCheck,
  KeyRound,
  Delete,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import {
  isBiometricsEnabled,
  isBiometricsSupported,
  authenticateBiometrics,
  getBackupPin,
  verifyBackupPin,
  setBackupPin,
  setBiometricsEnabled
} from '../utils/webauthn';

interface BiometricLockProps {
  children: React.ReactNode;
}

export const BiometricLock: React.FC<BiometricLockProps> = ({ children }) => {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [usePinMode, setUsePinMode] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  useEffect(() => {
    const enabled = isBiometricsEnabled();
    if (enabled) {
      setIsLocked(true);
      // Auto-trigger biometric prompt on app load
      triggerBiometricAuth();
    } else {
      setIsLocked(false);
    }
    setIsChecking(false);
  }, []);

  const triggerBiometricAuth = async () => {
    setIsAuthenticating(true);
    setErrorMessage('');
    try {
      const res = await authenticateBiometrics();
      if (res.success) {
        setIsLocked(false);
      } else {
        setErrorMessage(res.message);
        // If biometrics fail or are cancelled, automatically offer PIN mode if backup PIN is set
        if (getBackupPin()) {
          setUsePinMode(true);
        }
      }
    } catch (err: any) {
      setErrorMessage('Erro ao ler biometria.');
      if (getBackupPin()) setUsePinMode(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePinKeyPress = (digit: string) => {
    if (pinInput.length >= 6) return;
    const newPin = pinInput + digit;
    setPinInput(newPin);
    setErrorMessage('');

    // Check if entered PIN matches
    const savedPin = getBackupPin();
    if (savedPin && newPin.length === savedPin.length) {
      if (verifyBackupPin(newPin)) {
        setIsLocked(false);
        setPinInput('');
      } else {
        setErrorMessage('PIN incorreto. Tente novamente.');
        setPinInput('');
      }
    }
  };

  const handlePinDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 font-sans text-slate-100">
      
      {/* Decorative Blur Background Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-sm w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        
        {/* Header App Identity */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative">
            <div className="bg-indigo-600/20 p-4 rounded-3xl text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Lock className="h-8 w-8 text-indigo-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">DataPay Protegido</h2>
          <p className="text-xs text-slate-400">
            {usePinMode
              ? 'Digite o seu PIN de 4 a 6 dígitos para desbloquear'
              : 'Autentique com sua Digital ou Face ID para acessar suas finanças'}
          </p>
        </div>

        {/* Error Alert Message */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Mode Selector / Display */}
        {!usePinMode ? (
          /* Biometric Unlock Trigger */
          <div className="py-6 flex flex-col items-center space-y-6">
            <button
              onClick={triggerBiometricAuth}
              disabled={isAuthenticating}
              className="group relative p-6 rounded-full bg-indigo-950/40 border border-indigo-500/40 hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-600/20 cursor-pointer"
            >
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping opacity-25 group-hover:opacity-40" />
              <Fingerprint className={`h-16 w-16 text-indigo-400 ${isAuthenticating ? 'animate-pulse' : ''}`} />
            </button>

            <button
              onClick={triggerBiometricAuth}
              disabled={isAuthenticating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Fingerprint className="h-4 w-4" />
              <span>{isAuthenticating ? 'Validando Biometria...' : 'Usar Impressão Digital / Face ID'}</span>
            </button>

            {getBackupPin() && (
              <button
                onClick={() => {
                  setUsePinMode(true);
                  setErrorMessage('');
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold transition-colors cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
                <span>Usar PIN de Segurança</span>
              </button>
            )}
          </div>
        ) : (
          /* Numeric PIN Keypad Unlock Mode */
          <div className="space-y-6 py-2">
            
            {/* PIN Display Dots */}
            <div className="flex justify-center items-center gap-3 py-2">
              {[0, 1, 2, 3, 4, 5].slice(0, getBackupPin()?.length || 4).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-4 w-4 rounded-full border transition-all ${
                    idx < pinInput.length
                      ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-lg shadow-indigo-500/50'
                      : 'border-slate-700 bg-slate-950'
                  }`}
                />
              ))}
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePinKeyPress(digit)}
                  className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-white font-bold text-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer mx-auto"
                >
                  {digit}
                </button>
              ))}

              {isBiometricsSupported() ? (
                <button
                  onClick={() => {
                    setUsePinMode(false);
                    triggerBiometricAuth();
                  }}
                  className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 text-indigo-400 flex items-center justify-center transition-all cursor-pointer mx-auto"
                >
                  <Fingerprint className="h-5 w-5" />
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={() => handlePinKeyPress('0')}
                className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-white font-bold text-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer mx-auto"
              >
                0
              </button>

              <button
                onClick={handlePinDelete}
                className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer mx-auto"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            {isBiometricsSupported() && (
              <button
                onClick={() => {
                  setUsePinMode(false);
                  triggerBiometricAuth();
                }}
                className="text-xs text-indigo-400 hover:underline font-medium block mx-auto"
              >
                Voltar para Biometria
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
