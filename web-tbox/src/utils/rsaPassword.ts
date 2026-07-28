/**
 * Password transport: RSA + Base64, same public key as `web/src/utils/index.ts` (rsaPsw).
 * Server decrypts via `api.utils.crypt.decrypt`.
 */
import { Base64 } from "js-base64";
import JSEncrypt from "jsencrypt";

const PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArq9XTUSeYr2+N1h3Afl/z8Dse/2yD0ZGrKwx+EEEcdsBLca9Ynmx3nIB5obmLlSfmskLpBo0UACBmB5rEjBp2Q2f3AG3Hjd4B+gNCG6BDaawuDlgANIhGnaTLrIqWrrcm4EMzJOnAOI1fgzJRsOOUEfaS318Eq9OVO3apEyCCt0lOQK6PuksduOjVxtltDav+guVAA068NrPYmRNabVKRNLJpL8w4D44sfth5RvZ3q9t+6RTArpEtc5sh5ChzvqPOzKGMXW83C95TxmXqpbK6olN4RevSfVjEAgCydH6HN6OhtOQEcnrU97r9H0iZOWwbw3pVrZiUkuRD1R56Wzs2wIDAQAB-----END PUBLIC KEY-----";

export function rsaEncryptPassword(plainPassword: string): string {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(PUBLIC_KEY_PEM);
  const encrypted = encryptor.encrypt(Base64.encode(plainPassword));
  if (!encrypted) {
    throw new Error("RSA encrypt failed");
  }
  return encrypted;
}
