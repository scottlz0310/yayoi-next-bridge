/**
 * 変換ロジックのユニットテスト
 */
import { describe, expect, it } from 'vitest';
import { convertCSVText, convertPayrollToAccounting } from '../src/converter/converter.ts';
import { parseCSV, stringifyCSV } from '../src/converter/csv.ts';

describe('CSV Utilities', () => {
  describe('parseCSV', () => {
    it('通常のCSVをパースできる', () => {
      const input = 'a,b,c\r\n1,2,3\r\n4,5,6';
      const result = parseCSV(input);
      expect(result).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ]);
    });

    it('引用符を含むCSVをパースできる', () => {
      const input = '"a,b",c,d\r\n"e""f",g,h';
      const result = parseCSV(input);
      expect(result).toEqual([
        ['a,b', 'c', 'd'],
        ['e"f', 'g', 'h'],
      ]);
    });

    it('空行をスキップする', () => {
      const input = 'a,b,c\r\n\r\n1,2,3\r\n  \r\n4,5,6';
      const result = parseCSV(input);
      expect(result).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ]);
    });

    it('LF改行も処理できる', () => {
      const input = 'a,b,c\n1,2,3\n4,5,6';
      const result = parseCSV(input);
      expect(result).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ]);
    });
  });

  describe('stringifyCSV', () => {
    it('通常のCSVを出力できる', () => {
      const input = [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ];
      const result = stringifyCSV(input);
      expect(result).toBe('a,b,c\r\n1,2,3');
    });

    it('カンマを含むフィールドを引用符で囲む', () => {
      const input = [['a,b', 'c', 'd']];
      const result = stringifyCSV(input);
      expect(result).toBe('"a,b",c,d');
    });

    it('引用符を含むフィールドをエスケープする', () => {
      const input = [['a"b', 'c', 'd']];
      const result = stringifyCSV(input);
      expect(result).toBe('"a""b",c,d');
    });
  });
});

describe('Converter', () => {
  describe('convertPayrollToAccounting', () => {
    it('単一伝票を変換できる', () => {
      const input = [
        [
          '0110',
          '',
          '20250115',
          '給料手当',
          '',
          '',
          '',
          '300000',
          '普通預金',
          '',
          '',
          '',
          '300000',
          '1月給与',
        ],
      ];
      const { outputRows, result } = convertPayrollToAccounting(input);

      expect(result.success).toBe(true);
      expect(result.slipCount).toBe(1);
      expect(result.rowCount).toBe(1);
      expect(outputRows).toHaveLength(1);

      const row = outputRows[0];
      expect(row).toBeDefined();
      if (row) {
        expect(row[0]).toBe('2110'); // フラグ
        expect(row[3]).toBe('2025/01/15'); // 日付
        expect(row[4]).toBe('給料手当'); // 借方勘定科目
        expect(row[7]).toBe('対象外'); // 借方税区分
        expect(row[8]).toBe('300000'); // 借方金額
        expect(row[10]).toBe('普通預金'); // 貸方勘定科目
        expect(row[13]).toBe('対象外'); // 貸方税区分
        expect(row[14]).toBe('300000'); // 貸方金額
        expect(row[16]).toBe('1月給与'); // 摘要
      }
    });

    it('複数行伝票を変換できる', () => {
      const input = [
        ['0110', '', '20250115', '給料手当', '', '', '', '300000', '', '', '', '', '0', '1月給与'],
        [
          '0100',
          '',
          '20250115',
          '法定福利費',
          '',
          '',
          '',
          '50000',
          '',
          '',
          '',
          '',
          '0',
          '社会保険料',
        ],
        ['0101', '', '20250115', '', '', '', '', '0', '普通預金', '', '', '', '350000', '振込'],
      ];
      const { outputRows, result } = convertPayrollToAccounting(input);

      expect(result.success).toBe(true);
      expect(result.slipCount).toBe(1);
      expect(result.rowCount).toBe(3);
      expect(outputRows).toHaveLength(3);

      // 1行目
      const row1 = outputRows[0];
      expect(row1).toBeDefined();
      if (row1) {
        expect(row1[0]).toBe('2110'); // 複数行1行目
        expect(row1[4]).toBe('給料手当');
        expect(row1[7]).toBe('対象外'); // 勘定科目あり
        expect(row1[8]).toBe('300000');
        expect(row1[10]).toBe(''); // 貸方科目なし
        expect(row1[13]).toBe(''); // 勘定科目なし
        expect(row1[14]).toBe('0'); // 必須項目
      }

      // 2行目
      const row2 = outputRows[1];
      expect(row2).toBeDefined();
      if (row2) {
        expect(row2[0]).toBe('2100'); // 中間行
        expect(row2[4]).toBe('法定福利費');
      }

      // 3行目
      const row3 = outputRows[2];
      expect(row3).toBeDefined();
      if (row3) {
        expect(row3[0]).toBe('2101'); // 最終行
        expect(row3[10]).toBe('普通預金');
      }
    });

    it('複数伝票を変換できる', () => {
      const input = [
        [
          '0110',
          '',
          '20250115',
          '給料手当',
          '',
          '',
          '',
          '100000',
          '普通預金',
          '',
          '',
          '',
          '100000',
          '給与1',
        ],
        [
          '0110',
          '',
          '20250120',
          '給料手当',
          '',
          '',
          '',
          '200000',
          '普通預金',
          '',
          '',
          '',
          '200000',
          '給与2',
        ],
      ];
      const { outputRows, result } = convertPayrollToAccounting(input);

      expect(result.success).toBe(true);
      expect(result.slipCount).toBe(2);
      expect(result.rowCount).toBe(2);
      expect(outputRows).toHaveLength(2);

      const row1 = outputRows[0];
      expect(row1).toBeDefined();
      if (row1) {
        expect(row1[0]).toBe('2110');
        expect(row1[16]).toBe('給与1');
      }

      const row2 = outputRows[1];
      expect(row2).toBeDefined();
      if (row2) {
        expect(row2[0]).toBe('2110');
        expect(row2[16]).toBe('給与2');
      }
    });

    it('空行を無視する', () => {
      const input = [
        [
          '0110',
          '',
          '20250115',
          '給料手当',
          '',
          '',
          '',
          '100000',
          '普通預金',
          '',
          '',
          '',
          '100000',
          '給与',
        ],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [],
      ];
      const { result } = convertPayrollToAccounting(input);

      expect(result.success).toBe(true);
      expect(result.slipCount).toBe(1);
      expect(result.rowCount).toBe(1);
    });
  });

  describe('convertCSVText', () => {
    it('CSV文字列を変換できる', () => {
      const input = '0110,,20250115,給料手当,,,,300000,普通預金,,,,300000,1月給与';
      const { outputText, result } = convertCSVText(input);

      expect(result.success).toBe(true);
      expect(result.slipCount).toBe(1);
      expect(result.rowCount).toBe(1);
      expect(outputText).toContain('2110');
      expect(outputText).toContain('2025/01/15');
      expect(outputText).toContain('給料手当');
      expect(outputText).toContain('対象外');
    });

    it('複数行CSV文字列を変換できる', () => {
      const input =
        '0110,,20250115,給料手当,,,,300000,,,,,0,1月給与\r\n' +
        '0101,,20250115,,,,,0,普通預金,,,,300000,振込';
      const { outputText, result } = convertCSVText(input);

      expect(result.success).toBe(true);
      expect(result.slipCount).toBe(1);
      expect(result.rowCount).toBe(2);
      expect(outputText).toContain('2110');
      expect(outputText).toContain('2101');
    });
  });
});
