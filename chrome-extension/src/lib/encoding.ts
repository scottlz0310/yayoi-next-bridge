/**
 * Shift-JISエンコーディング処理
 *
 * encoding-japanese ライブラリを使用して、Shift-JISとUnicodeの相互変換を行う。
 */
import Encoding from 'encoding-japanese';

/**
 * ArrayBufferをShift-JISとしてデコードして文字列に変換
 *
 * @param buffer - デコードするArrayBuffer
 * @returns デコードされた文字列
 */
export function decodeShiftJIS(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  const unicodeArray = Encoding.convert(uint8Array, {
    to: 'UNICODE',
    from: 'SJIS',
  });
  return Encoding.codeToString(unicodeArray);
}

/**
 * 文字列をShift-JISにエンコードしてArrayBufferに変換
 *
 * @param text - エンコードする文字列
 * @returns エンコードされたArrayBuffer
 */
export function encodeShiftJIS(text: string): ArrayBuffer {
  const unicodeArray = Encoding.stringToCode(text);
  const sjisArray = Encoding.convert(unicodeArray, {
    to: 'SJIS',
    from: 'UNICODE',
  });
  return new Uint8Array(sjisArray).buffer;
}
