import { useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, BookOpenIcon, PhotoIcon, VideoCameraIcon, MicrophoneIcon, FilmIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import type { StudioTab } from '../lib/types';

const tabs: { id: StudioTab; label: string; path: string; adminOnly?: boolean }[] = [
  { id: 'home', label: 'Home', path: '/home' },
  { id: 'curriculum', label: 'Curriculum', path: '/curriculum' },
  { id: 'images', label: 'Illustrations', path: '/images' },
  { id: 'video', label: 'Video', path: '/video' },
  { id: 'audio', label: 'Audio', path: '/audio' },
  { id: 'episodes', label: 'Episodes', path: '/episodes' },
  { id: 'admin', label: 'Admin', path: '/admin', adminOnly: true },
];

export function getActiveTab(pathname: string): StudioTab {
  if (pathname === '/home') return 'home';
  if (pathname.startsWith('/curriculum') || pathname.startsWith('/lesson/') || pathname.startsWith('/chat') || pathname.startsWith('/generator')) return 'curriculum';
  if (pathname.startsWith('/images')) return 'images';
  if (pathname.startsWith('/video')) return 'video';
  if (pathname.startsWith('/audio')) return 'audio';
  if (pathname.startsWith('/episodes')) return 'episodes';
  if (pathname.startsWith('/admin') || pathname.startsWith('/chunks')) return 'admin';
  return 'home';
}

interface HeaderTabsProps {
  isAdmin?: boolean;
}

export default function HeaderTabs({ isAdmin }: HeaderTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);

  return (
    <div className="flex items-center gap-6 -mb-px">
      {tabs
        .filter(tab => !tab.adminOnly || isAdmin)
        .map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`
                flex items-center gap-1.5 px-1 py-3 text-sm font-medium border-b-2
                transition-colors duration-200 min-h-[44px]
                ${isActive
                  ? 'border-stc-purple-500 text-stc-purple-500'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                }
              `}
            >
              {/* Icon per tab */}
              {tab.id === 'home' && <HomeIcon className="w-4 h-4" />}
              {tab.id === 'curriculum' && <BookOpenIcon className="w-4 h-4" />}
              {tab.id === 'images' && <PhotoIcon className="w-4 h-4" />}
              {tab.id === 'video' && <VideoCameraIcon className="w-4 h-4" />}
              {tab.id === 'audio' && <MicrophoneIcon className="w-4 h-4" />}
              {tab.id === 'episodes' && <FilmIcon className="w-4 h-4" />}
              {tab.id === 'admin' && <Cog6ToothIcon className="w-4 h-4" />}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
    </div>
  );
}
