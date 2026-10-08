# Taiphoon Firmware Platform

React + TypeScript 的 Taiphoon 多硬體線上配置與雲端編譯平台。正式操作在 GitHub Pages，韌體只在 GitHub Actions 編譯，結果存於私人 Releases，不需要 WSL 或常駐編譯機。

硬體與硬體版本獨立選擇，新增 NariGPS／Herb Node 的 ArduPilot AP_Periph 配置；Morakot Ver2 保留待接入。接入方式、來源查核與尚待完成的部署／雲端驗收見 [hardware.md](docs/hardware.md)。

## 正式入口

- [Pages](https://rex-taiphoon.github.io/Taiphoon_Firmware_Pages/)
- [公開前端資產 repository](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Pages)：僅前端、品牌圖、部署 workflow。
- [私人平台 repository](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform)：API、受控模板、配置快照、Actions、Releases。
- API：`https://taiphoon-firmware-api.taiphoon-firmware-platform.workers.dev`，Cloudflare Workers。
- GitHub App：`taiphoon-firmware-platform`。帳號白名單模式由後端 App 代為操作私人平台 repo，使用者不需要 repo 寫入權限；授權與部署必要設定見 [account-authorization.md](docs/account-authorization.md)。

部署及雲端驗證結果見 [verification.md](docs/verification.md)。編譯通過不等同硬體刷寫／飛行驗收。

## 配置與編譯選項

| 平台 | 配置編輯器 | 編譯選項 |
| --- | --- | --- |
| ArduPilot | hwdef/Morakot 完整文字目錄：3 檔 | Copter／Plane／Rover／Sub、Lua；OSD 由配置決定 |
| PX4 | boards/morakot/v6 完整文字目錄：24 檔，含 init、src、NuttX、CMake、linker | 版本選擇、主韌體／Bootloader、DDS、Release／Debug、LTO；OSD 由配置決定 |
| Betaflight | configs/MORAKOT：config.h、config.c | GPS、蜂鳴器、Blackbox、遙測；OSD 由配置決定 |
| AM32 | 共用 Inc/targets.h 中的 Morakot 定義 | G071／L431 CAN、序列遙測；G071 已雲端驗收 |
| INAV | 官方 9.1.0 + Morakot 目錄：target.h、target.c、config.c、hardware_setup.c、CMakeLists.txt | Release／Debug；OSD 由配置決定，移植依據及限制見 [inav-morakot.md](docs/inav-morakot.md) |

來源固定完整 SHA，詳見 [targets.md](docs/targets.md)。此 ArduPilot 來源的 Copter／Plane／Rover 為 4.6.3，Sub 為 **4.6.0-dev**，檔名與 Release 依載具標記正確版本。Betaflight 使用附件配置及同版官方固定來源，原 ZIP 的完整 source SHA 尚未確認，不能宣稱二進位重現原 ZIP。

新版移除獨立 OSD 控制項，由配置檔決定。其餘功能選項會套用到配置；舊工作沿用原本選項语義。PX4 Release 使用 MinSizeRel，LTO 預設啟用，DDS 預設停用；Debug、停用最佳化或增加太多模組可能超過容量，流程會失敗而不發布。Betaflight 停用遙測也會停用依賴 SmartPort 的 FPort 接收協定。

路徑、Morakot MCU、board ID 受控。init 僅接受數值參數與指定驅動 start；禁止 shell 展開、管線、重導向或任意程式。hwdef 禁止 include／ROMFS／環境修改，config.h 禁止引用主機檔案。單檔最多 196608 字元，整份配置最多 192 KiB，提交 body 最多 256 KiB；不要保存密碼或金鑰。

## 使用

1. 在 Pages 使用 GitHub 登入，API 重新檢查帳號白名單資格，才讀取私人基礎配置。
2. 選韌體與版本，在可展開的 Morakot 目錄樹選取檔案並編輯，調整編譯參數；按「保存設定」取得不可變 request ID 與 config commit SHA。
3. 按「開始雲端編譯並發布」，查看排隊、驗證、編譯、發布、成功或失敗及 Actions 紀錄。
4. 成功後只有通過版本與雜湊核對的資產可下載。白名單使用者透過平台下載按鈕取得自己的韌體；GitHub 原生 Actions／Release 連結仍需 repo 存取權。

重新整理後需再次登入，以網址 request 或「找回已保存的工作」讀取。session 與私人配置不寫入 localStorage。修改設定須另存版本；已送出工作使用原快照。逾時不自動重送，會以 request ID 查回，避免重複工作。

新版 Release／檔名以原平台版本、Morakot、台灣日期與 Actions 工作流水號識別，例如 `ArduPilot-4.6.3-Morakot-20261003-82`；重跑加 `-r2`。描述簡潔列出相對該版本模板的修改，附 `changes.json`、`config.json` 與 `provenance.json`。舊快照／Release 保持原格式。版本切換、新增版本、固定流程 tag 及暫存配額詳見 [versions.md](docs/versions.md)。

## App 與 API

GitHub App 只需 Contents／Actions Read and write 與必要 Metadata read，不需要 Administration、Workflows、Pages 或組織權限。安裝時選 **Only select repositories**，只勾 `Taiphoon_Firmware_Platform`。

Callback：`https://taiphoon-firmware-api.taiphoon-firmware-platform.workers.dev/auth/callback`。Webhook 停用。App 設為 Public 以允許其他帳號授權登入；repository 維持私人。白名單模式只用 user access token 取得身分，後端用限定單一 repo 的 installation token 執行保存與編譯。App 私鑰存於 Workers secrets，installation token 不傳入前端。未設定白名單變數的舊部署仍使用 user token 與 repo 寫入資格。

`wrangler.jsonc` 存非秘密設定。`GITHUB_APP_CLIENT_SECRET` 與 32-byte 隨機 `SESSION_KEY` 只存 Cloudflare Workers secrets；本次建立時直接寫入秘密管理，未寫入 repo。OAuth state 綁定 HttpOnly／SameSite=Lax／Secure cookie；AES-GCM 加密平台 session 只在前端記憶體保存，最長一小時，每次操作重新檢查使用者資格。不要紀錄 bearer、Authorization、cookie、callback query、request body 或原始憑證錯誤。

維護者：

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec wrangler login --scopes account:read user:read workers_scripts:write
pnpm exec wrangler deploy
```

秘密透過供應商秘密管理或 `wrangler secret put` 標準輸入設定；不要放在命令參數、VITE_* 或聊天。正式 API 只接受 HTTPS、精確 Pages origin 與登入 session。託管入口應對登入／提交限流；免費方案有請求配額。編譯 job 沒有 App 秘密或 Release 寫入權限，獨立 publish job 驗證後才使用 Contents write。

API：GET `/auth/login`、`/auth/callback`、`/session`、`/templates/:target`、`/requests/:id`、`/requests/:id/status`；POST `/requests`、`/requests/:id/dispatch`。除了 OAuth，皆需 Pages origin 與 bearer session。使用者不可指定 shell、來源、branch 或 workflow。

## Pages 維護

私人 repository 的帳號方案不支援 Pages，故使用獨立公開 repo。`deployment/pages-workflow.yml` 只部署公開 repo 的 site 目錄。私人平台的前端建置 workflow 只執行測試、建置與公開資產審核，不上傳 `frontend-pages` artifact；公開 Pages 部署不依賴此 artifact。前端資產使用下列本地建置與匯出流程，沒有跨 repo 寫入 token 或私人 Pages 部署。

開發者可建置前端：

```sh
pnpm test
pnpm build
node scripts/export-pages.mjs
```

環境需 `VITE_API_URL` 與 `PAGES_BASE_PATH=/Taiphoon_Firmware_Pages/`。PowerShell 使用 `$env:變數名='值'`。匯出只接受 dist 內 allowlist 前端資產，輸出 `.research/pages-repository/site`；不匯出 API、templates、設定或韌體。維護者將資產提交到公開 repo 的 main，由 Pages Actions 部署。第一版不把跨 repo 憑證放入韌體編譯工作。

`pnpm dev`／`pnpm api:dev` 僅供開發測試，正式使用都在 Pages。開發示範下載 demo-settings.json 不是韌體，正式 bundle 不提供示範。

## 排查

| 問題 | 檢查 |
| --- | --- |
| 登入失敗 | App 安裝範圍、callback、repo 寫入資格、彈出視窗、Workers secrets |
| 配置被拒 | 受控路徑、MCU／board ID、init 規則、欄位與提交大小 |
| 403／限流 | App 權限、使用者資格、GitHub API 配額 |
| 確認送出結果 | 保持 request ID，查 Actions；不要盲目重送 |
| 編譯失敗 | 查看該次 build 紀錄，檢查配置、固定工具鏈與 Flash 容量 |
| PX4 v0.0.0 | 固定上游 tag／ancestry 未取得；流程阻止發布 |
| 發布失敗 | 查 publish；版本、雜湊、大小、資產不符即拒絕，保留 draft |
| 私人下載 404 | 瀏覽器 GitHub 登入與 repository 存取資格 |
| 重跑 | 使用 Re-run all jobs；只重跑失敗 job 可能缺少該 attempt cache |

韌體 workflows 只手動觸發，publish_release 預設 false；新版只編譯模式不發布 Release／cache，可查看 Actions 紀錄。正常 Pages 按鈕明確傳 true。正式韌體保存在私人 Release，跨 job 使用綁定同次 run／attempt／SHA 的 cache 暫存，不使用 Actions artifact 保存韌體。Release 保留至人類管理，不自動刪除。公開 repo 的設定／紀錄／Release 可能公開；本次私人平台不因 Pages 部署而改變可見性。

目錄：src 前端、shared schema／目標、server API、templates 板级配置、scripts 編譯／發布封裝、tests 關鍵流程。品牌標誌沿用 Taiphoon；介面採簡潔白灰與系統字體，移除 Morakot 示意圖。

## 目錄編輯限制

登入後才讀取完整私人文字配置。保存會把所有檔案一併存入不可變快照；編譯使用這份快照，不能只在網頁預覽修改。舊工作缺少新加入的檔案時，編輯器補上基礎配置並提示另存新版本，原工作仍使用原快照。

PX4 的 bootloader 檔案也可編輯、保存；目前 workflow 編譯的是 default 主韌體，不會重新編譯或發布 bootloader。附件的二進位產物、macOS metadata 與 ZIP 不屬於文字配置，不放進編輯器。

每份配置 JSON 上限為 192 KiB，HTTP 提交上限為 256 KiB。C／C++ 只可引用這個平台既有的 header，不允許主機檔案、任意 pragma 或組合語言嵌入。CMake 允許既有 board 的來源清單、依賴與數值定義；禁止 execute_process、自訂執行命令或工具鏈替換。Kconfig／linker 保留 MCU、建置路徑、board ID 與刷寫容量，不能藉編輯提升容量上限。

Betaflight 停用 Blackbox 也移除依賴它的 USB MSC；停用遙測也移除 FPort、Jeti EX Bus、MAVLink 接收與 CRSF v3 遙測功能，基本 CRSF 接收保留。


## 可選的原平台版本

| 平台 | 可選版本 |
| --- | --- |
| PX4 | 1.18.0-rc1、1.18.0-beta2、1.18.0-beta1、1.17.0 |
| ArduPilot | 4.7.1、4.7.0、4.6.3 |
| Betaflight | 2026.6.2、2026.6.1；另保留 2026.12.0-alpha 固定開發來源 |
| AM32 | 2.21、2.20 |

預設選近期正式版，RC／Beta 可自行切換。版本名稱遵循原平台，Morakot 是硬體目標；內部配置 ID／模板修訂用於追溯，不顯示成韌體版本。Actions 取得選定官方 tag 的固定來源 SHA，再加入該版 Morakot 板級定義。PX4 新 beta 工作使用官方 tag；原 fork 的後續變更僅保留於歷史工作。

ArduPilot 4.6.3 支援 Copter／Plane／Rover；該來源的 Sub 實際為開發版，所以此選項不提供 Sub，請改選 4.7.0／4.7.1。

PX4 各版本可選主韌體或 Bootloader。主韌體输出 .px4；Bootloader 輸出 .bin／.elf，透過 SWD／DFU，Flash 位址 0x08000000，保留容量 128 KiB，主韌體起點 0x08020000。Bootloader 不套用 DDS／主韌體 LTO；其堆疊大小及 linker 對齊已修正並由產物檢查核對。正式操作與編譯均由 GitHub 託管，使用者本地只需瀏覽器。

既有五個 Release 已修正顯示名稱，原 tag 與資產保留以維持追溯與下載；新工作 tag、顯示名稱及檔名都以「平台-版本」開頭。完整版本維護及歷史相容見 [versions.md](docs/versions.md)。
