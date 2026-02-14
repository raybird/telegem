# TeleNexus 流程圖（舊版 vs 新版）

```mermaid
flowchart TD
  U[Telegram User Message] --> R{CommandRouter}

  subgraph OLD[Old v2.3.1]
    R --> O1[General message]
    O1 --> O2[Hardcoded prompt in main.ts]
    O2 --> O3[Inject recent 15 messages]
    O3 --> O4[DynamicAgent]
    O4 --> O5{Runner canary}
    O5 --> O6[POST run API]
    O5 --> O7[Local CLI]
    O6 --> O8[Gemini or Opencode]
    O7 --> O8
    R --> O9[Compress-like command may be blocked or wrapped]
  end

  subgraph NEW[New v2.3.6]
    R --> N0[Built-in commands]
    R --> N1[Passthrough commands direct]
    R --> N2[General message]
    N2 --> N3[Load chat_prompt from ai-config]
    N3 --> N4[Build prompt]
    N4 --> N5[DynamicAgent]
    N1 --> N5
    N5 --> N6{Force new session}
    N6 --> N7[Gemini without -r or Opencode without -c]
    N6 --> N8[Gemini with -r or Opencode with -c]
    N5 --> N9{Runner prefer}
    N9 --> N10[POST run with passthrough and forceNewSession flags]
    N9 --> N11[Local CLI]
    N10 --> N12[Runner executeTask]
    N12 --> N13[Gemini or Opencode]
    N11 --> N13
    N13 --> N14[Response and audit status]
    N14 --> U
  end
```

## 重點差異

- 舊版：一般對話會手動注入最近 15 則歷史。
- 新版：移除 15 則注入，改以 CLI session (`-r` / `-c`) 為主。
- 新版：`passthrough_commands` 直通 CLI，不包 TeleNexus 一般 prompt。
- 新版：新增 `/new`，可對「下一則一般對話訊息」強制開新 session。
- 新版：`chat_prompt` 可由 `ai-config.yaml` 外部化配置。
