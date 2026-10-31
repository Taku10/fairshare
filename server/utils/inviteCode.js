const crypto = require('crypto');

// Unambiguous characters (no 0/O/1/I) so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

function newInvite() {
  return { code: generateInviteCode(), codeExpiresAt: new Date(Date.now() + INVITE_TTL_MS) };
}

module.exports = { generateInviteCode, newInvite, CODE_PATTERN, INVITE_TTL_MS };
