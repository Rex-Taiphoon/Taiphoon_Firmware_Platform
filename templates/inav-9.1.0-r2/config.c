/* Taiphoon Morakot board overlay for INAV 9.1.0. SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdint.h>
#include "platform.h"
#include "io/serial.h"
#include "sensors/battery.h"

void targetConfiguration(void)
{
    const int gps = findSerialPortIndexByIdentifier(SERIAL_PORT_USART5);
    serialConfigMutable()->portConfigs[gps].functionMask = FUNCTION_GPS;
    serialConfigMutable()->portConfigs[gps].gps_baudrateIndex = BAUD_115200;
    // Betaflight scale 210 (divider 10) equals INAV scale 2100; calibrate the actual power module.
    batteryMetersConfigMutable()->voltage.scale = 2100;
}
