import React from 'react';
import { useAtlasSettings } from '../../../keyboard/useMapHotkeys';
import { PIN_TITLE_SIZES } from '../../../tools/pinTitle';
import { SettingSliderRow, SettingToggleRow } from './SettingRows';
import { t } from '../../../i18n';

/** How pins show the note they open, for every map. */
export function PinSettingsPanel(): React.ReactElement {
  const settings = useAtlasSettings();
  const showTitles = settings?.getShowPinTitles() ?? false;
  const headingOnly = settings?.getPinTitleHeadingOnly() ?? false;
  const size = settings?.getPinTitleSize() ?? PIN_TITLE_SIZES.normal;

  return (
    <div className="atlas-command-palette-panel">
      <div className="atlas-command-palette-panel-column">
        <h3 className="atlas-command-palette-panel-heading">{t('palette.panel.pins')}</h3>
        <SettingToggleRow
          label={t('palette.pins.showTitles')}
          hint={t('palette.pins.showTitlesHint')}
          value={showTitles}
          onToggle={() => settings?.setShowPinTitles(!showTitles)}
        />
        {showTitles && (
          <SettingToggleRow
            label={t('palette.pins.headingOnly')}
            hint={t('palette.pins.headingOnlyHint')}
            value={headingOnly}
            onToggle={() => settings?.setPinTitleHeadingOnly(!headingOnly)}
          />
        )}
        {showTitles && (
          <SettingSliderRow
            label={t('palette.pins.titleSize')}
            value={size}
            min={PIN_TITLE_SIZES.min}
            max={PIN_TITLE_SIZES.max}
            step={PIN_TITLE_SIZES.step}
            displayValue={`${Math.round(size * 100)}%`}
            onChange={(next) => settings?.setPinTitleSize(next)}
          />
        )}
      </div>
    </div>
  );
}
