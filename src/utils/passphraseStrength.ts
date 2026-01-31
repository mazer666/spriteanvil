/**
 * src/utils/passphraseStrength.ts
 * -----------------------------------------------------------------------------
 * ## PASSPHRASE STRENGTH VALIDATION (AI Key Security)
 * 
 * This module validates passphrase strength for AI API key encryption to ensure
 * proper cryptographic security. Weak passphrases can be easily brute-forced,
 * compromising encrypted API keys.
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #6: AI API Key Security Enhancements
 * 
 * @module utils/passphraseStrength
 */

/**
 * Passphrase strength levels
 */
export enum StrengthLevel {
  VERY_WEAK = 'very_weak',
  WEAK = 'weak',
  FAIR = 'fair',
  GOOD = 'good',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong',
}

/**
 * Strength score result
 */
export interface StrengthScore {
  score: number;           // 0-100
  level: StrengthLevel;
  feedback: string[];      // User-friendly suggestions
  meetsMinimum: boolean;   // Whether it meets security requirements
  estimatedCrackTime: string;
}

/**
 * Minimum requirements for acceptable passphrase
 */
const MIN_LENGTH = 12;
const RECOMMENDED_LENGTH = 16;

/**
 * Calculate passphrase strength
 * 
 * Based on NIST SP 800-63B and OWASP guidelines.
 * 
 * @param passphrase - Passphrase to evaluate
 * @returns Strength evaluation
 */
export function evaluatePassphraseStrength(passphrase: string): StrengthScore {
  const feedback: string[] = [];
  let score = 0;

  // Length scoring (0-40 points)
  const length = passphrase.length;
  if (length < MIN_LENGTH) {
    feedback.push(`Use at least ${MIN_LENGTH} characters (currently ${length})`);
    score += Math.min(length * 2, 20);
  } else if (length < RECOMMENDED_LENGTH) {
    feedback.push(`Good length, but ${RECOMMENDED_LENGTH}+ characters is recommended`);
    score += 30;
  } else {
    score += 40;
  }

  // Character diversity scoring (0-30 points)
  const hasLowercase = /[a-z]/.test(passphrase);
  const hasUppercase = /[A-Z]/.test(passphrase);
  const hasNumbers = /[0-9]/.test(passphrase);
  const hasSpecial = /[^a-zA-Z0-9]/.test(passphrase);
  
  let diversity = 0;
  if (hasLowercase) diversity++;
  if (hasUppercase) diversity++;
  if (hasNumbers) diversity++;
  if (hasSpecial) diversity++;

  score += diversity * 7.5;

  if (diversity < 3) {
    const missing = [];
    if (!hasUppercase) missing.push('uppercase letters');
    if (!hasNumbers) missing.push('numbers');
    if (!hasSpecial) missing.push('special characters');
    if (missing.length > 0) {
      feedback.push(`Add ${missing.join(', ')} for better security`);
    }
  }

  // Entropy/complexity scoring (0-20 points)
  const uniqueChars = new Set(passphrase).size;
  const entropyScore = Math.min((uniqueChars / length) * 20, 20);
  score += entropyScore;

  // Penalty for common patterns
  if (hasCommonPattern(passphrase)) {
    score -= 15;
    feedback.push('Avoid common patterns like "123", "abc", or repeated characters');
  }

  // Penalty for dictionary words (basic check)
  if (hasSimpleDictionaryWord(passphrase)) {
    score -= 10;
    feedback.push('Avoid simple dictionary words');
  }

  // Bonus for length beyond recommended
  if (length > 20) {
    score += Math.min((length - 20) * 2, 10);
  }

  // Normalize score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine strength level
  let level: StrengthLevel;
  if (score < 20) level = StrengthLevel.VERY_WEAK;
  else if (score < 40) level = StrengthLevel.WEAK;
  else if (score < 60) level = StrengthLevel.FAIR;
  else if (score < 75) level = StrengthLevel.GOOD;
  else if (score < 90) level = StrengthLevel.STRONG;
  else level = StrengthLevel.VERY_STRONG;

  // Check if meets minimum security requirements
  const meetsMinimum = length >= MIN_LENGTH && diversity >= 3 && score >= 50;

  // Estimate crack time
  const estimatedCrackTime = estimateCrackTime(length, diversity);

  // Add positive feedback if strong
  if (meetsMinimum && feedback.length === 0) {
    feedback.push('Great passphrase! Your API keys will be well protected.');
  }

  return {
    score,
    level,
    feedback,
    meetsMinimum,
    estimatedCrackTime,
  };
}

/**
 * Check for common patterns
 */
function hasCommonPattern(passphrase: string): boolean {
  const commonPatterns = [
    /(.)\1{2,}/,           // Repeated characters (aaa, 111)
    /012|123|234|345|456|567|678|789|890/, // Sequential numbers
    /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i, // Sequential letters
    /qwerty|asdfg|zxcvb/i, // Keyboard patterns
    /password|passphrase|admin|letmein|welcome/i, // Common words
  ];

  return commonPatterns.some(pattern => pattern.test(passphrase));
}

/**
 * Simple dictionary word check (basic implementation)
 */
function hasSimpleDictionaryWord(passphrase: string): boolean {
  const commonWords = [
    'password', 'admin', 'user', 'login', 'welcome', 'guest',
    'letmein', 'monkey', 'dragon', 'master', 'sunshine', 'princess',
    'football', 'baseball', 'superman', 'batman', 'trustno1',
  ];

  const lower = passphrase.toLowerCase();
  return commonWords.some(word => lower.includes(word));
}

/**
 * Estimate time to crack passphrase
 */
function estimateCrackTime(length: number, diversity: number): string {
  // Rough estimation based on character set size and length
  // Assumes 10 billion guesses/second (modern GPU)
  
  let charsetSize = 0;
  if (diversity >= 1) charsetSize += 26; // lowercase
  if (diversity >= 2) charsetSize += 26; // uppercase  
  if (diversity >= 3) charsetSize += 10; // numbers
  if (diversity >= 4) charsetSize += 32; // special chars

  const combinations = Math.pow(charsetSize, length);
  const guessesPerSecond = 10_000_000_000; // 10 billion/sec
  const secondsToCrack = combinations / guessesPerSecond;

  if (secondsToCrack < 1) return 'Instantly';
  if (secondsToCrack < 60) return 'Less than a minute';
  if (secondsToCrack < 3600) return `${Math.round(secondsToCrack / 60)} minutes`;
  if (secondsToCrack < 86400) return `${Math.round(secondsToCrack / 3600)} hours`;
  if (secondsToCrack < 2592000) return `${Math.round(secondsToCrack / 86400)} days`;
  if (secondsToCrack < 31536000) return `${Math.round(secondsToCrack / 2592000)} months`;
  if (secondsToCrack < 31536000 * 100) return `${Math.round(secondsToCrack / 31536000)} years`;
  if (secondsToCrack < 31536000 * 1000) return 'Centuries';
  if (secondsToCrack < 31536000 * 1000000) return 'Millennia';
  return 'Billions of years';
}

/**
 * Get color for strength level (for UI)
 */
export function getStrengthColor(level: StrengthLevel): string {
  switch (level) {
    case StrengthLevel.VERY_WEAK: return '#dc2626'; // red-600
    case StrengthLevel.WEAK: return '#ea580c';      // orange-600
    case StrengthLevel.FAIR: return '#f59e0b';       // amber-500
    case StrengthLevel.GOOD: return '#84cc16';       // lime-500
    case StrengthLevel.STRONG: return '#22c55e';     // green-500
    case StrengthLevel.VERY_STRONG: return '#10b981'; // emerald-500
  }
}

/**
 * Get label for strength level
 */
export function getStrengthLabel(level: StrengthLevel): string {
  switch (level) {
    case StrengthLevel.VERY_WEAK: return 'Very Weak';
    case StrengthLevel.WEAK: return 'Weak';
    case StrengthLevel.FAIR: return 'Fair';
    case StrengthLevel.GOOD: return 'Good';
    case StrengthLevel.STRONG: return 'Strong';
    case StrengthLevel.VERY_STRONG: return 'Very Strong';
  }
}

/**
 * Generate a secure random passphrase suggestion
 * 
 * @param wordCount - Number of words (default 4)
 * @returns Suggested passphrase
 */
export function generatePassphraseSuggestion(wordCount: number = 4): string {
  // Diceware-style word list (simplified)
  const words = [
    'alpine', 'anchor', 'autumn', 'beacon', 'bridge', 'canyon', 'castle', 'cloud',
    'crystal', 'dragon', 'eclipse', 'emerald', 'falcon', 'forest', 'glacier', 'harbor',
    'island', 'jasper', 'knight', 'lantern', 'meadow', 'mystic', 'nebula', 'ocean',
    'pearl', 'quantum', 'raven', 'silver', 'thunder', 'unicorn', 'velvet', 'wizard',
  ];

  const selectedWords = [];
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    selectedWords.push(words[randomIndex]);
  }

  // Add a number and special character
  const number = Math.floor(Math.random() * 100);
  const special = ['!', '@', '#', '$', '%', '&', '*'][Math.floor(Math.random() * 7)];

  return selectedWords.join('-') + number + special;
}
