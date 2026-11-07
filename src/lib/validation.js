// Strict allow-list validation for everything the public can submit.
// Unknown fields are rejected, every string has a length cap, and control
// characters are refused so data stays safe to display and export (CSV/HTML).
import { z } from 'zod';

const NO_CONTROL = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]*$/;
const SINGLE_LINE = /^[^\r\n]*$/;
// Leading = + - @ can trigger formula injection when a lead list is opened in a spreadsheet.
const NO_FORMULA = /^(?![=+\-@\t])/;

const text = (min, max) =>
  z.string().trim().min(min).max(max).regex(NO_CONTROL).regex(SINGLE_LINE).regex(NO_FORMULA);

export const SERVICES = ['free-check', 'bath-tidy', 'full-groom', 'spa-day', 'cat-calm', 'care-club'];
export const DISTRICTS = ['dajia', 'qingshui', 'shalu', 'wuqi', 'waipu', 'dajia-other', 'other'];
export const CONCERNS = ['matting', 'shedding', 'itchy-skin', 'nails', 'anxiety', 'senior', 'odor', 'puppy-first'];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => {
    const t = Date.parse(d + 'T00:00:00Z');
    const today = Date.now() - 86400000;
    return Number.isFinite(t) && t >= today && t <= today + 120 * 86400000;
  }, 'Date must be within the next 120 days');

export const leadSchema = z
  .object({
    ownerName: text(2, 80),
    phone: z.string().trim().max(20).regex(/^\+?[0-9\s()-]{8,20}$/).or(z.literal('')).default(''),
    email: z.string().trim().max(254).email().or(z.literal('')).default(''),
    lineId: z.string().trim().max(40).regex(/^[A-Za-z0-9._@-]*$/).default(''),
    petName: text(1, 40),
    species: z.enum(['dog', 'cat', 'rabbit', 'other']),
    breed: text(0, 60).default(''),
    size: z.enum(['toy', 'small', 'medium', 'large', 'giant']),
    service: z.enum(SERVICES),
    concerns: z.array(z.enum(CONCERNS)).max(CONCERNS.length).default([]),
    preferredDate: isoDate.or(z.literal('')).default(''),
    district: z.enum(DISTRICTS),
    notes: z.string().trim().max(500).regex(NO_CONTROL).regex(NO_FORMULA).default(''),
    language: z.enum(['en', 'zh']).default('en'),
    consentPrivacy: z.literal(true, { message: 'Privacy consent is required' }),
    consentMarketing: z.boolean().default(false),
    // Honeypot: real visitors never see or fill this field.
    website: z.string().max(200).default(''),
  })
  .strict()
  .refine((d) => d.phone || d.email || d.lineId, {
    message: 'Give at least one way to reach you',
    path: ['phone'],
  });

export const optOutSchema = z
  .object({
    contact: z.string().trim().min(5).max(254).regex(NO_CONTROL).regex(SINGLE_LINE),
    website: z.string().max(200).default(''),
  })
  .strict();

/** Flattens zod issues into { field: message } without echoing the submitted values. */
export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ?? 'form';
    if (!out[key]) out[key] = issue.code === 'unrecognized_keys' ? 'Unexpected field' : 'Invalid value';
  }
  return out;
}
