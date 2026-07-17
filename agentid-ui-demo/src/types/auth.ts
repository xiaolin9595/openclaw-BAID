export interface User {
  id: string;
  userId: string;
  username: string;
  email: string;
  publicKey: string;
  biometricStatus: 'bound' | 'unbound';
  status: 'active' | 'inactive';
  createdAt: string;
  authCount: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  agentId: string;
  biometricVerified: boolean;
  contractVerified: boolean;
  zkProof: string | null;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
}

export interface RegistrationData {
  username: string;
  email: string;
  biometricData: string;
  publicKey: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface BiometricTemplate {
  id: string;
  userId: string;
  template: string;
  hash: string;
  confidence: number;
  createdAt: string;
}