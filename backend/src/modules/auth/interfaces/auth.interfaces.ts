// ── JWT Payload ──────────────────────────────────────────────
export interface JwtPayload {
  sub:          string;   // user id
  email:        string;
  role:         string;
  universityId: string | null;
  jti:          string;   // JWT ID — matches Session.token
}

// ── Auth Response ────────────────────────────────────────────
export interface AuthTokens {
  access_token:  string;
  refresh_token: string;
  token_type:    'Bearer';
  expires_in:    number;  // seconds
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface AuthUser {
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  universityId: string | null;
  avatarUrl:    string | null;
}
