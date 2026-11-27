"use client";

import { useRef, useState, useTransition } from "react";
import { submitLead } from "@/lib/actions";
import { smsConsentText } from "@/lib/consent";

/**
 * The real contact-form submission -- rendered by BlockRenderer's
 * ContactInfo when a contact_info block has form_enabled turned on (see
 * BlockRenderer.tsx). Everything here is a client component because it
 * needs local state for the pending/success/error UI; the actual write
 * happens in the submitLead server action.
 */
export function ContactForm({
  siteId,
  pageId,
  source = "contact_page",
  redirectTo,
  businessName,
  privacyHref,
  termsHref,
}: {
  siteId: string;
  pageId: string | null;
  source?: string;
  /** Send the visitor to this page (e.g. /thank-you) after a successful submit. */
  redirectTo?: string;
  /** Shown in the text-message consent wording. */
  businessName: string;
  privacyHref?: string;
  termsHref?: string;
}) {
  const consentText = smsConsentText(businessName);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitLead(siteId, pageId, source, formData);
      setResult(res);
      if (res.ok) {
        formRef.current?.reset();
        if (redirectTo) window.location.assign(redirectTo);
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-700">
        Thanks — we got your message and will be in touch shortly. If it&apos;s urgent, give us a
        call instead.
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="field">
          <label>Name</label>
          <input
            name="name"
            required
          />
        </div>
        <div className="field">
          <label>Phone</label>
          <input
            name="phone"
            type="tel"
          />
        </div>
      </div>
      <div className="field">
        <label>Email</label>
        <input
          name="email"
          type="email"
        />
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Enter at least a phone number or an email.</p>
      <div className="field">
        <label>
          What do you need help with?
        </label>
        <textarea
          name="message"
          rows={4}
        />
      </div>
      <label className="sms-consent" style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, color: "var(--muted)", cursor: "pointer" }}>
        <input type="checkbox" name="sms_consent" value="yes" style={{ marginTop: 3, width: 18, height: 18, flex: "0 0 auto" }} />
        <span>
          <strong style={{ color: "var(--ink)" }}>Text me about my request (optional).</strong> {consentText}
          {(privacyHref || termsHref) && " See our "}
          {privacyHref && <a href={privacyHref}>Privacy Policy</a>}
          {privacyHref && termsHref && " and "}
          {termsHref && <a href={termsHref}>Terms</a>}
          {(privacyHref || termsHref) && "."}
        </span>
      </label>
      <input type="hidden" name="sms_consent_text" value={consentText} />
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="btn btn--accent btn--lg" style={{ justifySelf: "start" }}
      >
        {isPending ? "Sending..." : "Request My Free Estimate →"}
      </button>
    </form>
  );
}
