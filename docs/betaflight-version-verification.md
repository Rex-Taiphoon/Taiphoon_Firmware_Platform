# Betaflight 版本核對（2026-10-05）

介面提供的版本名稱與 Betaflight 官方原始碼一致，無需改寫版本號。

| 版本 | 官方來源 | version.h 定義 |
| --- | --- | --- |
| 2026.6.2 | [官方 Release](https://github.com/betaflight/betaflight/releases/tag/2026.6.2)，`e0b7bb01b17b21351057e9ead2d1ab39dd44fa16` | YEAR=2026、MONTH=6、PATCH_LEVEL=2，無 suffix |
| 2026.6.1 | [官方 Release](https://github.com/betaflight/betaflight/releases/tag/2026.6.1)，`6dbc4218fd6bc33bf16ea32c670304d4f89321d5` | YEAR=2026、MONTH=6、PATCH_LEVEL=1，無 suffix |
| 2026.12.0-alpha | [官方固定開發來源](https://github.com/betaflight/betaflight/blob/1b53ace8356cc43f3c8359ed2357255ba789ca73/src/main/build/version.h) | YEAR=2026、MONTH=12、PATCH_LEVEL=0、suffix="alpha"；不是正式 Release |

預設版本為 2026.6.2。本次重新使用已保存的 Morakot 配置，在固定流程 `platform-build-v2-9` 執行 2026.6.2 編譯驗證，未勾選發布 Release。

- [本次編譯工作 37255774215](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37255774215)
- request：`ad744dde-2b8d-4b89-897e-a7055ece2efd`
- config commit：`56bb0f83c4493fae310b4b2938c18d2854d44dae`
- 結果：Success。配置驗證 25 秒、編譯 1 分 19 秒，總計 1 分 50 秒；publish 跳過。
- [編譯成功畫面](../output/betaflight-2026.6.2-build-success.png)

瀏覽器亦確認既有 [2026.6.2 工作](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136105116) 與 [2026.6.1 工作](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37136112614) 均為 Success。
