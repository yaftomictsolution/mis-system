export async function computeCredHash(email: string, password: string) {
  const msg = `${email}:${password}`;
  const enc = new TextEncoder().encode(msg);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
