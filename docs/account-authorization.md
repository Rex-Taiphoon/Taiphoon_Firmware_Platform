# 帳號白名單與後端編譯授權

GitHub 登入只用於確認身分。`GITHUB_ALLOWED_USERS` 是 JSON：固定 GitHub 數字 user ID 對應穩定的平台 actor 名稱。名稱作為工作擁有者識別，不隨 GitHub 改名更新，也不可讓不同 ID 共用同一 actor。原帳號保留 `Rex-Taiphoon`，因此原有工作仍可讀取。

目前設定：`219089883` → `Rex-Taiphoon`、`71856163` → `Qqww4599`。登入後 session 只含 user ID、actor 與到期時間，不保存 GitHub user token。每次 API 操作重新檢查白名單，移除 ID 並重新部署即可撤銷已發出的 session；新增帳號後也要重新部署。

白名單設定存在時，權限檢查不會退回 repository 寫入資格；空白名單拒絕全部帳號。未設定此變數才沿用舊模式。切換到白名單後舊 session 需重新登入。

## 啟用前必要設定

1. GitHub App `taiphoon-firmware-platform` 改為 Public，使其他帳號可以 OAuth 授權；私人平台 repository 維持 Private。
2. App 在 Rex-Taiphoon 安裝時僅允許 `Taiphoon_Firmware_Platform`，Contents／Actions write；其他使用者不必安裝 App 或加入 repository。
3. `GITHUB_APP_ID` 與 `GITHUB_APP_INSTALLATION_ID` 設於 Workers vars；App 私鑰以 `GITHUB_APP_PRIVATE_KEY` 存於 Workers secrets。既有 client secret 和 session key 維持原值。私鑰不可提交 Git 或貼入聊天。
4. 測試後部署 API 與前端；缺少安裝憑證時不可部署啟用新模式，否則保存與編譯將失敗。

後端取得限定單一 repository、Contents／Actions write 的短期 installation token。編譯 snapshot 與 dispatch 仍透過 actor 隔離，不能讀取、編譯或下載其他人的工作。

白名單模式下，成功工作的資產網址為 `/requests/:id/assets/:assetId`。前端以 bearer session 下載；後端先驗證工作擁有者、Release provenance 與資產清單，再串流提供已核對的韌體。不接受任意 GitHub 資產 ID，也不將 App token 傳入前端或下載網址。GitHub Actions／Release 原生連結仍只有 repository 成員可開啟，一般使用者使用平台進度與下載按鈕。

## 驗證

`tests/whitelist.test.ts` 覆蓋固定 ID／改名、未授權及撤銷、拒絕舊 session、後端 installation token 保存與編譯、私人韌體下載及跨使用者工作隔離。`pnpm test`、`pnpm build`、`pnpm api:build` 另確認既有模式與前後端建置。

管理設定部署完成不等同另一帳號的端到端登入驗收。正式驗收需 Qqww4599 本人授權登入，再保存並提交一個工作，確認成功下載。

## 2026-10-05 部署紀錄

- App 已改為 Public；App ID `5174403`，原帳號 installation ID `167492127`。後端取得的 installation token 限定 `Taiphoon_Firmware_Platform`，已確認只可存取該私人 repository。
- 私鑰已直接存入 Workers secret `GITHUB_APP_PRIVATE_KEY`，未寫入專案或公開前端。
- Worker version `0a4c89aa-ce61-4d37-b099-ccc325d108e0` 已部署；固定編譯流程仍為 `platform-build-v2-14`。
- Pages commit `dc0506eea0e3c9c8fb5e171ef63b4d928bae76fc`，部署工作 `37296450491` completed／success。
- 69 項測試、TypeScript／Vite／API build 與公開資產檢查通過。正式瀏覽器已驗證 Rex-Taiphoon 的白名單登入、配置讀取及 App 保存；保存 request `f5904688-1742-4f98-b447-1daa96b17734`，config commit `87ac45e7393e`。這個驗證工作未啟動编譯。
- Qqww4599 已設定授權，但尚未實際以該帳號完成登入與編譯驗收。
- 正式保存 commit `87ac45e7393e9779ebdd39568cdedfc4b6cee620` 的作者為 `taiphoon-firmware-platform[bot]`，確認後端 App 憑證已生效。
- 以原帳號恢復 INAV request `04920e17-094a-4b8f-9655-0405c7204cd6`，新 API 成功核對既有 Release；新版前端已使用帶 session 的下載按鈕。BIN 實際下載至使用者的 Downloads，906,795 bytes，SHA-256 `f254bd2eb48aebca9d1f811aadbd6c29dd6d0e6a2f7910c86c343332761b44bb`。
