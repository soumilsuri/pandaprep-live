import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../src/config/logger.js';
import { escapeHtml, maskEmail, notifyNotesReady } from '../../src/tools/notify.js';

describe('notifyNotesReady tool', () => {
  it('escapes HTML-sensitive characters in user-controlled values', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`a & b "quoted" 'apos'`)).toBe('a &amp; b &quot;quoted&quot; &#39;apos&#39;');
  });

  it('masks recipient emails', () => {
    expect(maskEmail('student@example.com')).toBe('s***@example.com');
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
    expect(maskEmail('not-an-email')).toBe('***@***');
  });

  it('returns true without sending when SMTP is not configured', async () => {
    const result = await notifyNotesReady({
      recipientEmail: 'student@example.com',
      subjectName: 'Data Structures',
      requestId: 'req-123',
    });
    expect(result).toBe(true);
  });

  it('logs only the masked recipient email, never the full address', async () => {
    const infoSpy = vi.spyOn(logger, 'info');
    try {
      await notifyNotesReady({
        recipientEmail: 'student@example.com',
        subjectName: 'Data Structures',
        requestId: 'req-123',
      });

      const loggedObjects = infoSpy.mock.calls
        .map((args) => args[0])
        .filter((arg): arg is Record<string, unknown> => typeof arg === 'object' && arg !== null);

      expect(loggedObjects.some((obj) => obj.recipientEmail === 's***@example.com')).toBe(true);
      expect(loggedObjects.some((obj) => obj.recipientEmail === 'student@example.com')).toBe(false);
    } finally {
      infoSpy.mockRestore();
    }
  });
});