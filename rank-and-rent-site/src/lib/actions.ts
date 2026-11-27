"use server";

import { createPublicClient } from "@/lib/supabase";

export interface SubmitLeadResult {
  ok: boolean;
  error?: string;
}

/**
 * The public site's one deliberate write. Relies on the `leads` table's
 * anon-INSERT-only RLS policy (see the add_leads_table migration) rather
 * than a service-role key -- a visitor can create a lead, nothing more; no
 * SELECT/UPDATE/DELETE policy exists for anon, so submissions can only be
 * read back through the admin (service_role, bypasses RLS like every other
 * admin write).
 */
export async function submitLead(
  siteId: string,
  pageId: string | null,
  source: string,
  formData: FormData
): Promise<SubmitLeadResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  // Text-message consent only counts if they checked the box and gave a phone number.
  const smsConsent = formData.get("sms_consent") === "yes" && !!phone;
  const smsConsentText = smsConsent ? String(formData.get("sms_consent_text") ?? "").slice(0, 1000) : null;

  if (!name) return { ok: false, error: "Name is required." };
  if (!phone && !email) return { ok: false, error: "A phone number or email is required." };

  const supabase = createPublicClient();
  const { error } = await supabase.from("leads").insert({
    site_id: siteId,
    page_id: pageId,
    name,
    phone: phone || null,
    email: email || null,
    message: message || null,
    source,
    sms_consent: smsConsent,
    sms_consent_text: smsConsentText,
  });

  if (error) {
    // Logged server-side for debugging; the visitor just sees a generic
    // failure message rather than a raw Postgres error.
    console.error("submitLead failed:", error);
    return { ok: false, error: "Something went wrong submitting your request. Please call us instead." };
  }

  return { ok: true };
}
