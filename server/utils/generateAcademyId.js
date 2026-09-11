const crypto = require('crypto');

/**
 * Generate a unique permanent public Academy ID (e.g. ACA-7K4M92XQ)
 */
function generateAcademyId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `ACA-${code}`;
}

module.exports = generateAcademyId;
