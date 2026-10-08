import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { CompanySettings } from '../types';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'light' | 'dark';
  layout?: 'horizontal' | 'stacked' | 'icon-only';
  showSubtitle?: boolean;
  className?: string;
  customSettings?: CompanySettings;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'light',
  layout = 'horizontal',
  showSubtitle = false,
  className = '',
  customSettings,
}) => {
  const [storedSettings, setStoredSettings] = useState<CompanySettings>(() =>
    StorageService.getCompanySettings()
  );

  useEffect(() => {
    if (customSettings) return;

    let isMounted = true;
    const handleUpdate = () => {
      setTimeout(() => {
        if (isMounted) {
          setStoredSettings(StorageService.getCompanySettings());
        }
      }, 0);
    };

    window.addEventListener('mb_storage_updated', handleUpdate);
    window.addEventListener('mb_company_settings_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('mb_storage_updated', handleUpdate);
      window.removeEventListener('mb_company_settings_updated', handleUpdate);
    };
  }, [customSettings]);

  const settings = customSettings || storedSettings;

  const textColor = variant === 'dark' ? '#FFFFFF' : '#111111';
  const subColor = variant === 'dark' ? 'text-slate-400' : 'text-slate-500';

  // Dimensions based on size and layout
  const dimensions = {
    sm: { iconWidth: 42, iconHeight: 26, fontSize: 'text-lg', subSize: 'text-[9px]' },
    md: { iconWidth: 54, iconHeight: 33, fontSize: 'text-xl', subSize: 'text-[10px]' },
    lg: { iconWidth: 76, iconHeight: 46, fontSize: 'text-2xl', subSize: 'text-xs' },
    xl: { iconWidth: 100, iconHeight: 60, fontSize: 'text-3xl', subSize: 'text-sm' },
    '2xl': { iconWidth: 160, iconHeight: 96, fontSize: 'text-5xl', subSize: 'text-base' },
  }[size];

  const activeCustomUrl =
    variant === 'dark' && settings.logoDarkUrl && settings.logoDarkUrl.trim().length > 0
      ? settings.logoDarkUrl
      : settings.logoUrl;

  const hasCustomImage =
    settings.logoType === 'custom_image' &&
    activeCustomUrl &&
    activeCustomUrl.trim().length > 0;

  const [imgError, setImgError] = useState(false);

  // Reset img error on url change
  useEffect(() => {
    setImgError(false);
  }, [activeCustomUrl, settings.logoType]);

  // Primary color for branding accent
  const primaryBrandColor = settings.primaryColor || '#E6007E';

  // SVG Emblem precisely matching the official MB Personaliza logo:
  const EmblemSVG = ({ width, height }: { width: number; height: number }) => {
    if (hasCustomImage && !imgError) {
      return (
        <img
          src={activeCustomUrl}
          alt={settings.name}
          onError={() => setImgError(true)}
          className="object-contain shrink-0 rounded-md max-h-full transition-transform hover:scale-105"
          style={{ width: 'auto', maxWidth: width * 1.5, maxHeight: height * 1.3, height: 'auto' }}
        />
      );
    }

    return (
      <svg
        viewBox="0 0 240 144"
        width={width}
        height={height}
        className="shrink-0 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Black Letter "M" */}
        <path
          d="M 10 140 L 10 20 L 44 20 L 64 80 L 84 20 L 118 20 L 118 140 L 92 140 L 92 65 L 75 116 L 53 116 L 36 65 L 36 140 Z"
          fill="#111111"
        />

        {/* Black Letter "B" */}
        <path
          d="M 124 20 L 190 20 C 215 20 230 32 230 52 C 230 65 222 75 210 80 C 226 86 234 98 234 114 C 234 135 216 140 190 140 L 124 140 Z M 154 44 L 154 68 L 184 68 C 195 68 202 63 202 56 C 202 49 195 44 184 44 Z M 154 90 L 154 116 L 188 116 C 199 116 206 110 206 103 C 206 96 199 90 188 90 Z"
          fill="#111111"
        />

        {/* 1. White Ceramic Mug with Handle & Black Outline */}
        <g transform="translate(18, 28)">
          <rect x="10" y="8" width="38" height="42" rx="6" fill="#FFFFFF" stroke="#111111" strokeWidth="4.5" />
          <ellipse cx="29" cy="8" rx="19" ry="5.5" fill="#F8FAFC" stroke="#111111" strokeWidth="4" />
          <ellipse cx="29" cy="8" rx="14" ry="3.5" fill="#E2E8F0" />
          <path
            d="M 48 16 C 62 16 62 42 48 42"
            fill="none"
            stroke="#111111"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 48 20 C 56 20 56 38 48 38"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* 2. Magenta Gift Box (#E6007E) with Ribbon and Bow */}
        <g transform="translate(85, 48)">
          <rect x="4" y="22" width="46" height="40" rx="3" fill="#E6007E" stroke="#111111" strokeWidth="4" />
          <rect x="1" y="14" width="52" height="11" rx="2.5" fill="#E6007E" stroke="#111111" strokeWidth="4" />
          <rect x="23" y="14" width="8" height="48" fill="#111111" />
          <path
            d="M 27 14 C 18 2 10 8 20 14 C 10 14 16 0 27 14 Z"
            fill="#E6007E"
            stroke="#111111"
            strokeWidth="3.5"
          />
          <path
            d="M 27 14 C 36 2 44 8 34 14 C 44 14 38 0 27 14 Z"
            fill="#E6007E"
            stroke="#111111"
            strokeWidth="3.5"
          />
          <circle cx="27" cy="14" r="4.5" fill="#FF2A9D" stroke="#111111" strokeWidth="2.5" />
        </g>

        {/* 3. Cyan / Blue T-Shirt (#00AEEF) */}
        <g transform="translate(136, 16)">
          <path
            d="M 24 6 L 6 22 L 18 36 L 26 28 L 26 62 L 62 62 L 62 28 L 70 36 L 82 22 L 64 6 C 54 14 34 14 24 6 Z"
            fill="#00AEEF"
            stroke="#111111"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M 33 6 C 36 14 52 14 55 6"
            fill="none"
            stroke="#111111"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>

        {/* 4. Yellow Folded Note / Sticker Sheet */}
        <g transform="translate(162, 60)">
          <path
            d="M 4 4 L 38 4 L 48 14 L 48 48 L 4 48 Z"
            fill="#FFE600"
            stroke="#111111"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M 38 4 L 38 14 L 48 14 Z"
            fill="#FFCC00"
            stroke="#111111"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    );
  };

  const displayName = settings.name || 'MB PERSONALIZA';
  const tagline = settings.tagline || 'Brindes & Comunicação Visual';

  // Stacked Layout
  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col items-center select-none text-center ${className}`} id="mb-logo-stacked">
        <EmblemSVG width={dimensions.iconWidth * 1.6} height={dimensions.iconHeight * 1.6} />
        <span
          className={`font-black uppercase font-heading tracking-tight mt-1.5 ${
            size === 'sm'
              ? 'text-base'
              : size === 'md'
              ? 'text-xl'
              : size === 'lg'
              ? 'text-2xl'
              : size === 'xl'
              ? 'text-3xl'
              : 'text-5xl'
          }`}
          style={{ color: textColor }}
        >
          {displayName}
        </span>
        {showSubtitle && (
          <span className={`font-bold uppercase tracking-widest text-[10px] mt-0.5 ${subColor}`}>
            {tagline}
          </span>
        )}
      </div>
    );
  }

  // Icon Only Layout
  if (layout === 'icon-only') {
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`} id="mb-logo-icon">
        <EmblemSVG width={dimensions.iconWidth} height={dimensions.iconHeight} />
      </div>
    );
  }

  // Horizontal Layout
  return (
    <div className={`flex items-center gap-3 select-none ${className}`} id="mb-logo-horizontal">
      <EmblemSVG width={dimensions.iconWidth} height={dimensions.iconHeight} />

      <div className="flex flex-col leading-none">
        <div className="flex items-center">
          <span
            className={`font-heading font-black tracking-tight uppercase ${dimensions.fontSize}`}
            style={{ color: textColor }}
          >
            {displayName.includes(' ') ? (
              <>
                {displayName.split(' ')[0]}{' '}
                <span style={{ color: primaryBrandColor }}>{displayName.substring(displayName.indexOf(' ') + 1)}</span>
              </>
            ) : (
              <span style={{ color: primaryBrandColor }}>{displayName}</span>
            )}
          </span>
        </div>
        {(showSubtitle !== undefined ? showSubtitle : settings.showLogoSubtitle) ? (
          <span className={`font-semibold uppercase tracking-wider mt-0.5 ${subColor} ${dimensions.subSize} max-w-[200px] lg:max-w-[280px] xl:max-w-[340px] truncate hidden sm:inline-block`}>
            {tagline}
          </span>
        ) : (
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryBrandColor }} title="Cor Primária" />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: settings.secondaryColor || '#00AEEF' }} title="Cor Secundária" />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: settings.accentColor || '#FFE600' }} title="Cor Destaque" />
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 ml-1">
              Personalizados
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
