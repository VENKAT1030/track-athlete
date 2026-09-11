const crypto = require('crypto');

/**
 * Generate a unique permanent public Athlete ID (e.g. ATH-7K4M92XQ)
 */
function generateAthleteId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars like 0/O, 1/I
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `ATH-${code}`;
}

module.exports = generateAthleteId;
