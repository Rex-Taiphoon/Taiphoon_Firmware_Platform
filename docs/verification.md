# 驗證紀錄

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
