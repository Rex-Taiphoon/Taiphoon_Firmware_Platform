# 本機驗證紀錄

2026-10-03，本次僅執行本機平台建置與 mock 測試，沒有遠端部署、韌體編譯或 Release 寫入。

- 23 項 Node 測試通過，涵蓋 HTTP handler、OAuth、設定驗證、固定編譯命令、提交冪等、逾時查回、權限、下載版本核對，以及未確認發布時拒絕執行 Release 腳本。
- TypeScript 型別檢查、Vite production build 與 Node API bundle 均通過。
- API bundle 的未登入請求回傳 401；原始程式與輸出 bundle 的憑證格式掃描未找到嵌入 token 或私鑰。
- 瀏覽器確認 ArduPilot 載具選擇、PX4 模組、Betaflight GPS 開關及 AM32 L431 CAN 選擇對應正確設定 JSON。
- 切換韌體時清除前一個工作的結果，INAV 不允許保存或啟動編譯。
- 本機流程示範走到完成狀態並產生設定記錄下載連結。內建瀏覽器自動化未取得下載檔案的落盤事件，因此實際檔案下載仍需在一般瀏覽器驗收。
- 手機寬度 390px 時，document clientWidth 與 scrollWidth 均為 375px（另含捲軸），未出現橫向溢出。

截圖：[桌面示範](screenshots/platform-demo.jpg)、[手機 AM32 設定](screenshots/platform-mobile.jpg)。截圖中的工作與設定 SHA 是本機示範，不是 GitHub 正式工作。

四個真實韌體 adapter 均未執行；雲端工具鏈相容性、正式 OAuth 與託管環境、Pages 部署、Release 建立及韌體下載仍待經使用者確認後驗收。新平台 repository 的公開 API 查詢回傳 404，連接器未列出；未假設其可寫入，也未初始化或推送遠端。

使用者隨後已同意 GitHub Actions 編譯驗證。再次透過 GitHub 連線直接讀取 `Rex-Taiphoon/Taiphoon_Firmware_Platform` 仍回傳 404，可存取 repository 搜尋也沒有結果，因此尚無法啟動真實工作。已加入 `publish_release` 預設 false 的只編譯模式；成功產物保存在一天期限的 Actions artifact。正常平台 API 則明確要求發布，維持原本 Release 流程。未部署 Pages、未建立／刪除 Release。
