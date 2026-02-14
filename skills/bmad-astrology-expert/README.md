# BMAD Astrology Expert

全能型紫微斗數 AI 助理技能包。

## 概述

這是一個單一的、自包含的 Skill，整合了完整的紫微斗數分析能力：

- **排盤計算**：使用 cubshuang/ZiWeiDouShu v5 引擎
- **結構分析**：命盤結構和星曜配置分析
- **規則建構**：命理規則驗證與格局識別
- **時間敘事**：大限流年分析與生活化解釋
- **觸機占卜**：三種觸機占卜方式
- **易經占卜**：64卦占卜與觸機易經整合

## 目錄結構

```
bmad-astrology-expert/
├── SKILL.md             # 主技能定義 (入口)
├── references/          # 專業知識手冊
│   ├── chart-calculator.md
│   ├── structure-analyst.md
│   ├── rule-constructor.md
│   ├── time-narrator.md
│   ├── trigger-analyst.md
│   └── iching-diviner.md
└── assets/              # 資源檔案
    ├── templates/       # 提示詞模板
    └── data/            # 數據資源
```

## 使用方式

將整個 `bmad-astrology-expert` 資料夾放入您的 Skills 目錄即可。Agent 會自動載入 `SKILL.md` 並根據需要查閱 `references/` 中的專業手冊。

## 授權

基於 BMAD Astrology Framework v2.8.0+

## 免責聲明

本技能提供的命理分析僅供參考，不構成專業建議。
