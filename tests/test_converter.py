"""変換コアのテスト"""

from pathlib import Path
from textwrap import dedent

from yayoi_next_bridge.core.converter import (
    AccountingEntry,
    PayrollEntry,
    convert_file,
)


class TestPayrollEntry:
    """PayrollEntryのテスト"""

    def test_from_fields_full(self) -> None:
        """14項目すべてが揃っている場合"""
        fields = [
            "0110",  # flag
            "",  # unknown
            "20250205",  # date_raw
            "給料手当",  # debit_account
            "",  # debit_sub
            "",  # 5
            "",  # 6
            "300000",  # debit_amount
            "",  # credit_account
            "",  # credit_sub
            "",  # 10
            "",  # 11
            "",  # credit_amount
            "2月分給与",  # description
        ]
        entry = PayrollEntry.from_fields(fields)

        assert entry.flag == "0110"
        assert entry.date_raw == "20250205"
        assert entry.debit_account == "給料手当"
        assert entry.debit_amount == "300000"
        assert entry.description == "2月分給与"

    def test_from_fields_short(self) -> None:
        """項目が不足している場合は空白で埋める"""
        fields = ["0110", "", "20250205"]
        entry = PayrollEntry.from_fields(fields)

        assert entry.flag == "0110"
        assert entry.date_raw == "20250205"
        assert entry.debit_account == ""
        assert entry.description == ""


class TestAccountingEntry:
    """AccountingEntryのテスト"""

    def test_to_fields(self) -> None:
        """to_fieldsが25項目を返すこと"""
        entry = AccountingEntry(
            flag="2110",
            slip_no="",
            settlement="",
            date="2025/02/05",
            debit_account="給料手当",
            debit_sub="",
            debit_dept="",
            debit_tax_class="対象外",
            debit_amount="300000",
            debit_tax_amount="",
            credit_account="普通預金",
            credit_sub="",
            credit_dept="",
            credit_tax_class="対象外",
            credit_amount="300000",
            credit_tax_amount="",
            description="2月分給与",
            number="",
            due_date="",
            entry_type="0",
            source="",
            memo="",
            tag1="",
            tag2="",
            adjustment="",
        )

        fields = entry.to_fields()
        assert len(fields) == 25
        assert fields[0] == "2110"
        assert fields[3] == "2025/02/05"
        assert fields[4] == "給料手当"


class TestConvertFile:
    """convert_fileのテスト"""

    def test_convert_single_slip(self, tmp_path: Path) -> None:
        """単一伝票の変換テスト"""
        # 入力ファイル作成（Shift-JIS）
        input_content = dedent("""\
            0110,,20250205,給料手当,,,,,,,,,300000,2月分給与
            0101,,20250205,,,,,,普通預金,,,,,300000,2月分給与
        """)
        input_file = tmp_path / "input.txt"
        input_file.write_text(input_content, encoding="shift_jis")

        # 変換実行
        result = convert_file(input_file)

        # 検証
        assert result.success is True
        assert result.slip_count == 1
        assert result.row_count == 2
        assert result.output_path.exists()

        # 出力ファイルの内容確認
        output_content = result.output_path.read_text(encoding="shift_jis")
        lines = output_content.strip().split("\n")
        assert len(lines) == 2

        # 1行目: 2110（伝票開始）
        assert lines[0].startswith("2110,")
        # 2行目: 2101（伝票終了）
        assert lines[1].startswith("2101,")

    def test_convert_multiple_slips(self, tmp_path: Path) -> None:
        """複数伝票の変換テスト"""
        input_content = dedent("""\
            0110,,20250205,給料手当,,,,,,,,,300000,2月分給与
            0101,,20250205,,,,,,普通預金,,,,,300000,2月分給与
            0110,,20250305,給料手当,,,,,,,,,310000,3月分給与
            0100,,20250305,,,,,,所得税預り金,,,,,10000,3月分給与
            0101,,20250305,,,,,,普通預金,,,,,300000,3月分給与
        """)
        input_file = tmp_path / "input.txt"
        input_file.write_text(input_content, encoding="shift_jis")

        result = convert_file(input_file)

        assert result.success is True
        assert result.slip_count == 2
        assert result.row_count == 5

    def test_convert_nonexistent_file(self, tmp_path: Path) -> None:
        """存在しないファイルの変換テスト"""
        input_file = tmp_path / "nonexistent.txt"

        result = convert_file(input_file)

        assert result.success is False
        assert result.error_message != ""

    def test_output_filename(self, tmp_path: Path) -> None:
        """出力ファイル名のテスト"""
        input_file = tmp_path / "仕訳データ.txt"
        content = (
            "0110,,20250205,給料手当,,,,,,,,,300000,テスト\n"
            "0101,,20250205,,,,,,普通預金,,,,,300000,テスト"
        )
        input_file.write_text(content, encoding="shift_jis")

        result = convert_file(input_file)

        assert result.output_path.name == "仕訳データ_弥生会計NEXT用.txt"
