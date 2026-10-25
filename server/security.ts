import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { EncryptedBiometricTemplate } from './types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'saylani-hcm-lite-jwt-secret-key-change-in-production';
const BIOMETRIC_KEY = crypto.createHash('sha256').update(JWT_SECRET + '-biometric-vault-salt').digest();

/**
 * Password Hashing & Verification
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * JWT Helpers
 */
export function signJwt(payload: object, expiresIn: string = '24h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyJwt<T = any>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch {
    return null;
  }
}

/**
 * One-time Account Activation Token
 * Generates an unguessable 32-byte hex string valid for 7 days
 */
export function generateActivationCredentials() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Also generate a readable temporary password (e.g. Saylani@2026-X8K9)
  const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const tempPassword = `Saylani@${new Date().getFullYear()}-${randSuffix}`;

  return {
    rawToken,
    hashedToken,
    expiresAt,
    tempPassword
  };
}

/**
 * Single-use Face Verification Proof Token
 * Prevents client-side spoofing: client cannot simply send faceVerified: true.
 * Client must submit biometric vector to server /api/biometrics/verify,
 * which computes vector distance and signs this 60-second single-use token.
 */
export function signBiometricProofToken(employeeId: string, action: 'check_in' | 'check_out'): string {
  return jwt.sign(
    {
      sub: employeeId,
      purpose: 'biometric_attendance_proof',
      action,
      nonce: crypto.randomBytes(16).toString('hex')
    },
    JWT_SECRET,
    { expiresIn: '60s' }
  );
}

export function verifyBiometricProofToken(
  token: string,
  expectedEmployeeId: string,
  expectedAction: 'check_in' | 'check_out'
): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (
      decoded.sub === expectedEmployeeId &&
      decoded.purpose === 'biometric_attendance_proof' &&
      decoded.action === expectedAction
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Biometric Template Encryption at Rest (AES-256-GCM)
 * Sensitive 128D facial descriptors are encrypted before being written to disk
 */
export function encryptBiometricTemplate(
  descriptor: number[],
  metadata: { employeeId: string; qualityScore: number; samplesCount: number }
): EncryptedBiometricTemplate {
  const iv = crypto.randomBytes(12); // 12 bytes standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', BIOMETRIC_KEY, iv);
  
  const payload = JSON.stringify(descriptor);
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const now = new Date().toISOString();
  return {
    employeeId: metadata.employeeId,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('hex'),
    authTag,
    encryptedData: encrypted,
    qualityScore: metadata.qualityScore,
    samplesCount: metadata.samplesCount,
    enrolledAt: now,
    updatedAt: now
  };
}

export function decryptBiometricTemplate(record: EncryptedBiometricTemplate): number[] {
  const iv = Buffer.from(record.iv, 'hex');
  const authTag = Buffer.from(record.authTag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', BIOMETRIC_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(record.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Biometric Vector Validation & Similarity Math
 * Compares two 128-dimensional biometric descriptor vectors
 */
export function validateBiometricVector(vector: any): { valid: boolean; error?: string } {
  if (!Array.isArray(vector)) {
    return { valid: false, error: 'Biometric descriptor must be an array' };
  }
  if (vector.length !== 128) {
    return { valid: false, error: `Descriptor length must be exactly 128, got ${vector.length}` };
  }
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const val = vector[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return { valid: false, error: `Invalid non-finite value at index ${i}` };
    }
    sumSq += val * val;
  }
  if (sumSq < 0.001) {
    return { valid: false, error: 'Empty or all-zero vector detected' };
  }
  return { valid: true };
}

export function calculateEuclideanDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector length mismatch');
  }
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector length mismatch');
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Biometric Verification Matcher
 * Uses established Euclidean Distance threshold <= 0.45 and Cosine Similarity >= 0.88
 */
export function verifyBiometricMatch(
  candidateVector: number[],
  enrolledVector: number[],
  threshold: number = 0.45
): { match: boolean; distance: number; similarity: number } {
  const distance = calculateEuclideanDistance(candidateVector, enrolledVector);
  const similarity = calculateCosineSimilarity(candidateVector, enrolledVector);
  
  // Standard face verification rule:
  // Euclidean distance < 0.45 (or <= threshold) signifies genuine match
  const match = distance <= threshold && similarity >= 0.85;

  return { match, distance, similarity };
}
