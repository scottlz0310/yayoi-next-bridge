/**
 * エンコーディング処理のユニットテスト
 */
import { describe, expect, it } from 'vitest';
import { decodeShiftJIS, encodeShiftJIS } from '../src/lib/encoding.ts';

describe('Encoding Utilities', () => {
  describe('encodeShiftJIS', () => {
    it('ASCII文字をエンコードできる', () => {
      const text = 'Hello, World!';
      const buffer = encodeShiftJIS(text);
      const bytes = new Uint8Array(buffer);

      // ASCIIはそのまま
      expect(bytes[0]).toBe(0x48); // 'H'
      expect(bytes[1]).toBe(0x65); // 'e'
    });

    it('日本語をShift-JISにエンコードできる', () => {
      const text = '給料手当';
      const buffer = encodeShiftJIS(text);
      const bytes = new Uint8Array(buffer);

      // 「給」のShift-JISコード: 8B8B
      expect(bytes[0]).toBe(0x8b);
      expect(bytes[1]).toBe(0x8b);
    });

    it('空文字列を処理できる', () => {
      const buffer = encodeShiftJIS('');
      expect(buffer.byteLength).toBe(0);
    });
  });

  describe('decodeShiftJIS', () => {
    it('ASCII文字をデコードできる', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      const text = decodeShiftJIS(bytes.buffer);
      expect(text).toBe('Hello');
    });

    it('Shift-JISの日本語をデコードできる', () => {
      // 「給料」のShift-JISバイト列
      const bytes = new Uint8Array([0x8b, 0x8b, 0x97, 0xbf]);
      const text = decodeShiftJIS(bytes.buffer);
      expect(text).toBe('給料');
    });

    it('空のバッファを処理できる', () => {
      const buffer = new ArrayBuffer(0);
      const text = decodeShiftJIS(buffer);
      expect(text).toBe('');
    });
  });

  describe('ラウンドトリップ', () => {
    it('エンコード→デコードで元の文字列に戻る', () => {
      const original = '令和7年5月分給与';
      const encoded = encodeShiftJIS(original);
      const decoded = decodeShiftJIS(encoded);
      expect(decoded).toBe(original);
    });

    it('CSVデータをラウンドトリップできる', () => {
      const original =
        '2110,,,2025/06/05,役員報酬,,,対象外,470000,,現金,,,対象外,470225,,令和7年5月分給与,,,0,,,,,\r\n';
      const encoded = encodeShiftJIS(original);
      const decoded = decodeShiftJIS(encoded);
      expect(decoded).toBe(original);
    });

    it('特殊文字を含むデータをラウンドトリップできる', () => {
      const original = '預り金（健）,預り金（厚）,預り金（税）';
      const encoded = encodeShiftJIS(original);
      const decoded = decodeShiftJIS(encoded);
      expect(decoded).toBe(original);
    });
  });
});
