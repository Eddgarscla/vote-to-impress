/** The only account that may hold the Founder role. Checked on the server against the auth user email. */
export const FOUNDER_EMAIL = "eddysanchezlabrador@gmail.com";

export function isFounderEmail(email: string | null | undefined): boolean {
  return String(email ?? "").trim().toLowerCase() === FOUNDER_EMAIL;
}
