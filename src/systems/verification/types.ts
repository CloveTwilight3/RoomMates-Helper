/**
 * Verification System Types
 * ------------------------
 * Type definitions for the verification system
 */

//=============================================================================
// VERIFICATION TYPES
//=============================================================================

/**
 * Pending verification entry for tracking user verification progress
 */
export interface PendingVerification {
  /** User ID being verified */
  userId: string;
  /** Guild ID where verification is taking place */
  guildId: string;
  /** Timestamp when verification was initiated */
  timestamp: number;
  /** Current step in the verification process */
  step: VerificationStep;
  /** DM channel ID for this verification */
  dmChannelId?: string;
  /** Message ID in the mod channel */
  messageId?: string;
  /** URL of the uploaded ID attachment */
  attachmentUrl?: string;
}

/**
 * Steps in the verification process
 */
export type VerificationStep = 
  | 'initiated'       // User clicked the verification button
  | 'awaiting_upload' // Waiting for user to upload ID
  | 'reviewing'       // Moderators are reviewing the submission
  | 'completed';      // Verification process completed

/**
 * Verification configuration for a guild
 */
export interface VerificationConfig {
  /** Guild ID */
  guild_id: string;
  /** Channel ID where verification requests are sent for mod review */
  mod_channel_id?: string;
  /** Role ID for users who haven't completed age verification */
  age_unverified_role_id?: string;
  /** Role ID for users with NSFW access */
  nsfw_access_role_id?: string;
  /** Role ID for users without NSFW access */
  nsfw_no_access_role_id?: string;
  /** Whether the verification system is enabled */
  enabled: boolean;
  /** When config was created */
  created_at: string;
  /** When config was last updated */
  updated_at: string;
}

/**
 * Verification status for a user
 */
export interface VerificationStatus {
  /** Whether the user is verified */
  isVerified: boolean;
  /** Whether the user has NSFW access */
  hasNsfwAccess: boolean;
  /** Whether the user has the unverified role */
  hasUnverifiedRole: boolean;
  /** When verification was completed (if applicable) */
  verifiedAt?: Date;
}

/**
 * Verification statistics for a guild
 */
export interface VerificationStats {
  /** Total verification requests */
  totalRequests: number;
  /** Number of approved verifications */
  approved: number;
  /** Number of denied verifications */
  denied: number;
  /** Number of pending verifications */
  pending: number;
  /** Success rate (approved / total completed) */
  successRate: number;
  /** Average processing time in milliseconds */
  averageProcessingTime: number;
}

//=============================================================================
// DATABASE TYPES
//=============================================================================

/**
 * Database model for verification logs
 */
export interface VerificationLog {
  /** Unique log ID */
  id: string;
  /** User ID who was verified */
  user_id: string;
  /** Guild ID where verification took place */
  guild_id: string;
  /** Moderator ID who made the decision */
  moderator_id?: string;
  /** Verification action taken */
  action: VerificationAction;
  /** Reason for the action */
  reason?: string;
  /** When the action was taken */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Verification actions that can be logged
 */
export type VerificationAction = 
  | 'started'           // User started verification process
  | 'submitted'         // User submitted ID for review
  | 'approved'          // Moderator approved verification
  | 'denied'            // Moderator denied verification
  | 'expired'           // Verification request expired
  | 'cancelled'         // User cancelled verification
  | 'failed'            // System error during verification
  | 'role_granted'      // Verification roles were granted
  | 'role_removed';     // Verification roles were removed

//=============================================================================
// COMPONENT TYPES
//=============================================================================

/**
 * Custom IDs for verification components
 */
export const VerificationCustomIds = {
  /** Main verification start button */
  START_VERIFICATION: 'start_verification',
  /** Continue verification in DM */
  CONTINUE: (userId: string) => `verification_continue_${userId}`,
  /** Cancel verification in DM */
  CANCEL: (userId: string) => `verification_cancel_${userId}`,
  /** Upload ID button */
  UPLOAD: (userId: string) => `verification_upload_${userId}`,
  /** Approve verification (mod) */
  APPROVE: (userId: string) => `approve_verification_${userId}`,
  /** Deny verification (mod) */
  DENY: (userId: string) => `deny_verification_${userId}`,
  /** Verification modal */
  MODAL: (userId: string) => `verification_modal_${userId}`
} as const;

/**
 * Verification embed colors
 */
export const VerificationColors = {
  /** Default verification color */
  DEFAULT: 0x0099FF,
  /** Pending verification color */
  PENDING: 0xFFA500,
  /** Approved verification color */
  APPROVED: 0x00FF00,
  /** Denied verification color */
  DENIED: 0xFF0000,
  /** Error color */
  ERROR: 0xFF0000,
  /** Warning color */
  WARNING: 0xFFCC00
} as const;

//=============================================================================
// EVENT TYPES
//=============================================================================

/**
 * Verification system events
 */
export interface VerificationEvents {
  /** Emitted when a user starts verification */
  verificationStarted: (userId: string, guildId: string) => void;
  /** Emitted when verification is submitted for review */
  verificationSubmitted: (userId: string, guildId: string, attachmentUrl: string) => void;
  /** Emitted when verification is approved */
  verificationApproved: (userId: string, guildId: string, moderatorId: string) => void;
  /** Emitted when verification is denied */
  verificationDenied: (userId: string, guildId: string, moderatorId: string) => void;
  /** Emitted when verification expires */
  verificationExpired: (userId: string, guildId: string) => void;
}

//=============================================================================
// ERROR TYPES
//=============================================================================

/**
 * Verification-specific errors
 */
export class VerificationError extends Error {
  public readonly code: string;
  public readonly userId?: string;
  public readonly guildId?: string;

  constructor(
    message: string, 
    code: string, 
    userId?: string, 
    guildId?: string
  ) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
    this.userId = userId;
    this.guildId = guildId;
  }
}

/**
 * Verification error codes
 */
export const VerificationErrorCodes = {
  /** Configuration not found or invalid */
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  /** Mod channel not configured */
  MOD_CHANNEL_NOT_CONFIGURED: 'MOD_CHANNEL_NOT_CONFIGURED',
  /** User already has pending verification */
  ALREADY_PENDING: 'ALREADY_PENDING',
  /** Verification has expired */
  EXPIRED: 'EXPIRED',
  /** Invalid attachment (not an image) */
  INVALID_ATTACHMENT: 'INVALID_ATTACHMENT',
  /** DMs disabled or blocked */
  DM_BLOCKED: 'DM_BLOCKED',
  /** Missing permissions */
  MISSING_PERMISSIONS: 'MISSING_PERMISSIONS',
  /** User not found in guild */
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  /** Role assignment failed */
  ROLE_ASSIGNMENT_FAILED: 'ROLE_ASSIGNMENT_FAILED'
} as const;
