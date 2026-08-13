import { AttachmentsService } from './attachments.service';

describe('AttachmentsService media validation', () => {
  const service = new AttachmentsService({} as never);
  const matches = (
    bytes: Buffer,
    type: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf',
  ) =>
    (
      service as unknown as {
        matchesContentType: (value: Buffer, kind: string) => boolean;
      }
    ).matchesContentType(bytes, type);

  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'],
    [
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
    ],
    [Buffer.from('RIFF0000WEBP', 'ascii'), 'image/webp'],
    [Buffer.from('%PDF-1.4', 'ascii'), 'application/pdf'],
  ] as const)('accepts bytes matching %s', (bytes, type) => {
    expect(matches(bytes, type)).toBe(true);
  });

  it('rejects a script renamed and labelled as a PDF', () => {
    expect(
      matches(Buffer.from('<script>alert(1)</script>'), 'application/pdf'),
    ).toBe(false);
  });
});
