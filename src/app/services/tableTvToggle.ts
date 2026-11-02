import type { PlayerWindowService } from './PlayerWindowService';
import type { SettingsService } from './SettingsService';
import { setupOf } from './tableTvDevice';
import { showNotice } from '../ui/notice';
import { t } from '../i18n';

/**
 * Switches TrueScale on or off for the TV the player window is on, and says which. Without an open
 * window there is no TV, and one that is not measured yet cannot show true scale: the GM is told.
 */
export function toggleTrueScale(settings: SettingsService, service: PlayerWindowService | null): void {
  const key = service?.isWindowOpen() ? service.setupScreenKey() : null;
  if (!key) {
    showNotice(t('palette.noPlayerWindow'));
    return;
  }
  const device = settings.getTableTvDevice();
  if (!setupOf(device, key)) {
    showNotice(t('tableTv.trueScaleNeedsSetup'));
    return;
  }
  settings.setTableTvDevice({ trueScale: !device.trueScale });
  showNotice(t(device.trueScale ? 'tableTv.trueScaleOff' : 'tableTv.trueScaleOn'));
}
