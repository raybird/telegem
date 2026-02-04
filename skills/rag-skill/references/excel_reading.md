# Excel 檔案讀取

> ⚠️ **使用本文件前請注意**：本文件應在實際處理 Excel 檔案之前閱讀，以瞭解正確的 pandas 讀取方法。請配合 excel_analysis.md 一起使用。

使用 pandas 讀取 Excel 檔案的核心方法。

## 快速入門

**最常用的讀取方式**：
```python
import pandas as pd

# 讀取第一個工作表（或指定工作表）
df = pd.read_excel("data.xlsx", sheet_name="Sheet1")

# 只讀取前幾列查看結構
df_preview = pd.read_excel("data.xlsx", nrows=10)

# 只讀取需要的欄位（提高性能）
df = pd.read_excel("data.xlsx", usecols=["欄位1", "欄位2", "欄位3"])
```

## 讀取單個工作表

```python
import pandas as pd

# 讀取指定工作表
df = pd.read_excel("data.xlsx", sheet_name="Sheet1")

# 查看前幾列
print(df.head())

# 基本統計資訊
print(df.describe())
```

## 讀取整個活頁簿的所有工作表

```python
import pandas as pd

# 讀取所有工作表
excel_file = pd.ExcelFile("workbook.xlsx")

for sheet_name in excel_file.sheet_names:
    df = pd.read_excel(excel_file, sheet_name=sheet_name)
    print(f"\n{sheet_name}:")
    print(df.head())
```

## 讀取特定欄位

```python
import pandas as pd

# 只讀取指定欄位（提高性能）
df = pd.read_excel("data.xlsx", usecols=["column1", "column2", "column3"])
```

## 性能優化選項

- 使用 `usecols` 只讀取需要的欄位
- 使用 `dtype` 參數指定欄位類型以加快讀取速度
- 根據檔案類型選擇合適的引擎：`engine='openpyxl'` 或 `engine='xlrd'`

## 處理大檔案

對於非常大的 Excel 檔案，避免一次性讀取整個檔案：
- 使用 `nrows` 參數限制讀取的列數
- 先讀取前若干列瞭解數據結構
- 按需分批处理数据