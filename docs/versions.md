# 多版本編譯

Pages → Workers API → 私人配置快照 → GitHub Actions → 私人 Releases。使用者不需要本地工具鏈。維護者需要新增及核對受控版本設定；目前不接受使用者自行輸入任意 repository、commit、容器或命令。

## 使用

選擇平台，再選韌體版本。每個版本載入自己的配置模板、允許的檔案與功能選項。切換版本會先提示，確認後載入該版本預設配置；不自動把舊檔覆蓋到新版本。先保存要保留的修改。

新版沒有獨立 OSD 控制項。ArduPilot 的 hwdef／defaults.parm、PX4 的 default.px4board、Betaflight 的 config.h 決定 OSD 行為；其餘功能選項會由 adapter 套用。既有 schema-1 工作仍保持原本的 OSD 選項語義，不改寫舊快照；可查詢與恢復，但要開始新的編譯，需選擇新版 profile 並另存，確保所有新 Release 符合統一命名。

## 版本資料

shared/catalog.ts 保留舊 targets，另提供 profiles。每個 profile ID 含平台、原平台版本、Morakot 與 r1／r2。內容包含完整來源 SHA、模板 key／SHA-256、功能白名單、adapter 修訂及固定容器 digest。顯示用 note、description、ref 不納入編譯設定雜湊。

同一 profile 的編譯設定不可覆寫。來源、模板、工具鏈或規則變更時新增 profile ID／模板目錄，保留舊 profile。server/build-profile.ts 在 API 與 Actions 中獨立核對 profileDigest。檔案與安全規則依所選模板驗證。

schema-2 快照記錄 profileId、profileDigest、來源 SHA、完整配置、recipeRef 及 recipeSha。API 保存時將維護者指定的 platform-build-v2-* 輕量 tag 解析為完整 commit；送出前再確認 tag 沒有移動。Actions 必須在該 recipeSha 執行。歷史結果依原快照驗證，不依目前預設版本或目前預設流程重新推算。

workflow tag 需保留、不移動或刪除；可用 GitHub tag ruleset 限制更改。tag 被移動時，舊結果仍可查詢，但再次 dispatch 會被拒絕。平台升級只調整 wrangler.jsonc 的 GITHUB_WORKFLOW_REF，已保存工作继续使用自己的 tag／SHA。recipe commit 的 workflow 必須保留在 repo 歷史中；Actions、外部下載服務與舊容器仍可能在未來停用，因此固定版本不代表永久保證位元完全一致。

## 新增版本

1. 核對官方 tag 物件及其完整 commit；使用 fork 時另核對與上游版本的關係。
2. 新建獨立模板目錄，移植 Morakot MCU、pin、感測器與初始化；不要修改已有 profile 的模板。
3. 在 scripts/template-data.mjs 加入模板 key、執行生成器，生成私人模板資料與公開路徑／白名單／模板 hash。PX4 的鎖定設定亦需納入相應模板 key。
4. 在 profiles 加入新 ID、來源／版本／工具鏈／模板／受控功能，必要時新增 adapter 分支與版本專用套件驗證。不能讓使用者傳入 shell。
5. 執行 tests、TypeScript、前端公開邊界檢查。提交流程並建立新的 platform-build-v2-* tag，不移動既有 tag。
6. 用新 tag 執行 Actions，驗證完整配置套用、內嵌版本、board ID、映像容量、下載 bytes／SHA-256、Release 內容及舊工作回歸，再部署 API／Pages。

新版本的雲端編譯成功不等同硬體相容性／飛行驗收；待驗證選項與載具要各自測試。INAV 仍待 Morakot 定義。

## 命名與修改摘要

新版：`ArduPilot4.6.3-Morakot-20261003-82`。日期取 Actions 工作 run_started_at（沒有時使用 created_at），轉為 Asia/Taipei；82 是該 workflow 的 run_number，不是每天歸零的計數。重跑第二次加 `-r2`。載具／ESC variant 記錄在 Release 描述及 provenance.json。AM32 使用固定來源 Inc/version.h 的 2.20，沒有以來源 SHA 代替名稱。PX4 顯示上游版本 1.18.0-beta1，Git describe 的距離與 SHA 僅留在 provenance。舊 schema-1 Release 標籤保持原格式。

Release 描述列出相對於所選版本預設模板的參數修改、變更檔案及簡短增刪行摘錄。changes.json 保存完整增刪行清單和修改前後檔案 hash；若只調整行序會標示行序變更，完整順序看 config.json。參數與檔案的摘要不是「與上一個使用者工作」比較，也不是上游原始碼 changelog。模板本身已包含 Morakot 移植。

config.json 是該次完整設定；provenance.json 記錄來源／配置／流程 SHA、profile hash、原平台版本、載具、時間、流水號、run／attempt、工具鏈、產物 hash。每次工作與重跑建立獨立 Release，不覆寫既有結果。

## 暫存產物與配額

本次驗證遇到 GitHub Actions Artifact 儲存配額滿。新版 validate、build 各自透過 API 讀取同一 config commit 的快照，不傳遞配置 Artifact。build 使用官方 actions/cache/save，以 run ID＋attempt＋workflow SHA 的唯一 key 暫存 output；publish 只精確恢復此 key，拒絕 cache miss，並比對可信 build job output 的整包 SHA-256，再驗證快照／provenance／實際套件。編譯仍只有 Contents read，發布 job 才取得 Contents write。

Cache 是短期轉交媒介，可能被 GitHub 淘汰；不可用作下載歷史。最終結果在 Releases。只編譯模式不保存 cache／Release；可从 Actions 日志核對結果。重新執行使用 Re-run all jobs。Cache 本身亦有容量及權限限制；若失敗，查看 Transfer／Restore 步驟，勿以其他工作的 cache 代替。沒有調整付費額度或刪除現有 Release。

參考：[官方 cache action](https://github.com/actions/cache)、[GitHub cache 限制](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)、[官方 PX4 1.17.0](https://github.com/PX4/PX4-Autopilot/releases/tag/v1.17.0)。
