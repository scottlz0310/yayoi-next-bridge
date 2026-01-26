<#
.SYNOPSIS
    弥生給与NEXT → 弥生会計NEXT 仕訳データ変換スクリプト

.DESCRIPTION
    弥生給与NEXTから出力された仕訳データ（14項目、Shift-JIS）を
    弥生会計NEXTに取り込める25項目形式（Shift-JIS）に変換します。

.PARAMETER InputFile
    変換する入力ファイルのパス

.PARAMETER OutputFile
    出力ファイルのパス（省略時は入力ファイル名に「_弥生会計NEXT用」を付加）

.PARAMETER All
    YY-01〜YY-12の全フォルダを一括処理（YYは年度プレフィックス）

.EXAMPLE
    .\Convert-PayrollToAccounting.ps1 -InputFile ".\YY-01\仕訳データ（〇〇株式会社）_給与支給手続き YYYY_MM_DD 支払い分.txt"

.EXAMPLE
    .\Convert-PayrollToAccounting.ps1 -All
#>

[CmdletBinding()]
param(
    [Parameter(ParameterSetName='Single')]
    [string]$InputFile,
    
    [Parameter(ParameterSetName='Single')]
    [string]$OutputFile,
    
    [Parameter(ParameterSetName='All')]
    [switch]$All
)

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

$ShiftJIS = [System.Text.Encoding]::GetEncoding('shift_jis')

function Parse-InputLine {
    <#
    .SYNOPSIS
        弥生給与NEXTの出力行（14項目）をパースする
    
    .DESCRIPTION
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
    #>
    param([string[]]$Fields)
    
    # 不足項目を空白で埋める
    while ($Fields.Count -lt 14) {
        $Fields += ""
    }
    
    return @{
        Flag = $Fields[0]
        Unknown = $Fields[1]
        DateRaw = $Fields[2]
        DebitAccount = $Fields[3]
        DebitSub = $Fields[4]
        DebitAmount = $Fields[7]
        CreditAccount = $Fields[8]
        CreditSub = $Fields[9]
        CreditAmount = $Fields[12]
        Description = $Fields[13]
    }
}

function Format-DateYYYYMMDD {
    <#
    .SYNOPSIS
        日付をYYYYMMDD形式からYYYY/MM/DD形式に変換
    #>
    param([string]$DateStr)
    
    if ($DateStr.Length -eq 8) {
        return "{0}/{1}/{2}" -f $DateStr.Substring(0, 4), $DateStr.Substring(4, 2), $DateStr.Substring(6, 2)
    }
    return $DateStr
}

function Convert-Flag {
    <#
    .SYNOPSIS
        識別フラグを変換
    
    .DESCRIPTION
        弥生給与NEXT: 0110(開始), 0100(中間), 0101(終了)
        弥生会計NEXT: 2110(複数行1行目), 2100(中間行), 2101(最終行)
        出典: https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611
    #>
    param(
        [string]$OriginalFlag,
        [bool]$IsFirstLine
    )
    
    if ($IsFirstLine) {
        return "2110"  # 複数行の仕訳データ 1行目
    } else {
        if ($OriginalFlag -eq "0101") {
            return "2101"  # 複数行の仕訳データ 最終行
        } else {
            return "2100"  # 複数行の仕訳データ 中間行
        }
    }
}

function Build-25ItemRow {
    <#
    .SYNOPSIS
        25項目形式の行を構築
    
    .DESCRIPTION
        税区分について（公式仕様より）:
        - 借方/貸方税区分は「必須」項目
        - 複数行の仕訳データで勘定科目がない場合のみ空白可
        - 給与関連仕訳は消費税対象外のため「対象外」を設定
        
        金額について（公式仕様より）:
        - 借方/貸方税込金額は「必須」項目
        - 複数行の仕訳データで勘定科目がない場合でも必須
        - 勘定科目がない場合は「0」を入力
    #>
    param(
        [hashtable]$Parsed,
        [string]$Flag25,
        [string]$SlipNo = ""
    )
    
    # 勘定科目がある場合は税区分「対象外」、ない場合は空白
    $debitTaxClass = if ($Parsed.DebitAccount) { "対象外" } else { "" }
    $creditTaxClass = if ($Parsed.CreditAccount) { "対象外" } else { "" }
    
    # 金額: 勘定科目がある場合は元の金額、ない場合は「0」（必須項目）
    $debitAmount = if ($Parsed.DebitAccount) { $Parsed.DebitAmount } else { "0" }
    $creditAmount = if ($Parsed.CreditAccount) { $Parsed.CreditAmount } else { "0" }
    
    return @(
        $Flag25,                                      # 1: 識別フラグ
        $SlipNo,                                      # 2: 伝票No（空白で自動採番）
        "",                                           # 3: 決算（通常仕訳は空白）
        (Format-DateYYYYMMDD $Parsed.DateRaw),        # 4: 取引日付
        $Parsed.DebitAccount,                         # 5: 借方勘定科目
        $Parsed.DebitSub,                             # 6: 借方補助科目
        "",                                           # 7: 借方部門
        $debitTaxClass,                               # 8: 借方税区分（給与関連は対象外）
        $debitAmount,                                 # 9: 借方金額（必須、科目なしは0）
        "",                                           # 10: 借方税金額
        $Parsed.CreditAccount,                        # 11: 貸方勘定科目
        $Parsed.CreditSub,                            # 12: 貸方補助科目
        "",                                           # 13: 貸方部門
        $creditTaxClass,                              # 14: 貸方税区分（給与関連は対象外）
        $creditAmount,                                # 15: 貸方金額（必須、科目なしは0）
        "",                                           # 16: 貸方税金額
        $Parsed.Description,                          # 17: 摘要
        "",                                           # 18: 番号
        "",                                           # 19: 期日
        "0",                                          # 20: タイプ（0=通常）
        "",                                           # 21: 生成元
        "",                                           # 22: 仕訳メモ
        "",                                           # 23: 付箋1
        "",                                           # 24: 付箋2
        ""                                            # 25: 調整
    )
}

function Convert-ToCsvLine {
    <#
    .SYNOPSIS
        配列をCSV形式の1行に変換（必要な場合のみダブルクォートで囲む）
    #>
    param([string[]]$Fields)
    
    $quotedFields = $Fields | ForEach-Object {
        $value = $_
        # カンマ、ダブルクォート、改行を含む場合のみクォートで囲む
        if ($value -match '[,"\r\n]') {
            $escaped = $value -replace '"', '""'
            '"{0}"' -f $escaped
        } else {
            $value
        }
    }
    return $quotedFields -join ","
}

function Parse-CsvLine {
    <#
    .SYNOPSIS
        CSV行をパースして配列を返す
    #>
    param([string]$Line)
    
    $fields = @()
    $current = ""
    $inQuotes = $false
    
    for ($i = 0; $i -lt $Line.Length; $i++) {
        $char = $Line[$i]
        
        if ($char -eq '"') {
            if ($inQuotes -and ($i + 1) -lt $Line.Length -and $Line[$i + 1] -eq '"') {
                # エスケープされたダブルクォート
                $current += '"'
                $i++
            } else {
                # クォートの開始/終了
                $inQuotes = -not $inQuotes
            }
        } elseif ($char -eq ',' -and -not $inQuotes) {
            # フィールド区切り
            $fields += $current
            $current = ""
        } else {
            $current += $char
        }
    }
    $fields += $current
    
    return $fields
}

function Convert-PayrollFile {
    <#
    .SYNOPSIS
        単一ファイルを変換
    #>
    param(
        [string]$InputPath,
        [string]$OutputPath = $null
    )
    
    if (-not $OutputPath) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($InputPath)
        $dirName = [System.IO.Path]::GetDirectoryName($InputPath)
        $OutputPath = Join-Path $dirName "$($baseName)_弥生会計NEXT用.txt"
    }
    
    Write-Host "変換中: $InputPath" -ForegroundColor Cyan
    
    # 入力ファイルを読み込み（Shift-JIS）
    $content = Get-Content -Path $InputPath -Encoding $ShiftJIS
    
    $rows25 = @()
    $slipCount = 0  # 伝票数カウンター（完了した伝票数）
    $currentSlipRows = @()
    
    foreach ($line in $content) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }
        
        $fields = Parse-CsvLine $line
        $parsed = Parse-InputLine $fields
        
        # 伝票の開始を判定
        if ($parsed.Flag -eq '0110') {
            # 前の伝票があれば出力リストに追加
            if ($currentSlipRows.Count -gt 0) {
                $rows25 += $currentSlipRows
                $slipCount++
            }
            
            $currentSlipRows = @()
            $isFirst = $true
        } else {
            $isFirst = ($currentSlipRows.Count -eq 0)
        }
        
        # フラグ変換
        $flag25 = Convert-Flag -OriginalFlag $parsed.Flag -IsFirstLine $isFirst
        
        # 25項目形式に変換（伝票Noは空白で自動採番に任せる）
        $row25 = Build-25ItemRow -Parsed $parsed -Flag25 $flag25 -SlipNo ""
        $currentSlipRows += , $row25
    }
    
    # 最後の伝票を追加
    if ($currentSlipRows.Count -gt 0) {
        $rows25 += $currentSlipRows
        $slipCount++
    }
    
    # 出力ファイルに書き込み（Shift-JIS）
    $outputLines = @()
    foreach ($row in $rows25) {
        $outputLines += Convert-ToCsvLine $row
    }
    
    $outputLines | Out-File -FilePath $OutputPath -Encoding $ShiftJIS
    
    Write-Host "出力完了: $OutputPath" -ForegroundColor Green
    Write-Host "  変換した伝票数: $slipCount" -ForegroundColor Yellow
    Write-Host "  変換した仕訳行数: $($rows25.Count)" -ForegroundColor Yellow
    
    return $OutputPath
}

function Convert-AllFolders {
    <#
    .SYNOPSIS
        YY-01〜YY-12の全フォルダを処理（YYは年度プレフィックス）
    #>
    param(
        [string]$BasePath,
        [string]$YearPrefix = "YY"
    )
    
    $results = @()
    
    for ($month = 1; $month -le 12; $month++) {
        $folderName = "{0}-{1:D2}" -f $YearPrefix, $month
        $folderPath = Join-Path $BasePath $folderName
        
        if (-not (Test-Path $folderPath)) {
            Write-Host "スキップ: $folderName フォルダが存在しません" -ForegroundColor Gray
            continue
        }
        
        # フォルダ内の仕訳データファイルを検索
        $files = Get-ChildItem -Path $folderPath -Filter "仕訳データ*.txt" -File
        
        foreach ($file in $files) {
            # すでに変換済みファイルは除外
            if ($file.Name -like "*_弥生会計NEXT用*") {
                continue
            }
            
            $outputFile = Convert-PayrollFile -InputPath $file.FullName
            $results += @{
                Input = $file.FullName
                Output = $outputFile
            }
        }
    }
    
    return $results
}

# ========================================
# メイン処理
# ========================================

if ($All) {
    # スクリプトの親フォルダをベースパスとして使用
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $basePath = Split-Path -Parent $scriptDir
    
    Write-Host "全フォルダ処理モード" -ForegroundColor Magenta
    Write-Host "ベースパス: $basePath" -ForegroundColor Magenta
    Write-Host ("=" * 60)
    
    $results = Convert-AllFolders -BasePath $basePath
    
    Write-Host ""
    Write-Host ("=" * 60)
    Write-Host "処理完了: $($results.Count) ファイルを変換しました" -ForegroundColor Green
    
} elseif ($InputFile) {
    if (-not (Test-Path $InputFile)) {
        Write-Host "エラー: ファイルが見つかりません: $InputFile" -ForegroundColor Red
        exit 1
    }
    
    Convert-PayrollFile -InputPath $InputFile -OutputPath $OutputFile
    
} else {
    Write-Host @"
弥生給与NEXT → 弥生会計NEXT 仕訳データ変換スクリプト

使用方法:
    .\Convert-PayrollToAccounting.ps1 -InputFile <入力ファイル> [-OutputFile <出力ファイル>]
    .\Convert-PayrollToAccounting.ps1 -All  # YY-01～YY-12全フォルダを処理（YYは年度）

使用例:
    .\Convert-PayrollToAccounting.ps1 -InputFile ".\YY-01\仕訳データ（〇〇株式会社）_給与支給手続き YYYY_MM_DD 支払い分.txt"
    .\Convert-PayrollToAccounting.ps1 -All
"@
}
