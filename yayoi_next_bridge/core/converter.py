"""
弥生給与NEXT → 弥生会計NEXT 変換コアロジック

referenceのプロトタイプをベースに型安全に書き直したモジュール。
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Generator

# 弥生給与NEXTの項目数
PAYROLL_FIELD_COUNT = 14
# 日付文字列の長さ (YYYYMMDD)
DATE_STRING_LENGTH = 8


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
# 5-10: 借方（勘定科目、補助科目、部門、税区分、金額、税金額）
# 11-16: 貸方（同上）
# 17: 摘要
# 18-25: 番号、期日、タイプ、生成元、仕訳メモ、付箋1、付箋2、調整


@dataclass(frozen=True)
class PayrollEntry:
    """弥生給与NEXTの仕訳行（14項目）を表すデータクラス"""

    flag: str  # 識別フラグ (0110=開始, 0100=中間, 0101=終了)
    unknown: str  # 不明項目（通常空白）
    date_raw: str  # 日付 (YYYYMMDD形式)
    debit_account: str  # 借方勘定科目
    debit_sub: str  # 借方補助科目
    debit_amount: str  # 借方金額
    credit_account: str  # 貸方勘定科目
    credit_sub: str  # 貸方補助科目
    credit_amount: str  # 貸方金額
    description: str  # 摘要

    @classmethod
    def from_fields(cls, fields: list[str]) -> PayrollEntry:
        """CSVフィールドからPayrollEntryを生成"""
        # 不足項目を空白で埋める
        if len(fields) < PAYROLL_FIELD_COUNT:
            padded = fields + [""] * (PAYROLL_FIELD_COUNT - len(fields))
        else:
            padded = fields
        return cls(
            flag=padded[0],
            unknown=padded[1],
            date_raw=padded[2],
            debit_account=padded[3],
            debit_sub=padded[4],
            debit_amount=padded[7],
            credit_account=padded[8],
            credit_sub=padded[9],
            credit_amount=padded[12],
            description=padded[13],
        )


@dataclass(frozen=True)
class AccountingEntry:
    """弥生会計NEXTの仕訳行（25項目）を表すデータクラス"""

    flag: str  # 識別フラグ (2110/2100/2101)
    slip_no: str  # 伝票No（空白で自動採番）
    settlement: str  # 決算
    date: str  # 取引日付 (YYYY/MM/DD形式)
    debit_account: str  # 借方勘定科目
    debit_sub: str  # 借方補助科目
    debit_dept: str  # 借方部門
    debit_tax_class: str  # 借方税区分
    debit_amount: str  # 借方金額
    debit_tax_amount: str  # 借方税金額
    credit_account: str  # 貸方勘定科目
    credit_sub: str  # 貸方補助科目
    credit_dept: str  # 貸方部門
    credit_tax_class: str  # 貸方税区分
    credit_amount: str  # 貸方金額
    credit_tax_amount: str  # 貸方税金額
    description: str  # 摘要
    number: str  # 番号
    due_date: str  # 期日
    entry_type: str  # タイプ
    source: str  # 生成元
    memo: str  # 仕訳メモ
    tag1: str  # 付箋1
    tag2: str  # 付箋2
    adjustment: str  # 調整

    def to_fields(self) -> list[str]:
        """CSV出力用のフィールドリストを返す"""
        return [
            self.flag,
            self.slip_no,
            self.settlement,
            self.date,
            self.debit_account,
            self.debit_sub,
            self.debit_dept,
            self.debit_tax_class,
            self.debit_amount,
            self.debit_tax_amount,
            self.credit_account,
            self.credit_sub,
            self.credit_dept,
            self.credit_tax_class,
            self.credit_amount,
            self.credit_tax_amount,
            self.description,
            self.number,
            self.due_date,
            self.entry_type,
            self.source,
            self.memo,
            self.tag1,
            self.tag2,
            self.adjustment,
        ]


@dataclass
class ConversionResult:
    """変換結果を表すデータクラス"""

    input_path: Path
    output_path: Path
    slip_count: int  # 変換した伝票数
    row_count: int  # 変換した行数
    success: bool
    error_message: str = ""


def _format_date(date_str: str) -> str:
    """日付をYYYYMMDD形式からYYYY/MM/DD形式に変換"""
    if len(date_str) == DATE_STRING_LENGTH:
        return f"{date_str[:4]}/{date_str[4:6]}/{date_str[6:8]}"
    return date_str


def _convert_flag(original_flag: str, *, is_first_line: bool) -> str:
    """
    識別フラグを変換

    弥生給与NEXT: 0110(開始), 0100(中間), 0101(終了)
    弥生会計NEXT: 2110(複数行1行目), 2100(中間行), 2101(最終行)
    """
    if is_first_line:
        return "2110"  # 複数行の仕訳データ 1行目
    if original_flag == "0101":
        return "2101"  # 複数行の仕訳データ 最終行
    return "2100"  # 複数行の仕訳データ 中間行


def _convert_entry(entry: PayrollEntry, *, is_first_line: bool) -> AccountingEntry:
    """PayrollEntryをAccountingEntryに変換"""
    # 勘定科目がある場合は税区分「対象外」、ない場合は空白
    debit_tax_class = "対象外" if entry.debit_account else ""
    credit_tax_class = "対象外" if entry.credit_account else ""

    # 金額: 勘定科目がある場合は元の金額、ない場合は「0」（必須項目）
    debit_amount = entry.debit_amount if entry.debit_account else "0"
    credit_amount = entry.credit_amount if entry.credit_account else "0"

    return AccountingEntry(
        flag=_convert_flag(entry.flag, is_first_line=is_first_line),
        slip_no="",  # 空白で自動採番
        settlement="",  # 通常仕訳は空白
        date=_format_date(entry.date_raw),
        debit_account=entry.debit_account,
        debit_sub=entry.debit_sub,
        debit_dept="",
        debit_tax_class=debit_tax_class,
        debit_amount=debit_amount,
        debit_tax_amount="",
        credit_account=entry.credit_account,
        credit_sub=entry.credit_sub,
        credit_dept="",
        credit_tax_class=credit_tax_class,
        credit_amount=credit_amount,
        credit_tax_amount="",
        description=entry.description,
        number="",
        due_date="",
        entry_type="0",  # 0=通常
        source="",
        memo="",
        tag1="",
        tag2="",
        adjustment="",
    )


def _read_payroll_entries(
    input_path: Path,
) -> Generator[PayrollEntry, None, None]:
    """弥生給与NEXTのCSVファイルを読み込み、PayrollEntryを生成"""
    with input_path.open("r", encoding="shift_jis") as f:
        reader = csv.reader(f)
        for fields in reader:
            if not fields or all(field.strip() == "" for field in fields):
                continue
            yield PayrollEntry.from_fields(fields)


def convert_file(input_path: Path, output_path: Path | None = None) -> ConversionResult:
    """
    単一ファイルを変換

    Args:
        input_path: 入力ファイルパス（弥生給与NEXT形式）
        output_path: 出力ファイルパス（省略時は入力ファイル名に「_弥生会計NEXT用」を付加）

    Returns:
        ConversionResult: 変換結果
    """
    if output_path is None:
        output_path = input_path.with_stem(f"{input_path.stem}_弥生会計NEXT用")

    try:
        accounting_entries: list[AccountingEntry] = []
        slip_count = 0
        current_slip_entries: list[AccountingEntry] = []

        for entry in _read_payroll_entries(input_path):
            # 伝票の開始を判定
            if entry.flag == "0110":
                # 前の伝票があれば出力リストに追加
                if current_slip_entries:
                    accounting_entries.extend(current_slip_entries)
                    slip_count += 1

                current_slip_entries = []
                is_first = True
            else:
                is_first = len(current_slip_entries) == 0

            # 変換してリストに追加
            converted = _convert_entry(entry, is_first_line=is_first)
            current_slip_entries.append(converted)

        # 最後の伝票を追加
        if current_slip_entries:
            accounting_entries.extend(current_slip_entries)
            slip_count += 1

        # 出力ファイルに書き込み（Shift-JIS, QUOTE_MINIMAL）
        with output_path.open("w", encoding="shift_jis", newline="") as f:
            writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
            for entry in accounting_entries:
                writer.writerow(entry.to_fields())

        return ConversionResult(
            input_path=input_path,
            output_path=output_path,
            slip_count=slip_count,
            row_count=len(accounting_entries),
            success=True,
        )

    except (OSError, UnicodeDecodeError, csv.Error) as e:
        return ConversionResult(
            input_path=input_path,
            output_path=output_path,
            slip_count=0,
            row_count=0,
            success=False,
            error_message=str(e),
        )


def convert_files(input_paths: list[Path]) -> list[ConversionResult]:
    """
    複数ファイルを変換

    Args:
        input_paths: 入力ファイルパスのリスト

    Returns:
        list[ConversionResult]: 変換結果のリスト
    """
    return [convert_file(path) for path in input_paths]
