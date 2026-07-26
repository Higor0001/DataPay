/**
 * WebAuthn & Biometric Security Helper for DataPay
 * Handles Fingerprint, Face ID, Passkeys and PIN fallback.
 */

const STORAGE_KEYS = {
  ENABLED: 'datapay_biometrics_enabled',
  BACKUP_PIN: 'datapay_backup_pin',
  CREDENTIAL_ID: 'datapay_biometrics_cred_id'
};

/**
 * Check if WebAuthn / Biometric hardware authentication is supported on this browser
 */
export function isBiometricsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Check if biometrics lock is enabled in settings
 */
export function isBiometricsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.ENABLED) === 'true';
}

/**
 * Enable or disable biometrics lock
 */
export function setBiometricsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ENABLED, enabled ? 'true' : 'false');
}

/**
 * Retrieve saved backup PIN
 */
export function getBackupPin(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.BACKUP_PIN) || '';
}

/**
 * Save new backup PIN
 */
export function setBackupPin(pin: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.BACKUP_PIN, pin.trim());
}

/**
 * Verify given PIN against saved backup PIN
 */
export function verifyBackupPin(pin: string): boolean {
  const savedPin = getBackupPin();
  if (!savedPin) return false;
  return savedPin === pin.trim();
}

/**
 * Register biometric credential using WebAuthn API (Face ID / Fingerprint)
 */
export async function registerBiometrics(userName: string = 'DataPay User'): Promise<{ success: boolean; message: string }> {
  if (!isBiometricsSupported()) {
    return {
      success: false,
      message: 'Segurança biométrica não é suportada por este dispositivo/navegador.'
    };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'DataPay Financial App',
        id: typeof window !== 'undefined' ? window.location.hostname : 'localhost'
      },
      user: {
        id: userId,
        name: userName,
        displayName: userName
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Fingerprint/Face ID built into device
        userVerification: 'required',
        requireResidentKey: false
      },
      timeout: 60000,
      attestation: 'none'
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    })) as PublicKeyCredential;

    if (credential && credential.id) {
      localStorage.setItem(STORAGE_KEYS.CREDENTIAL_ID, credential.id);
      setBiometricsEnabled(true);
      return {
        success: true,
        message: 'Biometria registrada com sucesso!'
      };
    }

    return {
      success: false,
      message: 'Não foi possível registrar a biometria.'
    };
  } catch (err: any) {
    console.warn('[WebAuthn Registration Warning]:', err);
    // If WebAuthn fails (e.g. user cancelled or domain not HTTPS), fallback to PIN enablement
    if (err.name === 'NotAllowedError') {
      return { success: false, message: 'Operação cancelada pelo usuário.' };
    }
    return {
      success: false,
      message: err.message || 'Falha ao acessar o leitor biométrico do dispositivo.'
    };
  }
}

/**
 * Authenticate user with Biometrics (Face ID / Fingerprint)
 */
export async function authenticateBiometrics(): Promise<{ success: boolean; message: string }> {
  if (!isBiometricsSupported()) {
    return {
      success: false,
      message: 'Biometria não suportada neste dispositivo.'
    };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credentialId = localStorage.getItem(STORAGE_KEYS.CREDENTIAL_ID);

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: credentialId
        ? [
            {
              id: Uint8Array.from(atob(credentialId.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
              type: 'public-key'
            }
          ]
        : undefined
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });

    if (assertion) {
      return {
        success: true,
        message: 'Autenticação biométrica confirmada!'
      };
    }

    return {
      success: false,
      message: 'Falha na verificação biométrica.'
    };
  } catch (err: any) {
    console.warn('[WebAuthn Authentication Error]:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, message: 'Autenticação biométrica cancelada.' };
    }
    return {
      success: false,
      message: err.message || 'Erro ao validar biometria.'
    };
  }
}
