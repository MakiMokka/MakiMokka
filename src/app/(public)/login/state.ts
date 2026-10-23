export type LoginMessage =
  'codeSent' | 'invalidEmail' | 'invalidCode' | 'failed' | 'rateLimited' | 'unavailable';

export interface LoginState {
  step: 'email' | 'code';
  email: string;
  message: LoginMessage | null;
}

export const INITIAL_LOGIN_STATE: LoginState = { step: 'email', email: '', message: null };
