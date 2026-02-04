# RAG Skill (本地知識庫檢索助手)

這是一個專為 AI Agent 設計的高效能本地文件檢索模組。它模擬資深工程師的查閱行為，透過「分層索引」、「先學後做」與「迭代檢索」三大機制，在無需依賴外部向量資料庫的情況下，精準地從龐大的本地檔案中提取資訊。

## 核心哲學

1.  **分層索引導航 (Hierarchical Indexing)**：
    不盲目搜尋所有檔案。優先讀取目錄下的 `data_structure.md` 索引檔，像查閱圖書館分類卡一樣，快速定位相關的子目錄或檔案。

2.  **先學後做 (Just-in-Time Learning)**：
    在處理特殊格式（如 PDF、Excel）前，強制 AI 先閱讀 `references/` 下的操作手冊。確保使用正確的工具（如 `pdftotext`, `pandas`）與最佳實踐，避免無效讀取或 token 浪費。

3.  **迭代檢索 (Iterative Retrieval)**：
    內建多輪檢索機制。若初次搜尋結果不足，會自動修正關鍵字或擴大範圍進行下一輪檢索，直到獲得完整答案。

## 檔案結構

```text
skills/rag-skill/
├── README.md                 # 本說明文件
├── SKILL.md                  # [核心大腦] 定義檢索邏輯、流程與策略
├── references/               # [技能手冊] 各類檔案處理的最佳實踐指南
│   ├── excel_analysis.md     # Excel 數據分析指南 (Pandas)
│   ├── excel_reading.md      # Excel 高效讀取指南
│   └── pdf_reading.md        # PDF 文字與表格提取指南
└── scripts/                  # [工具箱] 輔助腳本
    └── convert_pdf_to_images.py  # PDF 轉圖片工具
```

## 功能特點

- **支援多種格式**：針對 Markdown, Text, PDF, Excel 均有專門的最佳化讀取策略。
- **節省 Token**：對於大型檔案（如幾萬列的 Excel），採用局部讀取 (`pd.read_excel(nrows=...)`) 策略，而非一次性載入。
- **精確溯源**：回答問題時會明確指出引用檔案的名稱與具體位置（頁碼/列數）。

## 如何運作

當使用者提出問題（例如：「查一下去年 Q4 的財報數據」）：
1. **理解**：Agent 分析關鍵字與時間範圍。
2. **定位**：透過閱讀目錄索引，鎖定目標資料夾。
3. **學習**：如果是 Excel 檔，先複習 `excel_reading.md`。
4. **執行**：撰寫 Python 代碼或使用 grep 精確提取數據。
5. **回答**：綜合檢索結果回答問題。
