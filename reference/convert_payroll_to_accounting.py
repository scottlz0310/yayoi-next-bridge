#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
弥生給与NEXT → 弥生会計NEXT 仕訳データ変換スクリプト

【入力形式】弥生給与NEXT 仕訳データ出力（14項目、Shift-JIS）
【出力形式】弥生会計NEXT 25項目形式（Shift-JIS）

使用方法:
    python convert_payroll_to_accounting.py <入力ファイル> [出力ファイル]
    python convert_payroll_to_accounting.py --all  # YY-01〜YY-12全フォルダを処理（YYは年度）
"""

import csv
import os
import sys
import glob
from datetime import datetime

# ========================================
# 弥生会計NEXT 25項目形式の定義
# 出典: https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611
# ========================================
# 1: 識別フラグ
#    2000/2111 = 1行の仕訳データ
#    2110 = 複数行の仕訳データ 1行目
#    2100 = 複数行の仕訳データ 中間行
#    2101 = 複数行の仕訳データ 最終行
# 2: 伝票No
# 3: 決算 (空白=通常、1=決算、2=調整)
# 4: 取引日付 (YYYY/MM/DD形式)
# 5: 借方勘定科目
# 6: 借方補助科目
# 7: 借方部門
# 8: 借方税区分
# 9: 借方金額
# 10: 借方税金額
# 11: 貸方勘定科目
# 12: 貸方補助科目
# 13: 貸方部門
# 14: 貸方税区分
# 15: 貸方金額
# 16: 貸方税金額
# 17: 摘要
# 18: 番号
# 19: 期日
# 20: タイプ
# 21: 生成元
# 22: 仕訳メモ
# 23: 付箋1
# 24: 付箋2
# 25: 調整

HEADER_25 = [
    "識別フラグ", "伝票No", "決算", "取引日付",
    "借方勘定科目", "借方補助科目", "借方部門", "借方税区分", "借方金額", "借方税金額",
    "貸方勘定科目", "貸方補助科目", "貸方部門", "貸方税区分", "貸方金額", "貸方税金額",
    "摘要", "番号", "期日", "タイプ", "生成元", "仕訳メモ", "付箋1", "付箋2", "調整"
]


def parse_input_line(fields):
    """
    弥生給与NEXTの出力行（14項目）をパースする
    
    入力形式:
    [0] 識別フラグ (0110=伝票開始, 0100=中間行, 0101=伝票終了)
    [1] 不明（通常空白）
    [2] 日付 (YYYYMMDD)
    [3] 借方勘定科目
    [4] 借方補助科目
    [5] 空白
    [6] 空白
    [7] 借方金額
    [8] 貸方勘定科目
    [9] 貸方補助科目
    [10] 空白
    [11] 空白
    [12] 貸方金額
    [13] 摘要
    """
    if len(fields) < 14:
        fields.extend([''] * (14 - len(fields)))
    
    return {
        'flag': fields[0],
        'unknown': fields[1],
        'date_raw': fields[2],
        'debit_account': fields[3],
        'debit_sub': fields[4],
        'debit_amount': fields[7],
        'credit_account': fields[8],
        'credit_sub': fields[9],
        'credit_amount': fields[12],
        'description': fields[13]
    }


def format_date(date_str):
    """日付をYYYYMMDD形式からYYYY/MM/DD形式に変換"""
    if len(date_str) == 8:
        return f"{date_str[:4]}/{date_str[4:6]}/{date_str[6:8]}"
    return date_str


def convert_flag(original_flag, is_first_line):
    """
    識別フラグを変換
    弥生給与NEXT: 0110(開始), 0100(中間), 0101(終了)
    弥生会計NEXT: 2110(複数行1行目), 2100(中間行), 2101(最終行)
    出典: https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611
    """
    if is_first_line:
        return "2110"  # 複数行の仕訳データ 1行目
    else:
        if original_flag == "0101":
            return "2101"  # 複数行の仕訳データ 最終行
        else:
            return "2100"  # 複数行の仕訳データ 中間行


def build_25_item_row(parsed, flag_25, slip_no=""):
    """
    25項目形式の行を構築
    
    税区分について（公式仕様より）:
    - 借方/貸方税区分は「必須」項目
    - 複数行の仕訳データで勘定科目がない場合のみ空白可
    - 給与関連仕訳は消費税対象外のため「対象外」を設定
    
    金額について（公式仕様より）:
    - 借方/貸方税込金額は「必須」項目
    - 複数行の仕訳データで勘定科目がない場合でも必須
    - 勘定科目がない場合は「0」を入力
    """
    # 勘定科目がある場合は税区分「対象外」、ない場合は空白
    debit_tax_class = "対象外" if parsed['debit_account'] else ""
    credit_tax_class = "対象外" if parsed['credit_account'] else ""
    
    # 金額: 勘定科目がある場合は元の金額、ない場合は「0」（必須項目）
    debit_amount = parsed['debit_amount'] if parsed['debit_account'] else "0"
    credit_amount = parsed['credit_amount'] if parsed['credit_account'] else "0"
    
    row = [
        flag_25,                              # 1: 識別フラグ
        slip_no,                              # 2: 伝票No（空白で自動採番）
        "",                                   # 3: 決算（通常仕訳は空白）
        format_date(parsed['date_raw']),      # 4: 取引日付
        parsed['debit_account'],              # 5: 借方勘定科目
        parsed['debit_sub'],                  # 6: 借方補助科目
        "",                                   # 7: 借方部門
        debit_tax_class,                      # 8: 借方税区分（給与関連は対象外）
        debit_amount,                         # 9: 借方金額（必須、科目なしは0）
        "",                                   # 10: 借方税金額
        parsed['credit_account'],             # 11: 貸方勘定科目
        parsed['credit_sub'],                 # 12: 貸方補助科目
        "",                                   # 13: 貸方部門
        credit_tax_class,                     # 14: 貸方税区分（給与関連は対象外）
        credit_amount,                        # 15: 貸方金額（必須、科目なしは0）
        "",                                   # 16: 貸方税金額
        parsed['description'],                # 17: 摘要
        "",                                   # 18: 番号
        "",                                   # 19: 期日
        "0",                                  # 20: タイプ（0=通常）
        "",                                   # 21: 生成元
        "",                                   # 22: 仕訳メモ
        "",                                   # 23: 付箋1
        "",                                   # 24: 付箋2
        "",                                   # 25: 調整
    ]
    return row


def convert_file(input_path, output_path=None):
    """
    単一ファイルを変換
    """
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_弥生会計NEXT用.txt"
    
    print(f"変換中: {input_path}")
    
    # 入力ファイルを読み込み（Shift-JIS）
    rows_25 = []
    slip_count = 0  # 伝票数カウンター（完了した伝票数）
    current_slip_rows = []
    
    with open(input_path, 'r', encoding='shift_jis') as f:
        reader = csv.reader(f)
        
        for line_no, fields in enumerate(reader, 1):
            if not fields or all(f.strip() == '' for f in fields):
                continue
            
            parsed = parse_input_line(fields)
            
            # 伝票の開始を判定
            if parsed['flag'] == '0110':
                # 前の伝票があれば出力リストに追加
                if current_slip_rows:
                    rows_25.extend(current_slip_rows)
                    slip_count += 1
                
                current_slip_rows = []
                is_first = True
            else:
                is_first = len(current_slip_rows) == 0
            
            # フラグ変換
            flag_25 = convert_flag(parsed['flag'], is_first)
            
            # 25項目形式に変換（伝票Noは空白で自動採番に任せる）
            row_25 = build_25_item_row(parsed, flag_25, "")
            current_slip_rows.append(row_25)
    
    # 最後の伝票を追加
    if current_slip_rows:
        rows_25.extend(current_slip_rows)
        slip_count += 1
    
    # 出力ファイルに書き込み（Shift-JIS, QUOTE_MINIMAL）
    with open(output_path, 'w', encoding='shift_jis', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        for row in rows_25:
            writer.writerow(row)
    
    print(f"出力完了: {output_path}")
    print(f"  変換した伝票数: {slip_count}")
    print(f"  変換した仕訳行数: {len(rows_25)}")
    
    return output_path


def convert_all_folders(base_path, year_prefix="YY"):
    """
    YY-01〜YY-12の全フォルダを処理（YYは年度プレフィックス）
    """
    results = []
    
    for month in range(1, 13):
        folder_name = f"{year_prefix}-{month:02d}"
        folder_path = os.path.join(base_path, folder_name)
        
        if not os.path.exists(folder_path):
            print(f"スキップ: {folder_name} フォルダが存在しません")
            continue
        
        # フォルダ内の仕訳データファイルを検索
        pattern = os.path.join(folder_path, "仕訳データ*.txt")
        files = glob.glob(pattern)
        
        for input_file in files:
            # すでに変換済みファイルは除外
            if "_弥生会計NEXT用" in input_file:
                continue
            
            output_file = convert_file(input_file)
            results.append((input_file, output_file))
    
    return results


def main():
    """メイン処理"""
    if len(sys.argv) < 2:
        print(__doc__)
        print("\n使用例:")
        print('  python convert_payroll_to_accounting.py "仕訳データ（〇〇株式会社）_給与支給手続き YYYY_MM_DD 支払い分.txt"')
        print('  python convert_payroll_to_accounting.py --all')
        sys.exit(1)
    
    if sys.argv[1] == '--all':
        # スクリプトの親フォルダをベースパスとして使用
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_path = os.path.dirname(script_dir)
        
        print(f"全フォルダ処理モード")
        print(f"ベースパス: {base_path}")
        print("=" * 60)
        
        results = convert_all_folders(base_path)
        
        print("\n" + "=" * 60)
        print(f"処理完了: {len(results)} ファイルを変換しました")
        
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else None
        
        if not os.path.exists(input_path):
            print(f"エラー: ファイルが見つかりません: {input_path}")
            sys.exit(1)
        
        convert_file(input_path, output_path)


if __name__ == '__main__':
    main()
