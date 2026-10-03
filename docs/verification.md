# 驗證紀錄

## 最新：官方版本來源與 PX4 Bootloader（2026-10-04）

52 項 Node 測試、TypeScript、Vite production build 與 API bundle 全部通過。測試包含版本白名單、來源／快照／流程核對、原生 Workers OAuth、私人版本模板、正式版預設、4.6.3 載具版本限制、歷史 Release 重新命名相容性及 ARM ELF／BIN Bootloader 的向量、位址、容量與映像一致性，並拒絕變更 Bootloader board ID／主韌體起點／Flash 邊界。React HTML 驗證版本選單不顯示配置 r1／r2／r3，僅保留原平台版本。

新增官方版本均在真正的 GitHub Actions 編譯、發布並下載驗證；表格記錄實際使用的工作與 Release。每一組都核對 config.json、changes.json、source／config／profile／recipe SHA、run／attempt、台灣日期、產物大小與 SHA-256。

| 平台／原版本與目標 | Actions | Release |
| --- | --- | --- |
| ArduPilot 4.7.0 Copter | [37134506605](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37134506605) | [ArduPilot-4.7.0-Morakot-20261003-10](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/ArduPilot-4.7.0-Morakot-20261003-10) |
| PX4 1.17.0 Bootloader | [37135207625](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37135207625) | [PX4-1.17.0-Morakot-Bootloader-20261003-20](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX4-1.17.0-Morakot-Bootloader-20261003-20) |
| ArduPilot 4.7.1 Copter | [37136084420](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136084420) | [ArduPilot-4.7.1-Morakot-20261004-11](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/ArduPilot-4.7.1-Morakot-20261004-11) |
| PX4 1.18.0-rc1 主韌體 | [37136091113](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136091113) | [PX4-1.18.0-rc1-Morakot-20261004-22](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX4-1.18.0-rc1-Morakot-20261004-22) |
| PX4 1.18.0-rc1 Bootloader | [37136098454](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136098454) | [PX4-1.18.0-rc1-Morakot-Bootloader-20261004-23](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX4-1.18.0-rc1-Morakot-Bootloader-20261004-23) |
| Betaflight 2026.6.2 MORAKOT | [37136105116](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136105116) | [Betaflight-2026.6.2-Morakot-20261004-11](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/Betaflight-2026.6.2-Morakot-20261004-11) |
| Betaflight 2026.6.1 MORAKOT | [37136112614](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136112614) | [Betaflight-2026.6.1-Morakot-20261004-12](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/Betaflight-2026.6.1-Morakot-20261004-12) |
| AM32 2.21 G071 | [37136119936](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136119936) | [AM32-2.21-Morakot-20261004-8](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/AM32-2.21-Morakot-20261004-8) |
| AM32 2.20 G071 | [37136126841](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136126841) | [AM32-2.20-Morakot-20261004-9](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/AM32-2.20-Morakot-20261004-9) |
| PX4 1.18.0-beta2 主韌體 | [37136133791](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136133791) | [PX4-1.18.0-beta2-Morakot-20261004-24](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX4-1.18.0-beta2-Morakot-20261004-24) |
| PX4 1.18.0-beta2 Bootloader | [37136140468](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136140468) | [PX4-1.18.0-beta2-Morakot-Bootloader-20261004-25](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX4-1.18.0-beta2-Morakot-Bootloader-20261004-25) |
| PX4 1.18.0-beta1 主韌體 | [37136147147](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136147147) | [PX4-1.18.0-beta1-Morakot-20261004-26](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX4-1.18.0-beta1-Morakot-20261004-26) |
| PX4 1.18.0-beta1 Bootloader | [37136155513](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136155513) | [PX4-1.18.0-beta1-Morakot-Bootloader-20261004-27](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX4-1.18.0-beta1-Morakot-Bootloader-20261004-27) |

- 官方 PX4 rc1／beta2／beta1 的主韌體映像分別為 1,640,772／1,650,772／1,649,196 bytes，均低於 1,703,936 bytes；board ID 1105、完整來源 hash 與內嵌官方版本均核對一致。
- 四個可選 PX4 版本的 Bootloader 均已實際驗證。1.17 映像 43,248 bytes；官方 rc1／beta2／beta1 均 43,328 bytes，低於 128 KiB。ARM ELF／BIN load segments 一致；Flash 起點 0x08000000、主韌體起点 0x08020000。
- ArduPilot Copter 4.7.0／4.7.1 的映像分別為 1,567,556／1,567,436 bytes，board ID 1210，APJ／BIN 完全一致，低於 1,703,936 bytes。4.6.3 原來源 SHA 已確認與官方 Copter-4.6.3 相同；新 4.6.3 profile 使用官方 repo 並禁止版本不一致的 Sub 選項，原 source／template／工具鏈與既有已驗證 Copter 相同。
- Betaflight 2026.6.2／2026.6.1 的 HEX checksum、內嵌版本、下載 hash 均通過。
- 官方 AM32 2.21／2.20 G071 的 BIN／HEX 位址範圍與重建映像完全一致，HEX checksum 均通過，Flash 起點 0x08001000，BIN 59,392 bytes；來源 Inc/version.h 與選定版本一致。

首次 ArduPilot 4.7.0 因棄用的外部羅盤 define 失敗，修正獨立配置後通過。首次 PX4 Bootloader 向量驗證發現附件 idle stack 750 bytes 造成未對齊，修正為 idle／init stack 768／3200 bytes 與 linker 8-byte 對齊；未對齊產物沒有發布。舊模板／失敗快照保留，不覆寫歷史。

新 PX4 beta1 使用官方 tag fd132028513748238be1762e57893bbca9fcf179；原 fork 在 tag 之後的 6 個 commit 不帶入新的官方 beta1 工作。旧 fork 的成功 Release 仍保留歷史來源，不宣稱為精確官方 tag build。

新工作流程固定 platform-build-v2-11，其完整 commit 由每次快照保存；已完成工作使用其快照中的 v2-6／v2-8／v2-9 固定 tag。API 與 Pages 均部署最新版本；Pages 公開 repo 僅前端資產，配置與 Releases 留在私人 repo。既有五個 Release 只調整顯示名稱；下載 tag／產物及 provenance 維持不變，其他新 Release 名稱與檔名都有平台／版本分隔符。

沒有進行本地韌體編譯、WSL 或硬體刷寫／飛行驗收。ArduPilot 的 Plane／Rover／Sub、AM32 L431 CAN 及更多功能組合未逐一測試。INAV 仍待 Morakot 定義。瀏覽器網站存取被保存的封鎖設定限制，這次前端使用靜態 React 測試及 Pages 部署 CI，未宣稱新版瀏覽器互動驗收已通過。新增上游 release 需先核對固定來源與 Morakot 相容性、完成雲端驗證，再維護清單，不自動編譯未驗證的 upstream main。

## 最新：多版本與統一命名（2026-10-03）

52 項 Node 測試、TypeScript、Vite production build、API bundle 與公開前端邊界檢查通過。測試含 schema-1／2 相容、按版本的私人模板、原生 Workers OAuth 後保存 schema-2、來源／profile／recipe 篡改拒絕、台灣跨日／重跑命名、修改摘要、精確 cache key／可信 job digest、介面 HTML 的版本選項與移除 OSD／示意圖。

五組真實 Actions 全部成功，Platform.status 皆為 success。逐一下載核對韌體 SHA-256、config.json 與 changes.json，provenance 的 source／config／profile／recipe SHA、run／attempt、時間／流水號均符合該次工作。驗證使用完整模板加不影響硬體設定的註解，測試修改確實保存與套用。

| 韌體／目標 | Actions | 目前 Release |
| --- | --- | --- |
| PX4 1.17.0 | [37132095777](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37132095777) | [PX4-1.17.0-Morakot-20261003-13](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX41.17.0-Morakot-20261003-13) |
| PX4 1.18.0-beta1 | [37132107973](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37132107973) | [PX4-1.18.0-beta1-Morakot-20261003-14](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/PX41.18.0-beta1-Morakot-20261003-14) |
| ArduPilot Copter 4.6.3 | [37132118641](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37132118641) | [ArduPilot-4.6.3-Morakot-20261003-8](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/ArduPilot4.6.3-Morakot-20261003-8) |
| Betaflight 2026.12.0-alpha | [37132131524](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37132131524) | [Betaflight-2026.12.0-alpha-Morakot-20261003-10](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/Betaflight2026.12.0-alpha-Morakot-20261003-10) |
| AM32 2.20 G071 | [37132141772](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37132141772) | [AM32-2.20-Morakot-20261003-7](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/AM322.20-Morakot-20261003-7) |

來源及 profile 的維護方法見 versions.md。PX4 1.17 為官方固定來源，1.18 beta 為既有固定 fork，兩者共用編譯入口但各有獨立模板及版本驗證。AM32 固定來源 Inc/version.h 的版本已確認為 2.20。

- PX4 1.17：board 1105、完整 source hash、內嵌 v1.17.0；映像 1,597,996／上限 1,703,936 bytes。
- PX4 1.18 beta：board 1105、完整 source hash、內嵌 v1.18.0-beta1；映像 1,658,228／上限 1,703,936 bytes。
- ArduPilot Copter：board 1210、git_identity 92b0cd78；APJ／BIN 完全相同，映像 1,629,732／上限 1,703,936 bytes。
- Betaflight：Intel HEX checksum 全部通過，內嵌 2026.12.0-alpha。
- AM32：HEX checksum 通過；來源版本 2.20。BIN／HEX 的 hash 與先前已核對完全一致的映像相同。

正式 Worker 已部署，多版本 API／秘密管理維持原帳號與 GitHub App。Pages 公開 repo 只包含前端與品牌 logo，已移除 Morakot 示意圖、獨立 OSD 控制與過期生成資產。前端 HTML 有靜態 React 測試；因已保存的網站封鎖限制，尚未完成本版瀏覽器視覺／互動驗收，不宣稱端到端瀏覽器操作已通過。

最初五次工作因 Actions Artifact quota 滿而在快照上傳失敗。改為按固定配置 commit 讀取快照、以官方 cache 暫存同次 run／attempt／SHA 的產物，publish 比對 build job digest 並獨立驗證；未增加付費額度。命名時間的 API 查詢在前置步驟完成，編譯工具鏈不接收 API token。最終流程固定 tag platform-build-v2-4，commit 33f1a7c050d1a30db378324ccf71a99f8bdb23d1。

使用者授權清除目前 Releases 後，已刪除 13 個舊版／過渡 Releases（含草稿和附件），清理當時保留上表 5 個正式結果；後續驗證另新增 Release。未刪除原始碼、配置快照或 workflow tags。下面歷史紀錄的 Release 連結已不提供下載，保留作驗證證據；舊快照仍可讀取，新工作需選 profile。Release 刪除後回報找不到結果是預期狀態。

尚未進行硬體刷寫、感測器或飛行验收。ArduPilot Plane／Rover／Sub、AM32 L431 CAN 與更廣功能組合未逐一驗證。INAV 仍缺 Morakot 定義。

## 歷史驗證（相關 Releases 已按使用者指示清除）

2026-10-03：Pages 與 Cloudflare Workers API 已部署。使用者已確認 GitHub App 安裝、成功登入與讀取私人配置，並從正式 Pages 保存了 ArduPilot 設定。四個可接入平台已通過真實 GitHub Actions 編譯、私人 Release 發布、下載及版本／雜湊核對。

## 完整目錄編輯

| 平台 | 可編輯文字檔 | 驗證配置 |
| --- | --- | --- |
| ArduPilot | hwdef/Morakot：3 檔 | 使用者從 Pages 保存的 Copter 4.6.3，OSD／Lua 開啟 |
| PX4 | boards/morakot/v6：24 檔 | 全目錄快照，board_config.h 加入測試註解；DDS／OSD 關閉、LTO 開啟 |
| Betaflight | configs/MORAKOT：config.h、config.c | config.c 加入测试註解；預設五項功能開啟 |
| AM32 | 共用 Inc/targets.h | 完整約 142 KiB JSON 快照，G071、序列遙測開啟 |

目錄中的 C／C++、CMake、NuttX、linker 與其他文字配置均會保存，adapter 會將快照套用到實際建置目錄。PX4 目前編譯 default 主韌體；bootloader 檔案會保存但不是此目標的編譯輸入。

## 實際工作與發布結果

| 平台 | Actions | Release |
| --- | --- | --- |
| ardupilot | [37121878850](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37121878850) | [4.6.3](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/ardupilot-copter-4.6.3-20261003-37121878850-1) |
| px4 | [37121883476](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37121883476) | [1.18.0-beta1-6-g186ad6d691](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/px4-Morakot-1.18.0-beta1-6-g186ad6d691-20261003-37121883476-1) |
| betaflight | [37121888125](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37121888125) | [2026.12.0-alpha](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/betaflight-Morakot-2026.12.0-alpha-20261003-37121888125-1) |
| am32 | [37121894734](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37121894734) | [eec483e880bc](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/releases/tag/am32-G071-eec483e880bc-20261003-37121894734-1) |

所有工作的來源 SHA、設定 commit、canonical 設定 SHA-256、workflow commit、run／attempt 與 Release 身份均通過核對。實際下載檔案大小及 SHA-256 與 GitHub asset digest、provenance 一致。以正式 Platform.status 路徑讀取也均為 success；AM32 的大型 config.json 已成功讀取及比對。

### ardupilot

- request：`38cb1e1a-85a2-4c05-a3ea-3b7b7e102b13`
- config commit：`547ed4061923f912279a8956b51796fa3bbe7154`
- source commit：`92b0cd788ec29406f26c6f9c31d5ceedbd1cc538`
- workflow commit：`62988ce32446fcb22e9097a7449b08cd462a516e`
- compiler：`arm-none-eabi-gcc (GNU Arm Embedded Toolchain 10-2020-q4-major) 10.2.1 20201103 (release); ardupilot/ardupilot-dev-chibios@sha256:8bb0f850fb3fe1c170cb12dd577ab64f3708be8a828f9eafd28d73559766e81f`
- `ardupilot-copter-4.6.3-20261003-37121878850-1.apj`：1445010 bytes；SHA-256 `c8d7b419f0596f6322b498aa969dff02f7b16b154b940aa7b4b662b5b048b919`。
- `ardupilot-copter-4.6.3-20261003-37121878850-1.bin`：1629716 bytes；SHA-256 `89624f52c7ac6fcbd61518b177bb8f853b137735abd7a66a984d231d0629002a`。

### px4

- request：`d457a114-fc2e-48e2-8466-d8d8bc2c4b59`
- config commit：`776fd04e80c0300b3646fe0d9be0680e917ecedf`
- source commit：`186ad6d6914456bdb39f196c3069e9bef995bc3a`
- workflow commit：`2c3ef4176063b6bf5394a49ee44987868a4fd1d7`
- compiler：`[0;32m[docker-entrypoint.sh][0m Starting; ghcr.io/px4/px4-dev@sha256:5e7ad18c75c3a5a655d5adfde4ab1eb216dd4bee7710941b6cd122f3969a7fed`
- `px4-Morakot-1.18.0-beta1-6-g186ad6d691-20261003-37121883476-1.px4`：1623020 bytes；SHA-256 `e69fbcbc33b4480fd59269c155bf40662b0a2c0040bc937bfd5513f960c6e083`。

### betaflight

- request：`2c02e2dc-2a25-41aa-bcb6-6492686c2a67`
- config commit：`6083d59795ec044f29a603e08cf34b01633fdbec`
- source commit：`1b53ace8356cc43f3c8359ed2357255ba789ca73`
- workflow commit：`d4abb1a52c3341a2ca17aa60e91218a82c67b916`
- compiler：`arm-none-eabi-gcc (Arm GNU Toolchain 13.3.Rel1 (Build arm-13.24)) 13.3.1 20240614`
- `betaflight-Morakot-2026.12.0-alpha-20261003-37121888125-1.hex`：1613557 bytes；SHA-256 `a87411f21dfa0f19edd6460281314ffb8c06e52f41497ff5249bf69e814c1876`。

### am32

- request：`73e7c59c-a9fd-4309-9186-5d96d7bde18a`
- config commit：`36404ef13ae38fc9b2aa6ac3e0473fc070b09ffe`
- source commit：`eec483e880bc9ac2429dafc71368f044dc018892`
- workflow commit：`05879a84a9de757cbc737c2c56a3a6106737e38f`
- compiler：`arm-none-eabi-gcc (xPack GNU Arm Embedded GCC x86_64) 10.3.1 20210824 (release)`
- `am32-G071-eec483e880bc-20261003-37121894734-1.bin`：59392 bytes；SHA-256 `b8ec454f1b7292a1df44714df2a3c81478a02a616b83ebbafde4f81ebf280c3c`。
- `am32-G071-eec483e880bc-20261003-37121894734-1.hex`：71129 bytes；SHA-256 `9ba5aff99e775e69993b584ddb7f06250caa9400558acc538fcbc8ec06457622`。

## 套件內容

- ArduPilot：board ID 1210、git_identity 92b0cd78。APJ image 解壓後與 BIN 每一位元組相同；OSD／Lua 開啟映像為 1,629,716 bytes，低於 1,703,936 bytes 上限。OSD／Lua 關閉的較早工作 [37119360092](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37119360092) 也成功。
- PX4：board ID 1105、完整 git_hash、內嵌 v1.18.0-beta1、verified upstream tag 及 source describe 均匹配。LTO 開啟／DDS 關閉配置的解壓映像為 1,658,228 bytes，低於 1,703,936 bytes 上限。
- Betaflight：各 Intel HEX record checksum 通過，映像包含 2026.12.0-alpha。功能全部關閉工作 [37120808918](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37120808918) 也已發布；HEX 為 1,168,514 bytes，SHA-256 cc421c24ca9af6446aa99f35db384e8f1c239c659ede508ae9cba251270c21d6。
- AM32：HEX checksum 通過，起始地址 0x08001000，1,582 筆 HEX data records 與 BIN 相應位置均一致。此開發来源沒有已核對的正式版本 tag，Release 以 eec483e880bc 標記來源版本。

## 已修正的問題

- Workers 的原生 fetch 被作為 GitHub 類別方法呼叫會產生 Illegal invocation，且 GitHub API 缺少 User-Agent 會拒絕請求。已修正綁定與 header，增加實際 Workers runtime 中的完整 OAuth／配置授權回歸測試；使用者已確認登入成功。
- ArduPilot 停用 OSD 時一併停用依賴的 MSP DisplayPort、bitmap 與 OSD params；不只修改 OSD_TYPE2。發布只選主韌體 APJ／BIN，避免混入 bootloader。
- PX4 原 Release／O3 超出 linker FLASH 容量；MinSizeRel 與 LTO 改善大小，但開 DDS 的映像仍為 1,720,524 bytes，超過 bootloader 上限。預設關閉 DDS；超容量會失敗而不發布。
- 早期 PX4 工作 37118349163 的超容量 Release 已退回 draft，保留调查資料，不提供為成功結果。没有刪除 Release。
- Betaflight 關閉蜂鳴器時移除 BEEPER_PIN；關閉 Blackbox 時移除 USB MSC；關閉遙測時移除相依 FPort／Jeti EX Bus／MAVLink 接收及 CRSF v3 遙測，保留基本 CRSF 接收。

## 測試與邊界

- 34 項 Node 測試通過，涵蓋完整目錄、修改確實套用、CMake／外部引用／路徑限制、不可變快照、冪等與逾時查回、身份／版本／digest 核對、失敗／draft 不提供下载、Worker OAuth、native fetch、CORS、session、權限與秘密遮蔽。
- TypeScript 型別檢查、Vite production build、API bundle 與前端資產邊界審核通過。public bundle 不含私人基礎配置、server secret bindings、token 或私鑰；公開 repo 只保存前端資產、品牌圖、README 與 Pages 部署 workflow。
- build job 只有必要的讀取權限，不含 App 秘密；publish job 獨立取得 Contents write。編譯產物沒有提交 Git，也不隨 Pages 發布。
- 正式 Pages 的新目錄尚未完成自動化視覺操作驗收，因瀏覽器網站權限拒絕自動化存取；本機舊截圖不是本版的正式驗證。使用者已確認正式登入與保存配置。
- ArduPilot Plane／Rover／Sub、AM32 L431 CAN 與更多模組組合尚未逐一編譯；INAV 等待 Morakot 定義。所有韌體尚未進行實體刷寫或飛行驗收。
