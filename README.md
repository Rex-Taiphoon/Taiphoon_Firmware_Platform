# Taiphoon Firmware Platform

React + TypeScript 的 MORAKOT 線上設定與雲端編譯平台。GitHub Pages 提供介面，GitHub App + 無伺服器 API 保存設定並觸發固定 Actions，GitHub Releases 保存結果。無須本地 WSL 或常駐編譯機。

目前已完成本機平台、API 與雲端流程範本，**尚未部署，也未執行真實韌體編譯或建立 Release**。使用者已同意先進行 GitHub Actions 編譯驗證；目前平台 repository 仍無法存取。四個 adapter 已依你的 repository 定義實作，尚未完成雲端驗收；INAV 等待 MORAKOT 定義。不能把本機示範下載當成韌體。

## 已接入的目標

| 韌體 | 已核對來源 | 可修改設定 | 狀態 |
| --- | --- | --- | --- |
| ArduPilot | `Rex-Taiphoon/ardupilot` master，Morakot hwdef | Copter / Plane / Rover、第二組 OSD 預設值 | adapter 已實作，未雲端驗收 |
| PX4 | `Rex-Taiphoon/PX4-Autopilot` dev-morakot | uXRCE-DDS 與 MSP OSD 模組 | adapter 已實作，未雲端驗收 |
| Betaflight | `Rex-Taiphoon/betaflight` master + `Rex-Taiphoon/config` MORAKOT | GPS、蜂鳴器 | adapter 已實作，未雲端驗收 |
| AM32 | `Rex-Taiphoon/AM32` Morakot_4in1_ESC-dev | G071 / L431 CAN 硬體版本、序列遙測 | adapter 已實作，未雲端驗收 |
| INAV | 尚未提供 | 暫無 | 顯示待接入，禁止保存／編譯 |

原始碼及外部硬體定義固定在 `shared/catalog.ts` 的完整 SHA，不自動跟隨分支最新版。來源及工具鏈依據見 [targets.md](docs/targets.md)。

## 本機啟動

需要 Node.js 24.19.0 以上與 pnpm 11.19.0。使用 PowerShell、macOS 或 Linux shell 均可，不需要 WSL。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

開啟終端顯示的本機網址。未設定 API 時，開發環境預設使用「本機流程示範」：修改設定 → 保存 → 模擬排隊、編譯、發布 → 下載設定記錄。它完全不呼叫 GitHub，下載名稱為 `demo-settings.json`，不是可刷寫韌體。正式打包不提供此模式。

## GitHub App 與使用者授權

平台 API 只接受具有平台 repository 寫入權限的 GitHub 使用者。每次請求重新檢查資格，App 安裝本身不等於使用者授權。第一版不是公開訪客共用的編譯服務。

1. 確認 `Rex-Taiphoon/Taiphoon_Firmware_Platform` repository 已建立、存在預設分支，並將本專案程式與 workflow 放入該分支。此步驟不會自行觸發本專案的 workflows，因為它們僅使用 `workflow_dispatch`。不應在未確認前執行部署或韌體 workflow。
2. 建立 GitHub App，將 callback URL 設為 `https://你的API/auth/callback`。使用 GitHub App 的使用者 OAuth 授權流程；使用者由頁面登入按鈕授權。
3. Repository permissions 僅需 **Contents: Read and write**、**Actions: Read and write**；Metadata 為 GitHub 必要權限。不需要 Administration、Workflows、Pages 或組織管理權限。
4. 只安裝於平台 repository。來源韌體目前是公開 repository，runner 依固定 SHA checkout；API 不需要取得原始碼 repository 的寫入權限。若日後來源改為私人 repository，須另設唯讀存取，不能直接擴大編譯 job 的發布權限。
5. 產生 App 私鑰，將 App ID、Client ID、Client secret、Installation ID 及私鑰放入 API 託管服務的秘密管理。GitHub 的 Contents write 並非只限某一路徑；API 的路徑限制、使用者權限檢查與固定 workflow 是必要的控制。
6. 另產生 32-byte 隨機 SESSION_KEY，放入 API 秘密管理：

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

登入使用 OAuth state + HttpOnly、SameSite=Lax cookie 綁定登入視窗，完成後將加密平台 session 以指定來源的 `postMessage` 交還前端。前端不取得 GitHub token 或私鑰，session 只留在記憶體，最長一小時。session 仍具有操作 API 的權力，不得紀錄或保存；登出清除本機 session，期限到期後服務拒絕操作。第一版沒有 server-side session 撤銷清單；若需要立即撤銷，撤銷 App 使用者授權或輪替 SESSION_KEY。

重新整理後需再次登入，再以網址中的 request ID 或「找回已保存的工作」讀取工作。request ID 不含秘密，可以保存；示範記錄則會在重新整理時清除。

## 無伺服器 API

尚未選定 API 託管供應商。提供可打包的 **Node.js Web Request/Response handler**，供支援 Node.js 24 的無伺服器服務接入；不預設部署到任何帳號，也沒有常駐編譯服務。

```sh
pnpm api:build
```

輸出 `dist-api/handler.js`，匯出 `createHandler(environment, fetchImplementation?)` 與 default `handle(request, environment?)`。託管端將 HTTP 請求轉成標準 `Request`，把回傳 `Response` 轉回供應商的 HTTP 回應。若供應商原生使用 Web Request/Response，可以直接呼叫；若使用 Lambda event 等格式，需要供應商 adapter。它不是 Cloudflare Workers edge 專用 bundle，包含 Node crypto。

所有路徑放在 API 網域根目錄：

| 方法與路徑 | 用途 |
| --- | --- |
| GET `/auth/login` | 開啟 GitHub 授權，設定登入 state cookie |
| GET `/auth/callback` | 完成授權，登入視窗將 session 交還 Pages |
| GET `/session` | 檢查 session、使用者與 repository 資格 |
| POST `/requests` | 保存新的不可變設定快照 |
| GET `/requests/:id` | 讀取自己的快照與設定 commit SHA |
| POST `/requests/:id/dispatch` | 以版本與 request ID 觸發固定 workflow |
| GET `/requests/:id/status` | 查詢 run、job、對應 Release 與版本驗證後的下載 |

除了 OAuth 路徑，所有 API 均檢查精確 Pages Origin 與 bearer session。提交只有受控設定欄位，不能指定 shell、repository、branch 或 workflow。請在託管入口設定請求大小限制（8 KiB）與登入／提交限流；應停用 request header、body、query string 的自動紀錄，尤其 callback query 含 OAuth code。應用程式不輸出 GitHub 原始錯誤、秘密或授權 header。

將 `.env.server.example` 的值放入託管環境。`PAGES_ORIGIN` 只有 origin，例如 `https://rex-taiphoon.github.io`，**不包含 repository 子路徑**；`API_ORIGIN` 也必須是 origin。兩者正式環境必須使用 HTTPS。工作流程文件預設 `firmware.yml`，設定與 workflow 分支預設 `main`；如 repository 預設分支不同，須調整伺服器環境。

本機 API 可複製成 `.env.server.local` 後執行 `pnpm api:dev`。API 與 Pages 的主機名稱應一致使用 `127.0.0.1` 或 `localhost`，並在 GitHub App 配置相應 callback。**連接真實 API 後按編譯按鈕會真的觸發 Actions 與 Release，須先確認。**

## GitHub Pages 設定與使用

在取得部署確認後，由人類完成：

1. Repository Settings → Pages → Source 選 GitHub Actions。
2. 建立 Actions repository variable `PLATFORM_API_URL`，值為 API 的 HTTPS origin（公開資訊，不能放 token）。
3. 確認 `pages.yml` 的 `PAGES_BASE_PATH` 與 repository Pages 路徑一致；預設 `/Taiphoon_Firmware_Platform/`。
4. 手動執行 `Publish Pages manually`，勾選 confirmed。只上傳 `dist/`，不會上傳 `server/`、`dist-api/`、設定快照或韌體產物。
5. 進入 Pages，登入 GitHub，選韌體並修改設定。按「保存設定」取得不可變版本，再按「開始雲端編譯並發布」。每個 request 對應一份設定、原始碼 SHA 與 Actions 工作。
6. 工作完成後，版本資訊及資產檢查一致才會顯示下載。Release 內有 `config.json`、`provenance.json` 與韌體檔；manifest 包含外部定義 SHA、實際 compiler 版本及各產物 SHA-256。

## 排查失敗

### 只編譯驗證（不建立 Release）

取得平台 repository 存取權並上傳 workflow 後，先保存一份 ArduPilot / Morakot Copter 的不可變 request 設定。由 Actions 手動執行 `Firmware build`，填入該 request UUID 與保存設定的完整 commit SHA，**保持 `publish_release` 不勾選**。此選項預設為 false；publish job 會跳過，發布腳本也另行檢查確認值。

成功時至該 Actions 工作下載 `firmware-<run ID>-<attempt>` artifact，內含韌體、`config.json` 與 `provenance.json`。核對設定、原始碼與 workflow SHA、run ID、attempt 及韌體 SHA-256；artifact 保留一天。這種測試不會建立 Release，因此不會出現在平台的 Release 下載列表。須另外確認發布後，才測試完整下載流程。正常網頁的「開始雲端編譯並發布」會由 API 明確傳入 `publish_release: "true"`。

編譯驗證只證明雲端建置與版本追蹤，不等同硬體刷寫及飛行驗收。沒有 Actions 工作 URL 與成功紀錄前，不應宣稱韌體已編譯通過。

| 狀況 | 處理方式 |
| --- | --- |
| 無法登入／無寫入權限 | 檢查 App 安裝、callback、使用者 repository 寫入資格、API Origin；檢查彈出視窗是否被阻擋 |
| 找不到 workflow 或 repository | 確認 repo 已存在、預設分支已有 `firmware.yml`、API 的固定分支與檔名正確 |
| API 回傳 403／限流 | 檢查 App 權限與 GitHub API rate limit；服務不會洩漏原始憑證內容 |
| 保存失敗或逾時 | 保持相同設定再按保存，前端沿用該次 request ID；改設定會產生新 ID |
| 「確認送出結果」 | 先查 Actions；API 不會盲目重送，會以 request ID 找回工作。未辨識的工作不開放下載 |
| 編譯失敗 | 開啟該次 Actions 紀錄；檢查 adapter、工具鏈安裝與硬體定義，不要使用另一筆工作的結果 |
| Release 發布失敗 | 檢查 publish job 的 Contents write 與資產驗證；保留 draft 供排查，不自動刪除 |
| 版本不符或缺少資產 | 頁面拒絕下載；比對 manifest、request commit、run ID 與 run attempt |
| 重新執行工作 | 目前使用 **Re-run all jobs**；只重跑失敗 job 可能缺少這個 attempt 的暫存 artifact，會安全失敗。每個 attempt 使用不同 Release tag，不覆蓋先前結果 |
| 設定有修改 | 再保存新版本；已提交工作永遠使用原快照。編譯失敗需另存新工作再提交，不能自動重複同一 dispatch |

公開 repository 的設定、紀錄與 Release 可能公開，表單已提示不要保存秘密。暫存 Actions artifacts 保留一天；Release 結果保留至人類管理，不提供自動刪除或歷史清理功能。

## 驗收界線與下一步

本機測試涵蓋設定驗證、固定 adapter 命令、權限、OAuth state、憑證錯誤遮蔽、保存／dispatch 冪等、逾時查回、工作狀態與 Release 版本驗證。這些是 mock 測試，不能替代真實工具鏈建置及硬體測試。

詳細檢查與尚未驗證的項目見 [本機驗證紀錄](docs/verification.md)。

正式端到端驗收需要：平台 repository 可存取、GitHub App、API 託管、Pages 設定，以及使用者明確確認一次雲端編譯與發布。INAV 另外需要 repository、固定 source SHA、MORAKOT target 與既有建置入口。以上條件尚未具備時，不能宣稱平台已正式上線或五個韌體都已可下載。

程式目錄：`src/` 前端、`shared/` schema 與固定目標、`server/` 授權 API、`scripts/` 獨立編譯及發布封裝、`tests/` 關鍵流程測試。後續可更換 adapter 或工具鏈，維持相同保存、追蹤與下載契約。

介面參考 [Taiphoon 官網](https://taiphoon.com.tw/)，`public/taiphoon-logo.png` 取自官網的既有品牌標誌。
