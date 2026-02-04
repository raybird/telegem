# PDF 讀取與分析

> ⚠️ **使用本文件前請注意**：本文件應在實際處理 PDF 檔案之前完整閱讀，以選擇最合適的工具和方法。不要在未閱讀本文件的情況下盲目嘗試處理 PDF。

用於從 PDF 檔案中提取文字、表格和元數據的方法。

## 快速決策表

| 場景 | 推薦工具 | 原因 | 命令/代碼示例 |
|------|----------|------|--------------|
| 純文字提取（最常見） | pdftotext 命令 | 最快最簡單 | `pdftotext input.pdf output.txt` |
| 需要保留佈局 | pdftotext -layout | 保持原始排版 | `pdftotext -layout input.pdf output.txt` |
| 需要提取表格 | pdfplumber | 表格識別能力強 | `page.extract_tables()` |
| 需要元數據 | pypdf | 輕量級 | `reader.metadata` |
| 掃描 PDF（圖片） | OCR (pytesseract) | 無其他選擇 | 先轉圖片再 OCR |

## 文字提取優先級

**推薦優先級（從高到低）**：
1. **pdftotext 命令行工具**（最快，適合大多數 PDF）
2. pdfplumber（適合需要保留佈局或提取表格）
3. pypdf（輕量級，適合簡單提取）
4. OCR（僅用於掃描 PDF 或無法直接提取文字的情況）

## 快速開始：使用 pdftotext（推薦）

> ⚠️ **重要**：必須將輸出保存到檔案，不要直接輸出到終端機（stdout），否則會佔用大量 token！

```bash
# ✅ 正確：提取文字到檔案（最快最簡單）
pdftotext input.pdf output.txt

# ✅ 正確：保留佈局並輸出到檔案
pdftotext -layout input.pdf output.txt

# ✅ 正確：提取特定頁面到檔案
pdftotext -f 1 -l 5 input.pdf output.txt  # 第1-5页

# ❌ 錯誤：不要使用 stdout（會佔用大量 token）
# pdftotext input.pdf -
```

**使用流程**：
1. 使用 pdftotext 提取文字到臨時檔案
2. 使用 grep 或 Read 工具對生成的文字檔案進行檢索
3. 只讀取匹配部分的上下文，而非全文

如果需要在 Python 中處理：

```python
from pypdf import PdfReader

# 讀取 PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# 提取文本
text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Python 函式庫

### pypdf - 基本文字提取

```python
from pypdf import PdfReader

reader = PdfReader("document.pdf")

# 提取全部文字
for page in reader.pages:
    text = page.extract_text()
    print(text)

# 提取元數據
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```

### pdfplumber - 帶佈局的文字和表格提取

#### 提取文字（保留佈局）

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### 提取表格

```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```

#### 進階表格提取（轉為 DataFrame）

```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # 檢查表格非空
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# 合併所有表格
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

#### 帶座標的精確文字提取

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    page = pdf.pages[0]
    
    # 提取所有字元及其座標
    chars = page.chars
    for char in chars[:10]:  # 前 10 個字元
        print(f"Char: '{char['text']}' at x:{char['x0']:.1f} y:{char['y0']:.1f}")
    
    # 按邊界框提取文字 (left, top, right, bottom)
    bbox_text = page.within_bbox((100, 100, 400, 200)).extract_text()
```

#### 複雜表格的進階設定

```python
import pdfplumber

with pdfplumber.open("complex_table.pdf") as pdf:
    page = pdf.pages[0]
    
    # 自訂表格提取設定
    table_settings = {
        "vertical_strategy": "lines",
        "horizontal_strategy": "lines",
        "snap_tolerance": 3,
        "intersection_tolerance": 15
    }
    tables = page.extract_tables(table_settings)
    
    # 視覺化除錯
    img = page.to_image(resolution=150)
    img.save("debug_layout.png")
```

### pypdfium2 - 快速渲染和文字提取

```python
import pypdfium2 as pdfium

# 載入 PDF
pdf = pdfium.PdfDocument("document.pdf")

# 提取文本
for i, page in enumerate(pdf):
    text = page.get_text()
    print(f"Page {i+1} text length: {len(text)} chars")
```

#### 將 PDF 頁面渲染為圖片

```python
import pypdfium2 as pdfium
from PIL import Image

pdf = pdfium.PdfDocument("document.pdf")

# 渲染單頁
page = pdf[0]  # 第一页
bitmap = page.render(
    scale=2.0,  # 高分辨率
    rotation=0  # 不旋转
)

# 转换为 PIL Image
img = bitmap.to_pil()
img.save("page_1.png", "PNG")

# 處理多頁
for i, page in enumerate(pdf):
    bitmap = page.render(scale=1.5)
    img = bitmap.to_pil()
    img.save(f"page_{i+1}.jpg", "JPEG", quality=90)
```

## 命令行工具

### pdftotext (poppler-utils)

> ⚠️ **性能優化**：始終輸出到檔案，避免佔用 token

```bash
# ✅ 提取文字到檔案
pdftotext input.pdf output.txt

# ✅ 保留佈局提取到檔案
pdftotext -layout input.pdf output.txt

# ✅ 提取特定頁面到檔案
pdftotext -f 1 -l 5 input.pdf output.txt  # 第1-5页

# ✅ 提取帶座標的文字到 XML 檔案（用於結構化數據）
pdftotext -bbox-layout document.pdf output.xml

# ❌ 避免：不要省略輸出檔名（會輸出到 stdout）
# pdftotext input.pdf
```

### 進階圖片轉換 (pdftoppm)

```bash
# 轉換為 PNG，指定解析度
pdftoppm -png -r 300 document.pdf output_prefix

# 轉換特定頁面範圍，高解析度
pdftoppm -png -r 600 -f 1 -l 3 document.pdf high_res_pages

# 轉換為 JPEG，指定品質
pdftoppm -jpeg -jpegopt quality=85 -r 200 document.pdf jpeg_output
```

### 提取嵌入圖片 (pdfimages)

```bash
# 提取所有圖片
pdfimages -j input.pdf output_prefix

# 列出圖片資訊（不提取）
pdfimages -list document.pdf

# 以原始格式提取
pdfimages -all document.pdf images/img
```

## OCR 提取（掃描 PDF）

```python
# 需要: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# PDF 轉圖片
images = convert_from_path('scanned.pdf')

# OCR 每一頁
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

## 處理加密 PDF

```python
from pypdf import PdfReader

try:
    reader = PdfReader("encrypted.pdf")
    if reader.is_encrypted:
        reader.decrypt("password")
    
    # 解密後可正常提取文字
    for page in reader.pages:
        text = page.extract_text()
        print(text)
except Exception as e:
    print(f"Failed to decrypt: {e}")
```

```bash
# 使用 qpdf 解密（需要知道密碼）
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf

# 檢查加密狀態
qpdf --show-encryption encrypted.pdf
```

## 批量處理

```python
import os
import glob
from pypdf import PdfReader
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def batch_extract_text(input_dir):
    """批量提取文字"""
    pdf_files = glob.glob(os.path.join(input_dir, "*.pdf"))
    
    for pdf_file in pdf_files:
        try:
            reader = PdfReader(pdf_file)
            text = ""
            for page in reader.pages:
                text += page.extract_text()
            
            output_file = pdf_file.replace('.pdf', '.txt')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text)
            logger.info(f"Extracted text from: {pdf_file}")
            
        except Exception as e:
            logger.error(f"Failed to extract text from {pdf_file}: {e}")
            continue
```

## 性能優化

1. **檔案輸出優先**：始終將 pdftotext 輸出保存到檔案，然後用 grep/Read 檢索，避免直接輸出到終端機佔用大量 token
2. **大型 PDF**：使用流式方式逐頁處理，避免一次性載入整個檔案
3. **文字提取**：`pdftotext` 最快；pdfplumber 適合結構化數據和表格
4. **圖片提取**：`pdfimages` 比渲染頁面快得多
5. **記憶體管理**：逐頁或分塊處理大檔案

## 快速參考

| 任務 | 最佳工具 | 命令/代碼 |
|------|----------|-----------|
| 提取文字 | pdfplumber | `page.extract_text()` |
| 提取表格 | pdfplumber | `page.extract_tables()` |
| 命令行提取 | pdftotext | `pdftotext -layout input.pdf` |
| OCR 掃描 PDF | pytesseract | 先轉圖片再 OCR |
| 提取元數據 | pypdf | `reader.metadata` |
| PDF 轉圖片 | pypdfium2 | `page.render()` |

## 可用套件

- **pypdf** - 基本操作（BSD 授權）
- **pdfplumber** - 文字和表格提取（MIT 授權）
- **pypdfium2** - 快速渲染和提取（Apache/BSD 授權）
- **pytesseract** - OCR（Apache 授權）
- **pdf2image** - PDF 轉圖片
- **poppler-utils** - 命令行工具（GPL-2 许可）