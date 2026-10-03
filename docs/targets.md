# MORAKOT 來源與編譯入口核對

核對日期：2026-10-03。以下是當次 GitHub 唯讀查詢取得的版本，不是編譯成功證明。固定 SHA 位於 `shared/catalog.ts`。更新版本須重新核對定義、工具鏈、設定映射並經確認驗收；不要只把 SHA 換成最新 branch head。

## ArduPilot

- [MORAKOT hwdef](https://github.com/Rex-Taiphoon/ardupilot/blob/abc8df0d405dc2b39663e0c800bc729a0287bf53/libraries/AP_HAL_ChibiOS/hwdef/Morakot/hwdef.dat)
- [原始預設參數](https://github.com/Rex-Taiphoon/ardupilot/blob/abc8df0d405dc2b39663e0c800bc729a0287bf53/libraries/AP_HAL_ChibiOS/hwdef/Morakot/defaults.parm)
- [現有 ChibiOS workflow](https://github.com/Rex-Taiphoon/ardupilot/blob/abc8df0d405dc2b39663e0c800bc729a0287bf53/.github/workflows/test_chibios.yml)

沿用現有 workflow 的 `ardupilot/ardupilot-dev-chibios:v0.2.0` 與 GCC 10 環境，記錄實際 image digest。使用 `./waf configure --board Morakot --default-parameters=platform-defaults.parm`，接 `./waf copter`、`plane` 或 `rover`。設定只映射 `OSD_TYPE2` 0 / 5；保留原定義其餘內容。下載 `.apj`、`.bin`，不建置或刷寫 bootloader。

## PX4

- [MORAKOT board](https://github.com/Rex-Taiphoon/PX4-Autopilot/blob/2883a8fb033410b1ca16240be288e1544b193bb0/boards/taiphoon/morakot/default.px4board)
- [來源自帶 Ubuntu 安裝腳本](https://github.com/Rex-Taiphoon/PX4-Autopilot/blob/2883a8fb033410b1ca16240be288e1544b193bb0/Tools/setup/ubuntu.sh)

來源為 `dev-morakot` 分支。使用來源自帶 `Tools/setup/ubuntu.sh --no-sim-tools` 與 `make taiphoon_morakot_default`。只控制 `CONFIG_MODULES_UXRCE_DDS_CLIENT`、`CONFIG_DRIVERS_OSD_MSP_OSD`；其餘 board 設定保留。下載 `.px4`。

## Betaflight

- [韌體 Makefile](https://github.com/Rex-Taiphoon/betaflight/blob/0bf1f45b024222a0517bde53430a4edb36ed4ba1/Makefile)
- [外部 config 引入規則](https://github.com/Rex-Taiphoon/betaflight/blob/0bf1f45b024222a0517bde53430a4edb36ed4ba1/mk/config.mk)
- [MORAKOT config.h](https://github.com/Rex-Taiphoon/config/blob/f1a20631ba16280ea9572223b99a37eceeb01751/configs/MORAKOT/config.h)

同時固定 firmware 與外部 `config` repository 的版本，來源不使用 `make configs` 跟隨上游最新版。執行 `make arm_sdk_install BETAFLIGHT_CONFIG=<固定checkout>`，接 `make fwo CONFIG=MORAKOT BETAFLIGHT_CONFIG=<固定checkout>`。只控制 `USE_GPS`、`USE_BEEPER`。下載 `.hex`、`.bin`；正式驗收須確認此 firmware/config 組合能編譯。

## AM32

- [兩種 MORAKOT ESC 定義](https://github.com/Rex-Taiphoon/AM32/blob/eec483e880bc9ac2429dafc71368f044dc018892/Inc/targets.h)
- [現有 Makefile](https://github.com/Rex-Taiphoon/AM32/blob/eec483e880bc9ac2429dafc71368f044dc018892/Makefile)

來源為 `Morakot_4in1_ESC-dev`。執行來源自帶 `make arm_sdk_install`，接 `make MORAKOT_4IN1_ESC_60A_G071` 或 `make MORAKOT_4IN1_ESC_60A_L431_CAN`。該分支在檔案頂端硬編碼預選 `AM32_ESC_G071`；adapter 清除該預選，讓 Makefile 選擇唯一受控 MORAKOT 目標。僅於選中的目標區塊切換 `USE_SERIAL_TELEMETRY`，不修改 dead time、ADC 或功率參數，也不修改其他 ESC 定義。下載對應目標的 `.hex`、`.bin`。

## INAV

目前未取得你的 INAV repository 與 MORAKOT 定義；入口保留且禁止提交。接入前需核對 target 名稱、source SHA、設定檔、既有工具鏈與輸出檔案。不能以其他 STM32H743 板的定義替代 MORAKOT。
