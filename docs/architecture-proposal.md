# 線上設定與雲端編譯平台：第一版提案

狀態：React + TypeScript、GitHub App + 無伺服器 API 已由使用者確認，並完成本地實作與流程範本。已將程式上傳至私人平台 repository，ArduPilot / Morakot Copter 已通過不發布 Release 的真實雲端編譯、下載及產物核對。尚未部署 Pages／API；實際結果見 docs/verification.md，操作文件見 README.md。

## 現況與範圍

2026-10-03 檢查時，此工作目錄為空，尚未初始化 Git，沒有現有程式、開發規範或正式編譯入口可沿用。

依後續需求，第一版涵蓋 ArduPilot、PX4、Betaflight、AM32 的受控 MORAKOT 設定與 adapter，以及待接入的 INAV。來源與建置入口已逐一核對，詳見 targets.md；不使用使用者提供的任意 shell。不依賴本地 WSL 或常駐編譯機。

## 責任分工

| 元件 | 責任 |
| --- | --- |
| GitHub Pages | 編輯設定、顯示驗證結果、提交要求、輪詢狀態、提供對應結果與紀錄連結 |
| 授權層 | 驗證使用者的 repository 寫入資格、限制可修改路徑與目標、保存設定、觸發固定 workflow |
| GitHub repository | 保存設定快照、平台程式與 workflow；固定原始碼 repository 及版本的來源另行確認 |
| GitHub Actions | 驗證輸入、取得指定版本、呼叫受控編譯 adapter、封裝及發布結果 |
| GitHub Releases | 保存每次工作的結果、設定快照、版本資訊與雜湊 |

編譯產物不提交到 Git。Pages 僅發布前端目錄，不能包含憑證、設定快照或編譯產物。

## 授權方案

### 建議：GitHub App 加無伺服器 API

Pages 經由無伺服器 API 操作 GitHub。GitHub App 私鑰、登入交換所需秘密及 installation token 均留在 API 的秘密儲存與伺服器記憶體，不進入前端、repository 或紀錄。此 API 處理授權及短時間的 GitHub API 呼叫，不承擔編譯。

登入後仍須驗證該使用者對目標 repository 的寫入資格；不能只因 App 已安裝就允許任何登入者使用。API 固定 repository、設定路徑、workflow 與目標 allowlist，並驗證設定型別、範圍及大小。登入需驗證 state，跨來源請求及 session 需設計 CSRF 防護；紀錄需排除 Authorization、cookie、私鑰及交換碼。

App 限定安裝於必要 repository，保存設定需要 Contents write，觸發 workflow 需要 Actions write。installation token 可以進一步限制 repository 與權限。GitHub 的 Contents write 不是設定檔路徑專用權限，因此路徑與允許操作仍由 API 強制限制；若正式原始碼在另一個 repository，應只給必要的唯讀存取。

已選定本方案。提供 Node.js 無伺服器 handler；實際 API 託管供應商、App 與部署資訊仍待設定。

### 替代：使用者提供 fine-grained token

適合由 repository 維護者操作的最小版本。使用者自行建立只限目標 repository、Contents write 與 Actions write 的 token，於頁面輸入後只保留在當次瀏覽器記憶體。不得寫入程式、網址、localStorage、sessionStorage、repository 或紀錄；重新整理後重新登入。

此方案不需額外 API，但頁面的 JavaScript 能接觸使用者 token，且 token 權限不是設定路徑專用權限。需由使用者明確選定此授權模式，再實作輸入介面與清除機制。

## 完整流程與可追溯性

1. 使用者編輯 schema 允許的欄位。前端驗證改善操作體驗，授權層與 Actions 再次驗證。
2. 保存設定快照，取得不可變的設定 commit SHA。若同一設定檔被同時修改，回報衝突，不能靜默覆寫。
3. 固定專案的原始碼版本解析為完整 commit SHA；使用者不能自行指定任意 repository、執行檔或 shell 指令。
4. 產生 request ID，呼叫固定 workflow 的 workflow_dispatch。ref 使用受控 branch/tag；設定 SHA 與 request ID 作為 inputs 傳入，原始碼 SHA 與目標由不可變快照讀取並核對 allowlist。workflow 應存在預設分支。
5. 使用 dispatch 回傳的 run ID 與 URL 追蹤工作；如需支援沒有 run ID 回應的 API 版本，以唯一 request ID 關聯工作，不能直接取「最新的一次」。網路逾時先查詢是否已受理，不能盲目重送。
6. build job 取得固定版本，透過 adapter 編譯，產生暫存 artifact。此 job 僅有必要讀取權限，checkout 不保留 Git 憑證，不能取得 App 私鑰或發布憑證。
7. publish job 等待 build 成功，只下載同一次 run 的 artifact，不執行編譯產物或使用者設定中的程式。驗證檔案結構與 provenance 後，取得 Contents write 發布 Release。
8. Release 標籤包含 run ID 與 run attempt，避免重跑覆蓋舊結果。先建立 draft，上傳完整資產後再公開；部分發布失敗顯示失敗，不能當成成功下載。
9. Pages 只在工作成功、Release 已公開且 provenance 與本次請求相符時提供下載。保存後尚未送出或送出失敗，也須顯示明確狀態與重試入口。

每次結果包含 provenance manifest，至少記錄 request ID、設定 commit SHA、設定內容 SHA-256、原始碼 repository 與 SHA、workflow 版本、run ID、run attempt、編譯目標、工具鏈版本及各資產 SHA-256。Release 一併提供使用的設定快照。不得將 manifest 的使用者文字當成 HTML 或命令執行。

工作狀態由 run 與各 job 推導：送出中、排隊、驗證、編譯、發布、成功、失敗、取消。排隊或發布失敗不能借用其他 run 的下載結果；提供對應 Actions 紀錄入口。API 限流與暫時斷線應顯示可重試狀態，不能誤報編譯失敗。

## 編譯封裝

adapter 接受已驗證的設定檔與受控目標，輸出到指定產物目錄。執行命令與參數映射由維護者寫在程式中，不能使用 eval、任意 shell 字串或使用者指定的 executable。workflow 只負責調度，不散落正式工具鏈命令。

正式編譯入口未確定前，可在使用者同意後提供明確標示的示範 adapter。示範結果不能宣稱是可刷寫韌體，也不能作為正式編譯完成標準。

## 測試與人工驗收

- schema 與授權：未知欄位、越界值、任意目標、路徑及命令注入均被拒絕；未登入或無 repository 寫入資格不能提交。
- 保存與提交：同時修改、保存成功但 dispatch 失敗、dispatch 回應逾時及重試不會覆寫或錯綁工作。
- 狀態與下載：兩個並行 run、重新整理、run 重跑、編譯失敗、發布失敗、缺失資產及版本不一致時都不會提供錯誤下載。
- 發布：manifest 與產物內容、雜湊一致；失敗的 draft 不呈現為完成結果；compile job 沒有發布權限。
- 憑證：前端打包檔、保存設定、網頁儲存及測試紀錄不含秘密；使用假的 token 測試紀錄遮蔽。

本地以 GitHub API mock 測試流程，無須 WSL。真實 Pages 部署、Actions 編譯、建立或刪除 Release，均須另獲使用者確認後才執行。未完成真實端到端驗收前，不宣稱雲端流程已驗證。

使用文件需涵蓋 App 或 token 設定、repository 與 Pages 設定、首次使用、權限不足、保存衝突、排隊、編譯或發布失敗、限流與版本核對。公開 repository 的設定、紀錄與 Release 資產可能公開；表單須提示且不得收集秘密。

## 待確認事項

1. 私人平台 repository 已透過電腦既有 Git 登入確認可存取並完成程式上傳；GitHub 連接器仍只涵蓋其選定 repositories，後續可另將平台 repo 加入。
2. 設定 GitHub App 與 API 託管供應商、Pages 網址，經明確確認後進行部署及一次真實端到端編譯驗收。
3. 提供 INAV repository、固定原始碼 SHA 與 MORAKOT target，接入第五個 adapter。

## 官方依據

- [GitHub App installation 授權與 token 範圍](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [保存 repository 檔案 API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)
- [觸發 workflow API 與所需權限](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
- [Actions workflow 與 job 權限](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)
