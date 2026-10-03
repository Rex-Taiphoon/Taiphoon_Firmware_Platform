# Taiphoon Firmware Platform

React + TypeScript 的 Morakot 線上配置與雲端編譯平台。正式操作在 GitHub Pages，韌體只在 GitHub Actions 編譯，結果存於私人 Releases，不需要 WSL 或常駐編譯機。

## 正式入口

- [Pages](https://rex-taiphoon.github.io/Taiphoon_Firmware_Pages/)
- [公開前端資產 repository](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Pages)：僅前端、品牌圖、部署 workflow。
- [私人平台 repository](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform)：API、受控模板、配置快照、Actions、Releases。
- API：`https://taiphoon-firmware-api.taiphoon-firmware-platform.workers.dev`，Cloudflare Workers。
- GitHub App：`taiphoon-firmware-platform`。已建立；使用前須確認只安裝到私人平台 repo，使用者也須有該 repo 寫入權限。

部署及雲端驗證結果見 [verification.md](docs/verification.md)。編譯通過不等同硬體刷寫／飛行驗收。

## 配置與編譯選項

| 平台 | 配置編輯器 | 編譯選項 |
| --- | --- | --- |
| ArduPilot | hwdef.dat、hwdef-bl.dat、defaults.parm | Copter／Plane／Rover／Sub、OSD、Lua、OSD_TYPE2 |
| PX4 | default.px4board、init/rc.board_defaults、init/rc.board_sensors | DDS、ATXXXX OSD、Release／Debug、LTO |
| Betaflight | config.h | GPS、蜂鳴器、OSD、Blackbox、遙測 |
| AM32 | 暫不自由編輯檔案 | G071／L431 CAN、序列遙測；adapter 尚待雲端驗收 |
| INAV | 等待 Morakot 定義 | 禁止提交 |

來源固定完整 SHA，詳見 [targets.md](docs/targets.md)。此 ArduPilot 來源的 Copter／Plane／Rover 為 4.6.3，Sub 為 **4.6.0-dev**，檔名與 Release 依載具標記正確版本。Betaflight 使用附件配置及同版官方固定來源，原 ZIP 的完整 source SHA 尚未確認，不能宣稱二進位重現原 ZIP。

功能選項優先於檔案中對應定義。關閉 OSD 會移除程式／驅動，不只是改預設參數。PX4 Release 使用 MinSizeRel，LTO 預設啟用，DDS 預設停用；Debug、停用最佳化或增加太多模組可能超過容量，流程會失敗而不發布。Betaflight 停用遙測也會停用依賴 SmartPort 的 FPort 接收協定。

路徑、Morakot MCU、board ID 受控。init 僅接受數值參數與指定驅動 start；禁止 shell 展開、管線、重導向或任意程式。hwdef 禁止 include／ROMFS／環境修改，config.h 禁止引用主機檔案。單檔最多 32768 字元，提交 body 最多 128 KiB；不要保存密碼或金鑰。

## 使用

1. 在 Pages 使用 GitHub 登入，API 重新檢查 repository 寫入資格，才讀取私人基礎配置。
2. 選韌體，修改編譯參數與配置；按「保存設定」取得不可變 request ID 與 config commit SHA。
3. 按「開始雲端編譯並發布」，查看排隊、驗證、編譯、發布、成功或失敗及 Actions 紀錄。
4. 成功後只有通過版本與雜湊核對的資產可下載。私人 Release 需要在瀏覽器登入有存取權的 GitHub 帳號。

重新整理後需再次登入，以網址 request 或「找回已保存的工作」讀取。session 與私人配置不寫入 localStorage。修改設定須另存版本；已送出工作使用原快照。逾時不自動重送，會以 request ID 查回，避免重複工作。

Release tag／檔名：`平台-載具或板名-版本-YYYYMMDD-runID-attempt`。日期取保存設定時的 UTC 日，實際建置時間在 Actions／Release。`config.json` 是原快照；`provenance.json` 包含 source／config／workflow SHA、版本、run／attempt、實際 compiler、容器 digest、資產大小與 SHA-256。不同工作與重試不覆寫先前 Release。

## App 與 API

GitHub App 只需 Contents／Actions Read and write 與必要 Metadata read，不需要 Administration、Workflows、Pages 或組織權限。安裝時選 **Only select repositories**，只勾 `Taiphoon_Firmware_Platform`。

Callback：`https://taiphoon-firmware-api.taiphoon-firmware-platform.workers.dev/auth/callback`。Webhook 停用。API 使用 GitHub App 的 user access token，權限同時受 App 安裝範圍與使用者權限限制，不需要保存 App 私鑰或 installation token。

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

私人 repository 的帳號方案不支援 Pages，故使用獨立公開 repo。`deployment/pages-workflow.yml` 只部署公開 repo 的 site 目錄。私人平台的前端建置 workflow 產生可匯出 artifact，沒有跨 repo 寫入 token 或私人 Pages 部署。

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
| 重跑 | 使用 Re-run all jobs；只重跑失敗 job 可能缺少該 attempt artifact |

韌體 workflows 只手動觸發，publish_release 預設 false；只編譯驗證時下載一天保留的 Actions artifact。正常 Pages 按鈕明確傳 true。Release 保留至人類管理，不自動刪除。公開 repo 的設定／紀錄／Release 可能公開；本次私人平台不因 Pages 部署而改變可見性。

目錄：src 前端、shared schema／目標、server API、templates 板级配置、scripts 編譯／發布封裝、tests 關鍵流程。介面與品牌圖參考 [Taiphoon 官網](https://taiphoon.com.tw/)。
