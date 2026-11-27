/**
 * Text-message consent wording for lead forms. Shared by the form (what the
 * visitor sees) and saved with the lead, so there's a record of exactly what
 * they agreed to. Consent is optional and never required to submit.
 */
export function smsConsentText(businessName: string): string {
  return (
    `I agree to receive text messages from ${businessName} at the phone number above about my request, ` +
    `estimate, scheduling and service. Message frequency varies. Message and data rates may apply. ` +
    `Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.`
  );
}
