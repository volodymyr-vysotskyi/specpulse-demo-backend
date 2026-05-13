export interface Membership {
  status: "active" | "expired";
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
}

export function canAccessPaidContent(membership: Membership): AccessDecision {
  if (membership.status === "active") {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Your membership has expired. Renew to access paid content.",
  };
}
