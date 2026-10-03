# Morakot 固定來源與工具鏈

核對日期：2026-10-03。完整 SHA 在 shared/catalog.ts，不跟隨分支最新 head。模板來自使用者提供的三個 ZIP，僅導入文字配置，原有二進位與壓縮檔不提交到 Git。

| 平台 | 固定來源 | 工具鏈／入口 |
| --- | --- | --- |
| ArduPilot | Rex-Taiphoon/ardupilot@92b0cd788ec29406f26c6f9c31d5ceedbd1cc538 | ardupilot/ardupilot-dev-chibios:v0.2.0，GCC 10.2.1；waf Morakot configure + copter／plane／rover／sub |
| PX4 | Rex-Taiphoon/PX4-Autopilot@186ad6d6914456bdb39f196c3069e9bef995bc3a | 上游 CI 指定 ghcr.io/px4/px4-dev:v1.17.0-rc2；make morakot_v6_default，MinSizeRel／Debug 與 LTO |
| Betaflight | betaflight/betaflight@1b53ace8356cc43f3c8359ed2357255ba789ca73 | 官方 Arm GNU 13.3.Rel1，make arm_sdk_install + fwo CONFIG=MORAKOT |
| AM32 | Rex-Taiphoon/AM32@eec483e880bc9ac2429dafc71368f044dc018892 | 原 Makefile SDK 安裝；MORAKOT_4IN1_ESC_60A_G071／L431_CAN，尚待雲端验收 |
| INAV | 尚未提供 | 不允許編譯 |

## ArduPilot

附件 hex 內標示 ArduCopter V4.6.3 (92b0cd78)，已解析為上述完整 SHA。此來源沒有 Morakot 板目錄，adapter 以附件 hwdef／hwdef-bl 覆蓋，將 AP_HW_Morakot 映射為已核對的 board ID 1210。先在 Actions 編譯 bootloader 提供 firmware build 需要的檔案，正式下載只包含所選載具的 APJ／BIN，不包含 bootloader。原預設參數由受控 defaults.parm 提供。

OSD 關閉時設定 OSD_ENABLED=0、HAL_WITH_MSP_DISPLAYPORT=0、HAL_WITH_OSD_BITMAP=0、OSD_PARAM_ENABLED=0，避免 4.6.3 DisplayPort 依賴；Lua 由 AP_SCRIPTING_ENABLED 控制。OSD_TYPE2 是額外執行時預設值，不代替編譯開關。

同一 source 的 Copter／Plane／Rover 是 4.6.3，Sub version.h 是 4.6.0-dev，Release 依載具分別標記。只有實際完成的組合可宣稱已雲端驗收，其餘選項／載具仍須各自編譯與硬體檢查。

## PX4

附件套件包含完整 git_hash，已核對同一固定 source。完整板級文字來源位於 templates/px4，複製至 boards/morakot/v6。保留附件 bootloader board ID 1105 與 image_maxsize 1703936，修正人類名稱為 Morakot；不擅自更改刷寫 ID 或放大容量。

Rex fork 沒有提供 v1.18.0-beta1 tag。流程只從官方 PX4/PX4-Autopilot 取得該 tag，核對 annotated tag object d90ac5b79200c44895c03ee7c284b20b80ecf75d，並驗證 describe 與固定源的祖先關係；不是替换韌體原始碼。韌體版本為 v1.18.0-beta1-6-g186ad6d691。封装與 publish 均驗證完整 git_hash、board ID、解壓映像大小與內嵌版本，防止 v0.0.0 或超出刷寫容量的套件被發布。

Release 使用 MinSizeRel；LTO 預設啟用，DDS 預設停用。開啟 DDS 的實際 LTO 映像為 1,720,524 bytes，仍大於附件 bootloader 套件上限 1,703,936 bytes，因此拒絕發布。DDS／ATXXXX OSD 在 px4board 實際切換。init 編輯限定數值參數與受控驅動 start，不接受通用 shell。

## Betaflight

附件標示 2026.12.0-alpha；使用者公開 fork 原先仍為 2025.12.0-beta。原 ZIP 的完整 firmware source SHA 無法確認，因此選用附件日期前一天的官方固定來源（2026-08-23）與附件 config.h/config.c，明確揭露差異，不能宣稱重現附件二進位。

定義獨立放入 work/definition/configs/MORAKOT，Makefile 透過 BETAFLIGHT_CONFIG 載入，不拉動態最新版 config。關閉功能在 common_post.h 最後排除對應 USE_*／ENABLE_*，避免上游 common_pre.h 重新啟用預設功能。原 config.h 中的硬體定義仍受固定 MCU／板名與指令限制。

## AM32、INAV

AM32 adapter 使用已核對的兩種 Morakot ESC 目標，清除 targets.h 顶端預選的其他板，僅修改選中區塊的序列遙測，不改 dead time、ADC／功率參數。尚未驗收的編譯不能視為完成。

INAV 尚缺 Morakot target、固定 source SHA 與編譯入口，不以其他 H743 板代替。
