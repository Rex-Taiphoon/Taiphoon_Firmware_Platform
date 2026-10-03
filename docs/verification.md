# 驗證紀錄

2026-10-03，ArduPilot / Morakot Copter 已通過真實 GitHub Actions 編譯、artifact 下載與版本／內容核對。Pages／API 尚未部署，未建立 Release。

- 24 項 Node 測試通過，涵蓋 HTTP handler、OAuth、設定驗證、固定編譯命令、提交冪等、逾時查回、權限、下載版本核對、未確認發布時拒絕執行 Release 腳本，以及容器子模組信任路徑的範圍限制。
- TypeScript 型別檢查、Vite production build 與 Node API bundle 均通過。
- API bundle 的未登入請求回傳 401；原始程式與輸出 bundle 的憑證格式掃描未找到嵌入 token 或私鑰。
- 瀏覽器確認 ArduPilot 載具選擇、PX4 模組、Betaflight GPS 開關及 AM32 L431 CAN 選擇對應正確設定 JSON。
- 切換韌體時清除前一個工作的結果，INAV 不允許保存或啟動編譯。
- 本機流程示範走到完成狀態並產生設定記錄下載連結。內建瀏覽器自動化未取得下載檔案的落盤事件，因此實際檔案下載仍需在一般瀏覽器驗收。
- 手機寬度 390px 時，document clientWidth 與 scrollWidth 均為 375px（另含捲軸），未出現橫向溢出。

截圖：[桌面示範](screenshots/platform-demo.jpg)、[手機 AM32 設定](screenshots/platform-mobile.jpg)。截圖中的工作與設定 SHA 是本機示範，不是 GitHub 正式工作。

PX4、Betaflight、AM32、ArduPilot Plane / Rover 與 OSD 停用設定仍未執行真實編譯；INAV 等待定義。正式 OAuth 與託管環境、Pages → API → Actions → Release 完整流程及硬體運作尚未驗收。

## 私人 repository 的真實雲端編譯

使用者確認私人 repository 存取授權後，透過電腦既有的 Git 登入成功確認該 repo 可讀寫、尚無分支，並上傳平台至 `main`。GitHub 連接器的 installation 仍只允許其選定 repositories；本次操作使用 Git credential helper，憑證只在記憶體內，未寫入專案或輸出紀錄。

- 首次工作：[37111669527](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37111669527)。
- request：`bbb7bab6-4daf-4435-b93d-74737b3f011e`；受控設定：ArduPilot / Morakot、vehicle=`copter`、osdType2=`5`。
- 設定 commit：`117be9ee381187e915ef0efb980985168083a206`；原始碼：`Rex-Taiphoon/ardupilot@abc8df0d405dc2b39663e0c800bc729a0287bf53`。
- `publish_release=false`；只保留 Actions artifact，不建立 Release，不部署 Pages／API。
- 此次由操作者保存固定設定並直接觸發 Actions，尚未驗收正式 Pages → GitHub App API 的使用者授權流程。
- 首次 validate 成功；compiler image 與 Waf configure 成功，build 因 `/source/modules/ChibiOS` 的 Git dubious ownership 失敗。容器原本只信任 `/source`，未包含子模組。
- 修正為列舉本次 checkout 的遞迴子模組，逐一指定 `safe.directory`；不使用 `*`，不改變工具鏈。新增測試拒絕 checkout 外的路徑。
- 修正後成功工作：[37111909948](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37111909948)，attempt 1、workflow commit `b9ae516b82f58416ed2a2ad1013739de7a98c948`。Copter 建置耗時約 10 分 14 秒；validate、build 成功，publish 跳過。Release 列表查詢為空。
- artifact：[firmware-37111909948-1](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37111909948/artifacts/11270345511)、ID `11270345511`，已實際下載 ZIP。ZIP SHA-256 與 GitHub digest 一致：`477c87bb2c6ab806d236eba9b748289686a62feed95379829f7c49e3d60bde65`。
- `provenance.json` 的 request ID、設定 SHA、原始碼 SHA、workflow SHA、run ID、attempt 及設定 digest 均匹配本次工作；`config.json` 與保存設定相同。
- `arducopter.apj`：1,413,203 bytes，SHA-256 `e1ff98602039aaad89c3e538c7b0db3dc261504fafc5c3e1a6b0fe24f4cf040e`。
- `arducopter.bin`：1,582,540 bytes，SHA-256 `9f89637c1834223768353f70df19c7a1e16a095b7621de050389874dba3e0aab`。
- APJ magic 為 `APJFWv1`、board ID 1210；解壓 APJ image 後的大小及每個位元組均與 BIN 一致。產物僅存於 Actions artifact 與本機 Git 忽略的 `output/`，沒有提交到 Git 或發布至 Pages。
- 實際 compiler：GNU Arm Embedded Toolchain 10-2020-q4-major / GCC 10.2.1；image digest：`ardupilot/ardupilot-dev-chibios@sha256:8bb0f850fb3fe1c170cb12dd577ab64f3708be8a828f9eafd28d73559766e81f`。
