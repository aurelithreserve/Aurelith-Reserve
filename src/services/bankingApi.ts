import {
  BankingUser,
  BankTransaction,
  TransferReceipt,
  BankInstitution,
  RecipientVerificationResponse,
  TrustedDeviceInfo,
  DeviceVerificationChallenge,
} from '../types/banking';
import {
  getOrCreateDeviceId,
  getDeviceAuthPayload,
  setDeviceTrustToken,
  clearDeviceTrustToken,
} from '../utils/deviceFingerprint';

const TOKEN_KEY = 'aurelith_banking_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const API_BASE_URL = (
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL)) ||
  ''
).replace(/\/$/, '');

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const deviceId = getOrCreateDeviceId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-device-id': deviceId,
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestUrl =
    endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : API_BASE_URL
        ? `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
        : endpoint;

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (fetchErr: any) {
    const networkMsg = fetchErr?.message || 'Network request failed';
    const error = new Error(
      `Unable to connect to Aurelith Reserve banking services (${networkMsg}). Please verify network connectivity or backend API server configuration.`
    ) as any;
    error.isNetworkError = true;
    throw error;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const error = new Error(
      `Banking API endpoint returned an HTML document (HTTP ${res.status}). If deploying to static hosting like Netlify, configure VITE_API_URL to point to your live backend server.`
    ) as any;
    error.status = res.status;
    throw error;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
    const error = new Error(errorMsg) as any;
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const bankingApi = {
  // Auth
  register: async (payload: any): Promise<{ token: string; user: BankingUser; message: string }> => {
    const devicePayload = getDeviceAuthPayload();
    const res = await request<any>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        ...devicePayload,
      }),
    });
    setAuthToken(res.token);
    if (res.deviceTrustToken) {
      setDeviceTrustToken(res.deviceTrustToken);
    }
    return res;
  },

  login: async (identifier: string, password: string, governmentId?: string): Promise<
    | { requireDeviceVerification: false; token: string; user: BankingUser; message: string }
    | DeviceVerificationChallenge
  > => {
    const devicePayload = getDeviceAuthPayload();
    const res = await request<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        password,
        governmentId,
        ...devicePayload,
      }),
    });

    if (res.requireDeviceVerification) {
      return {
        requireDeviceVerification: true,
        verificationToken: res.verificationToken,
        hasPaymentPin: Boolean(res.hasPaymentPin),
        deviceInfo: res.deviceInfo || { deviceName: 'Unknown Device' },
        message: res.message,
      };
    }

    setAuthToken(res.token);
    if (res.deviceTrustToken) {
      setDeviceTrustToken(res.deviceTrustToken);
    }
    return {
      requireDeviceVerification: false,
      token: res.token,
      user: res.user,
      message: res.message,
    };
  },

  loginWithPhone: async (phoneNumber: string, password: string): Promise<
    | { requireDeviceVerification: false; token: string; user: BankingUser; message: string }
    | DeviceVerificationChallenge
  > => {
    const devicePayload = getDeviceAuthPayload();
    const res = await request<any>('/api/auth/phone-login', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber,
        password,
        ...devicePayload,
      }),
    });

    if (res.requireDeviceVerification) {
      return {
        requireDeviceVerification: true,
        verificationToken: res.verificationToken,
        hasPaymentPin: Boolean(res.hasPaymentPin),
        deviceInfo: res.deviceInfo || { deviceName: 'Unknown Device' },
        message: res.message,
      };
    }

    setAuthToken(res.token);
    if (res.deviceTrustToken) {
      setDeviceTrustToken(res.deviceTrustToken);
    }
    return {
      requireDeviceVerification: false,
      token: res.token,
      user: res.user,
      message: res.message,
    };
  },

  loginWithGoogle: async (payload: {
    uid: string;
    email: string;
    displayName?: string | null;
    photoUrl?: string | null;
  }): Promise<{ token: string; user: BankingUser; message: string }> => {
    const devicePayload = getDeviceAuthPayload();
    const res = await request<any>('/api/auth/google-auth', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        ...devicePayload,
      }),
    });
    setAuthToken(res.token);
    if (res.deviceTrustToken) {
      setDeviceTrustToken(res.deviceTrustToken);
    }
    return res;
  },

  updateProfilePhoto: async (avatarUrl: string | null): Promise<{ user: BankingUser; message: string }> => {
    return request('/api/banking/profile/photo', {
      method: 'POST',
      body: JSON.stringify({ avatarUrl }),
    });
  },

  verifyNewDevice: async (
    verificationToken: string,
    paymentPin: string
  ): Promise<{ token: string; user: BankingUser; message: string }> => {
    const devicePayload = getDeviceAuthPayload();
    const res = await request<any>('/api/auth/verify-new-device', {
      method: 'POST',
      body: JSON.stringify({
        verificationToken,
        paymentPin,
        ...devicePayload,
      }),
    });

    setAuthToken(res.token);
    if (res.deviceTrustToken) {
      setDeviceTrustToken(res.deviceTrustToken);
    }
    return res;
  },

  setupInitialPinForDevice: async (payload: {
    verificationToken: string;
    password: string;
    newPin: string;
    confirmPin: string;
  }): Promise<{ token: string; user: BankingUser; message: string }> => {
    const devicePayload = getDeviceAuthPayload();
    const res = await request<any>('/api/auth/setup-initial-pin-for-device', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        ...devicePayload,
      }),
    });

    setAuthToken(res.token);
    if (res.deviceTrustToken) {
      setDeviceTrustToken(res.deviceTrustToken);
    }
    return res;
  },

  cancelDeviceVerification: async (verificationToken: string): Promise<void> => {
    try {
      await request('/api/auth/cancel-verification', {
        method: 'POST',
        body: JSON.stringify({ verificationToken }),
      });
    } catch {
      // ignore
    }
  },

  getCurrentUser: async (): Promise<{ user: BankingUser }> => {
    return request<{ user: BankingUser }>('/api/auth/me');
  },

  logout: async (): Promise<void> => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },

  forgotPassword: async (identifier: string): Promise<{ message: string; demoResetToken?: string; note?: string }> => {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  },

  resetPassword: async (identifier: string, resetToken: string, newPassword: string): Promise<{ message: string }> => {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, resetToken, newPassword }),
    });
  },

  // Transactions
  getTransactions: async (): Promise<{ transactions: BankTransaction[] }> => {
    return request<{ transactions: BankTransaction[] }>('/api/banking/transactions');
  },

  // Interbank Verification Directory
  getSupportedBanks: async (): Promise<{ banks: BankInstitution[] }> => {
    return request<{ banks: BankInstitution[] }>('/api/banking/supported-banks');
  },

  verifyRecipient: async (payload: {
    bankName?: string;
    accountNumber: string;
  }): Promise<RecipientVerificationResponse> => {
    return request<RecipientVerificationResponse>('/api/banking/verify-recipient', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Transfers
  transferMoney: async (payload: {
    sourceAccountId: string;
    destinationType: 'internal' | 'other_aurelith' | 'external';
    destinationAccountNumber: string;
    destinationRoutingNumber?: string;
    swiftCode?: string;
    recipientName?: string;
    amount: number;
    note?: string;
    paymentReference?: string;
    saveBeneficiary?: boolean;
    nickname?: string;
    bankName?: string;
    paymentPin?: string;
  }): Promise<{ message: string; receipt: TransferReceipt; user: BankingUser }> => {
    return request('/api/banking/transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Bill payments
  payBill: async (payload: {
    sourceAccountId: string;
    btype: string;
    provider: string;
    accountNumber: string;
    amount: number;
  }): Promise<{ message: string; receipt: any; user: BankingUser }> => {
    return request('/api/banking/bills/pay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Airtime / Data
  buyAirtimeData: async (payload: {
    type: 'airtime' | 'data';
    provider: string;
    phoneNumber: string;
    amount: number;
    dataPlan?: string;
  }): Promise<{ message: string; receipt: any; user: BankingUser }> => {
    return request('/api/banking/airtime-data', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Cards
  toggleCardFreeze: async (cardId: string): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/cards/toggle-freeze', {
      method: 'POST',
      body: JSON.stringify({ cardId }),
    });
  },

  updateCardLimits: async (payload: {
    cardId: string;
    dailyLimit?: number;
    monthlyLimit?: number;
    contactlessEnabled?: boolean;
    onlinePurchasesEnabled?: boolean;
  }): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/cards/update-limits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  requestReplacementCard: async (cardType: 'debit_virtual' | 'debit_physical'): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/cards/request-replacement', {
      method: 'POST',
      body: JSON.stringify({ cardType }),
    });
  },

  // Loans
  applyLoan: async (payload: {
    type: string;
    requestedAmount: number;
    termMonths: number;
    purpose: string;
    employmentStatus: string;
    annualIncome: number;
  }): Promise<{ message: string; loan: any; user: BankingUser }> => {
    return request('/api/banking/loans/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Savings
  createSavingsGoal: async (payload: {
    name: string;
    targetAmount: number;
    targetDate: string;
    category: string;
    initialContribution?: number;
  }): Promise<{ message: string; goal: any; user: BankingUser }> => {
    return request('/api/banking/savings/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  contributeToGoal: async (goalId: string, amount: number): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/savings/contribute', {
      method: 'POST',
      body: JSON.stringify({ goalId, amount }),
    });
  },

  // Notifications
  markAllNotificationsRead: async (): Promise<{ user: BankingUser }> => {
    return request('/api/banking/notifications/read-all', { method: 'POST' });
  },

  markNotificationRead: async (notificationId: string): Promise<{ user: BankingUser }> => {
    return request('/api/banking/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notificationId }),
    });
  },

  // Profile & Settings
  customizeAccount: async (
    accountId: string,
    payload: { nickname?: string; institution?: string }
  ): Promise<{ message: string; user: BankingUser; account: any }> => {
    return request(`/api/banking/accounts/${accountId}/customization`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateProfile: async (payload: {
    phoneNumber?: string;
    residentialAddress?: any;
  }): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/profile/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePreferences: async (payload: {
    notificationPreferences?: {
      emailTransactions?: boolean;
      smsSecurity?: boolean;
      monthlyStatements?: boolean;
    };
    securitySettings?: {
      twoFactorEnabled?: boolean;
      biometricsEnabled?: boolean;
    };
  }): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/settings/preferences', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  requestPasswordCode: async (): Promise<{
    message: string;
    verificationCode?: string;
    destinationEmail: string;
    expiresInMinutes: number;
  }> => {
    return request('/api/banking/security/request-password-code', {
      method: 'POST',
    });
  },

  verifyAndChangePassword: async (payload: {
    verificationCode: string;
    newPassword: string;
    confirmPassword?: string;
  }): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/security/verify-and-change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  setupTransactionPin: async (payload: {
    pin: string;
    confirmPin: string;
  }): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/security/setup-pin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  setPaymentPin: async (payload: {
    currentPassword: string;
    newPin: string;
    confirmPin: string;
  }): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/security/set-payment-pin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifyPaymentPin: async (paymentPin: string): Promise<{ valid: boolean; message?: string }> => {
    return request('/api/banking/security/verify-payment-pin', {
      method: 'POST',
      body: JSON.stringify({ paymentPin }),
    });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    return request('/api/banking/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Support
  submitTicket: async (payload: { subject: string; category: string; message: string }): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/support/ticket', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Statements
  prepareStatement: async (payload: {
    accountId: string;
    startDate: string;
    endDate: string;
    category: string;
    deliveryMethod?: string;
  }): Promise<import('../types/banking').StatementPreparationResult> => {
    return request('/api/banking/statements/prepare', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  requestStatementViaEmail: async (payload: {
    accountId: string;
    startDate: string;
    endDate: string;
    category: string;
    pdfDataUri?: string;
  }): Promise<{ success: boolean; message: string; request: import('../types/banking').StatementRequest }> => {
    return request('/api/banking/statements/request-email', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyStatementRequests: async (): Promise<{ requests: import('../types/banking').StatementRequest[] }> => {
    return request('/api/banking/statements/my-requests');
  },

  getAdminStatementRequests: async (): Promise<{ requests: import('../types/banking').StatementRequest[] }> => {
    return request('/api/banking/statements/admin/requests');
  },

  updateStatementRequestStatus: async (
    id: string,
    status: 'Pending' | 'Processing' | 'Completed'
  ): Promise<{ message: string; request: import('../types/banking').StatementRequest }> => {
    return request(`/api/banking/statements/admin/requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getStatementPdf: async (
    id: string
  ): Promise<{ request: import('../types/banking').StatementRequest; pdfDataUri?: string }> => {
    return request(`/api/banking/statements/${id}/pdf`);
  },

  toggleRole: async (): Promise<{ message: string; role: 'customer' | 'admin'; user: BankingUser }> => {
    return request('/api/banking/profile/toggle-role', { method: 'POST' });
  },

  resetDemoBalances: async (): Promise<{ message: string; user: BankingUser }> => {
    return request('/api/banking/demo/reset', { method: 'POST' });
  },

  // Trusted Device Management
  getTrustedDevices: async (): Promise<{ devices: TrustedDeviceInfo[] }> => {
    return request<{ devices: TrustedDeviceInfo[] }>('/api/banking/security/devices');
  },

  revokeTrustedDevice: async (deviceId: string): Promise<{ message: string }> => {
    const res = await request<{ message: string }>('/api/banking/security/revoke-device', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
    // If the revoked device is the current one, clear the local trust token
    if (deviceId === getOrCreateDeviceId()) {
      clearDeviceTrustToken();
    }
    return res;
  },

  revokeAllOtherDevices: async (): Promise<{ message: string; revokedCount: number }> => {
    return request<{ message: string; revokedCount: number }>('/api/banking/security/revoke-all-other-devices', {
      method: 'POST',
      body: JSON.stringify({ currentDeviceId: getOrCreateDeviceId() }),
    });
  },
};
