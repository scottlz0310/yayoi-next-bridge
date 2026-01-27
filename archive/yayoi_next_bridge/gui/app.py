"""
弥生給与NEXT → 弥生会計NEXT 変換ツール GUI

NiceGUIベースのシンプルなGUIアプリケーション。
ファイルアップロードで選択し、変換を実行します。
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from nicegui import ui

from yayoi_next_bridge.core import ConversionResult, convert_file


class ConverterApp:
    """変換アプリケーションのメインクラス"""

    def __init__(self) -> None:
        self.uploaded_files: list[tuple[str, Path]] = []  # (name, temp_path)
        self.results: list[ConversionResult] = []
        # UIコンポーネントの参照を初期化（後で設定）
        self.convert_button: ui.button | None = None
        self.file_list_container: ui.column | None = None
        self.result_card: ui.card | None = None
        self.result_container: ui.column | None = None
        self.download_container: ui.column | None = None
        self._setup_ui()

    def _setup_ui(self) -> None:
        """UIをセットアップ"""
        # ページ設定
        ui.page_title("弥生NEXTブリッジ")

        # ヘッダー
        with ui.header().classes("bg-blue-600"):
            ui.label("弥生NEXTブリッジ").classes("text-xl font-bold")
            ui.space()
            ui.label("弥生給与NEXT → 弥生会計NEXT 変換ツール").classes("text-sm")

        # メインコンテンツ
        with ui.column().classes("w-full max-w-3xl mx-auto p-4 gap-4"):
            # 説明文
            ui.markdown(
                "弥生給与NEXTからエクスポートした仕訳データを、"
                "弥生会計NEXTにインポートできる形式に変換します。"
            )

            # ファイル選択エリア
            self._create_file_selection_area()

            # 変換ボタン（ファイルリストの更新でアクセスするため先に作成）
            self._create_action_area()

            # 選択されたファイル一覧
            self._create_file_list_area()

            # 結果表示エリア
            self._create_result_area()

    def _create_file_selection_area(self) -> None:
        """ファイル選択エリアを作成"""
        with ui.card().classes("w-full"):
            ui.label("ファイルを選択").classes("text-lg font-semibold mb-2")

            # アップロードコンポーネント
            ui.upload(
                label="ファイルをドラッグ&ドロップ または クリックして選択",
                on_upload=self._handle_upload,
                multiple=True,
                auto_upload=True,
            ).classes("w-full").props('accept=".txt"')

    def _create_action_area(self) -> None:
        """アクションボタンエリアを作成"""
        with ui.row().classes("w-full justify-center gap-4"):
            self.convert_button = ui.button(
                "変換を実行",
                icon="transform",
                on_click=self._execute_conversion,
            ).classes("bg-green-600").props("size=lg")
            self.convert_button.disable()

            ui.button(
                "クリア",
                icon="clear",
                on_click=self._clear_files,
            ).classes("bg-gray-500")

    def _create_file_list_area(self) -> None:
        """選択されたファイル一覧を表示するエリアを作成"""
        with ui.card().classes("w-full"):
            ui.label("アップロードされたファイル").classes("text-lg font-semibold mb-2")
            self.file_list_container = ui.column().classes("w-full gap-1")
            self._update_file_list()

    def _create_result_area(self) -> None:
        """結果表示エリアを作成"""
        with ui.card().classes("w-full") as self.result_card:
            ui.label("変換結果").classes("text-lg font-semibold mb-2")
            self.result_container = ui.column().classes("w-full gap-2")
            self.download_container = ui.column().classes("w-full gap-2 mt-4")
            self.result_card.set_visibility(False)

    def _handle_upload(self, e: Any) -> None:  # noqa: ANN401
        """アップロードイベントを処理"""
        # NiceGUIのUploadEventArgumentsの属性に直接アクセス
        name = getattr(e, "name", None)
        content = getattr(e, "content", None)

        if name and content:
            # 一時ファイルに保存
            temp_dir = Path(tempfile.gettempdir()) / "yayoi_next_bridge"
            temp_dir.mkdir(exist_ok=True)
            temp_path = temp_dir / name
            temp_path.write_bytes(content.read())

            self.uploaded_files.append((name, temp_path))
            self._update_file_list()
            ui.notify(f"ファイルをアップロードしました: {name}")

    def _update_file_list(self) -> None:
        """ファイル一覧を更新"""
        # コンポーネントがまだ作成されていない場合は何もしない
        if self.file_list_container is None or self.convert_button is None:
            return

        self.file_list_container.clear()

        if not self.uploaded_files:
            with self.file_list_container:
                ui.label("ファイルがアップロードされていません").classes(
                    "text-gray-500 italic"
                )
            self.convert_button.disable()
        else:
            with self.file_list_container:
                for i, (name, _path) in enumerate(self.uploaded_files):
                    with ui.row().classes("w-full items-center gap-2"):
                        ui.icon("description").classes("text-blue-500")
                        ui.label(name).classes("flex-grow")
                        ui.button(
                            icon="close",
                            on_click=lambda _, idx=i: self._remove_file(idx),
                        ).props("flat round size=sm")
            self.convert_button.enable()

    def _remove_file(self, index: int) -> None:
        """ファイルを一覧から削除"""
        if 0 <= index < len(self.uploaded_files):
            self.uploaded_files.pop(index)
            self._update_file_list()

    def _clear_files(self) -> None:
        """ファイル一覧をクリア"""
        self.uploaded_files.clear()
        self._update_file_list()
        if self.result_card is not None:
            self.result_card.set_visibility(False)

    async def _execute_conversion(self) -> None:
        """変換を実行"""
        if not self.uploaded_files:
            ui.notify("ファイルをアップロードしてください", type="warning")
            return

        if self.convert_button is not None:
            self.convert_button.disable()
        self.results.clear()

        # 変換実行
        for _name, temp_path in self.uploaded_files:
            result = convert_file(temp_path)
            self.results.append(result)

        if self.convert_button is not None:
            self.convert_button.enable()

        # 結果を表示
        self._show_results()

    def _show_results(self) -> None:
        """変換結果を表示"""
        # コンポーネントがまだ作成されていない場合は何もしない
        if (
            self.result_container is None
            or self.download_container is None
            or self.result_card is None
        ):
            return

        self.result_container.clear()
        self.download_container.clear()
        self.result_card.set_visibility(True)

        success_count = sum(1 for r in self.results if r.success)
        fail_count = len(self.results) - success_count

        with self.result_container:
            # サマリー
            with ui.row().classes("w-full gap-4"):
                ui.label(f"✅ 成功: {success_count}件").classes("text-green-600")
                if fail_count > 0:
                    ui.label(f"❌ 失敗: {fail_count}件").classes("text-red-600")

            ui.separator()

            # 詳細
            for result in self.results:
                with ui.row().classes("w-full items-center gap-2"):
                    if result.success:
                        ui.icon("check_circle").classes("text-green-500")
                        ui.label(result.input_path.name)
                        ui.label(
                            f"({result.slip_count}伝票, {result.row_count}行)"
                        ).classes("text-sm text-gray-400")
                    else:
                        ui.icon("error").classes("text-red-500")
                        ui.label(result.input_path.name)
                        ui.label(f"エラー: {result.error_message}").classes(
                            "text-red-500 text-sm"
                        )

        # ダウンロードボタン
        with self.download_container:
            ui.label("変換されたファイルをダウンロード:").classes("font-semibold")
            for result in self.results:
                if result.success and result.output_path.exists():

                    def make_download(path: Path = result.output_path) -> None:
                        ui.download(path.read_bytes(), path.name)

                    ui.button(
                        f"📥 {result.output_path.name}",
                        on_click=make_download,
                    ).classes("text-blue-600")

        # 通知
        if fail_count == 0:
            ui.notify(f"{success_count}件のファイルを変換しました", type="positive")
        else:
            ui.notify(
                f"{success_count}件成功、{fail_count}件失敗",
                type="warning" if success_count > 0 else "negative",
            )


def _create_app() -> None:
    """UIを作成するルート関数（ui.runのroot引数用）"""
    ConverterApp()


def main() -> None:
    """アプリケーションのエントリーポイント"""
    ui.run(  # type: ignore[reportUnknownMemberType]
        root=_create_app,
        title="弥生NEXTブリッジ",
        reload=False,
    )


if __name__ in {"__main__", "__mp_main__"}:
    main()
