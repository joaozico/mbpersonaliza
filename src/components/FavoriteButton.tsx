import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { StorageService } from '../services/storage';
import { UserProfile } from '../types';

export interface FavoriteButtonProps {
  productId: string;
  productName?: string;
  currentUser?: UserProfile;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  onRequireLogin?: () => void;
  onToggle?: (isFav: boolean) => void;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  productId,
  productName,
  currentUser,
  size = 'md',
  className = '',
  showText = false,
  onRequireLogin,
  onToggle,
}) => {
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    return StorageService.isProductFavorite(productId, currentUser?.id);
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state when favorites change anywhere in the app
  useEffect(() => {
    const handleFavoritesUpdate = (e: any) => {
      const detail = e?.detail;
      if (detail && detail.productId === productId) {
        setIsFavorite(detail.isFavorite);
      } else if (detail && Array.isArray(detail.favorites)) {
        setIsFavorite(detail.favorites.includes(productId));
      } else {
        setIsFavorite(StorageService.isProductFavorite(productId, currentUser?.id));
      }
    };

    window.addEventListener('mb_favorites_updated', handleFavoritesUpdate);
    window.addEventListener('mb_storage_updated', handleFavoritesUpdate);

    return () => {
      window.removeEventListener('mb_favorites_updated', handleFavoritesUpdate);
      window.removeEventListener('mb_storage_updated', handleFavoritesUpdate);
    };
  }, [productId, currentUser?.id]);

  const isLoggedIn = Boolean(
    currentUser &&
    currentUser.id &&
    currentUser.role !== 'visitante'
  );

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If user is not logged in, prompt login
    if (!isLoggedIn) {
      if (onRequireLogin) {
        onRequireLogin();
      } else {
        setToastMessage('Faça login para salvar seus produtos favoritos');
        setTimeout(() => setToastMessage(null), 3000);
      }
      return;
    }

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 400);

    const result = StorageService.toggleProductFavorite(productId, currentUser?.id);
    setIsFavorite(result.isFavorite);
    if (onToggle) onToggle(result.isFavorite);

    // Subtle feedback message
    const msg = result.isFavorite
      ? `"${productName || 'Produto'}" adicionado aos favoritos!`
      : `Removido dos favoritos`;
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  // Dimensions based on size
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  const buttonPaddings = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  }[size];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        className={`group flex items-center gap-1.5 rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 ${buttonPaddings} ${
          isFavorite
            ? 'bg-pink-50 text-[#E6007E] border border-pink-200 hover:bg-pink-100 shadow-xs'
            : 'bg-white/90 backdrop-blur-xs text-slate-500 hover:text-[#E6007E] border border-slate-200/90 hover:border-pink-200 hover:bg-white shadow-2xs'
        } ${isAnimating ? 'scale-125' : 'hover:scale-105 active:scale-95'} ${className}`}
        title={
          !isLoggedIn
            ? 'Faça login para salvar nos Favoritos'
            : isFavorite
            ? 'Remover dos Favoritos'
            : 'Salvar nos Favoritos'
        }
        aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <Heart
          className={`${iconSizes} transition-colors duration-200 ${
            isFavorite
              ? 'fill-[#E6007E] text-[#E6007E]'
              : 'text-slate-500 group-hover:text-[#E6007E]'
          }`}
        />
        {showText && (
          <span className="text-xs font-bold whitespace-nowrap">
            {isFavorite ? 'Favorito' : 'Favoritar'}
          </span>
        )}
      </button>

      {/* Floating Mini Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap px-2.5 py-1 text-[11px] font-bold text-white bg-slate-900 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-1 pointer-events-none">
          {toastMessage}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
