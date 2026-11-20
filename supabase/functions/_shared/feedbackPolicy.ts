export const FEEDBACK_MAX_LENGTH = 2000;
export const feedbackKinds = ['bug', 'question', 'feedback'] as const;
export type FeedbackKind = typeof feedbackKinds[number];
export interface FeedbackInput { kind: FeedbackKind; message: string; reply: boolean; consent: true; requestId: string }
export function parseFeedback(value: unknown): FeedbackInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['kind','message','reply','consent','requestId'].includes(k))
    || !feedbackKinds.includes(v.kind as FeedbackKind) || typeof v.message !== 'string'
    || !v.message.trim() || v.message.length > FEEDBACK_MAX_LENGTH || typeof v.reply !== 'boolean'
    || v.kind === 'feedback' && v.reply || v.consent !== true || typeof v.requestId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.requestId)) return null;
  return { kind: v.kind as FeedbackKind, message: v.message.trim(), reply: v.reply, consent: true, requestId: v.requestId };
}
