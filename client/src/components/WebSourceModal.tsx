import { useState, useEffect, useRef } from 'react';
import { BuildingLibraryIcon, AcademicCapIcon, SunIcon, GlobeAltIcon, ComputerDesktopIcon, ShieldCheckIcon, BookOpenIcon, XMarkIcon, LightBulbIcon, MagnifyingGlassIcon, ArrowTopRightOnSquareIcon, CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface WebSourceModalProps {
  source: string;
  region?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Comprehensive source type detection with detailed descriptions
function getSourceInfo(source: string): {
  type: string;
  icon: JSX.Element;
  color: string;
  description: string;
  searchSuggestions: string[];
  authorityLevel: 'official' | 'academic' | 'industry' | 'general';
} {
  const lowerSource = source.toLowerCase();

  if (lowerSource.includes('ministry') || lowerSource.includes('government') || lowerSource.includes('national')) {
    return {
      type: 'Government Authority',
      icon: <BuildingLibraryIcon className="w-6 h-6" />,
      color: 'text-stc-blue bg-stc-blue/10 border-stc-blue/20',
      description: 'This is an official government source that sets national education policies, curriculum standards, and content guidelines. Government sources provide the highest level of regulatory authority for educational content.',
      searchSuggestions: [
        'official website',
        'education policy',
        'curriculum guidelines',
        'content standards',
      ],
      authorityLevel: 'official',
    };
  }

  if (lowerSource.includes('cbse') || lowerSource.includes('ncert')) {
    return {
      type: 'National Education Board',
      icon: <AcademicCapIcon className="w-6 h-6" />,
      color: 'text-stc-green bg-stc-green/10 border-emerald-200',
      description: 'This is an official education board that governs curriculum standards, textbook content, and examination systems. These boards set mandatory requirements for all educational materials used in schools.',
      searchSuggestions: [
        'curriculum framework',
        'textbook guidelines',
        'content norms',
        'syllabus requirements',
      ],
      authorityLevel: 'official',
    };
  }

  if (lowerSource.includes('education') || lowerSource.includes('curriculum') || lowerSource.includes('school') || lowerSource.includes('academic')) {
    return {
      type: 'Educational Institution',
      icon: <AcademicCapIcon className="w-6 h-6" />,
      color: 'text-stc-green bg-stc-green/10 border-stc-green/20',
      description: 'Educational institutions and academic bodies provide research-backed guidelines for age-appropriate content, pedagogical approaches, and curriculum design best practices.',
      searchSuggestions: [
        'research papers',
        'educational guidelines',
        'pedagogy best practices',
        'child development',
      ],
      authorityLevel: 'academic',
    };
  }

  if (lowerSource.includes('islamic') || lowerSource.includes('halal') || lowerSource.includes('religious') || lowerSource.includes('fatwa')) {
    return {
      type: 'Religious Authority',
      icon: <SunIcon className="w-6 h-6" />,
      color: 'text-stc-orange bg-stc-orange/10 border-stc-orange/20',
      description: 'Religious authorities provide guidance on content that aligns with religious values, dietary requirements, and cultural practices. These guidelines are essential for content used in faith-based communities.',
      searchSuggestions: [
        'content guidelines',
        'permissible content',
        'religious education',
        'values alignment',
      ],
      authorityLevel: 'official',
    };
  }

  if (lowerSource.includes('cultural') || lowerSource.includes('heritage') || lowerSource.includes('tradition')) {
    return {
      type: 'Cultural Heritage',
      icon: <GlobeAltIcon className="w-6 h-6" />,
      color: 'text-stc-purple-600 bg-stc-purple-50 border-purple-200',
      description: 'Cultural heritage sources document traditional practices, historical context, and societal norms that inform how educational content should be adapted for local audiences.',
      searchSuggestions: [
        'cultural practices',
        'traditional values',
        'local customs',
        'heritage education',
      ],
      authorityLevel: 'industry',
    };
  }

  if (lowerSource.includes('media') || lowerSource.includes('broadcast') || lowerSource.includes('content rating')) {
    return {
      type: 'Media Regulatory Body',
      icon: <ComputerDesktopIcon className="w-6 h-6" />,
      color: 'text-stc-pink bg-stc-pink/10 border-rose-200',
      description: 'Media regulatory bodies set standards for content ratings, age-appropriateness, and broadcast guidelines. These standards often apply to educational media and digital content.',
      searchSuggestions: [
        'content rating system',
        'age classification',
        'broadcast standards',
        'media guidelines',
      ],
      authorityLevel: 'official',
    };
  }

  if (lowerSource.includes('child') || lowerSource.includes('protection') || lowerSource.includes('safety')) {
    return {
      type: 'Child Safety Authority',
      icon: <ShieldCheckIcon className="w-6 h-6" />,
      color: 'text-stc-green bg-stc-green/10 border-teal-200',
      description: 'Child protection and safety authorities establish guidelines for age-appropriate content, online safety, and child welfare standards that educational materials must follow.',
      searchSuggestions: [
        'child safety standards',
        'protection guidelines',
        'age-appropriate content',
        'welfare requirements',
      ],
      authorityLevel: 'official',
    };
  }

  // Default for unrecognized sources
  return {
    type: 'Reference Source',
    icon: <BookOpenIcon className="w-6 h-6" />,
    color: 'text-neutral-600 bg-neutral-50 border-neutral-200',
    description: 'This reference source provides contextual information used to inform cultural adaptation guidelines for the Acme Creative curriculum.',
    searchSuggestions: [
      'official website',
      'documentation',
      'guidelines',
      'standards',
    ],
    authorityLevel: 'general',
  };
}

function getAuthorityBadge(level: 'official' | 'academic' | 'industry' | 'general') {
  const configs = {
    official: { label: 'Official Authority', className: 'bg-stc-blue/15 text-stc-navy border-stc-blue/30' },
    academic: { label: 'Academic Source', className: 'bg-stc-green/15 text-stc-green border-stc-green/30' },
    industry: { label: 'Industry Standard', className: 'bg-stc-purple-100 text-stc-purple-700 border-purple-300' },
    general: { label: 'Reference', className: 'bg-neutral-100 text-neutral-700 border-neutral-300' },
  };
  return configs[level];
}

export default function WebSourceModal({ source, region, isOpen, onClose }: WebSourceModalProps) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sourceInfo = getSourceInfo(source);
  const authorityBadge = getAuthorityBadge(sourceInfo.authorityLevel);

  // Close on escape + scroll viewport and content to top when opened
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      // Scroll viewport to top so modal is visible
      window.scrollTo(0, 0);
      // Scroll modal content to top
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build search URLs
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(source + (region ? ` ${region}` : ''))}`;
  const googleScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(source + ' education guidelines')}`;
  const wikipediaUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(source)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-[95vw] sm:max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-4 sm:px-6 py-4 sm:py-5 border-b ${sourceInfo.color.split(' ')[1]} flex items-start justify-between`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${sourceInfo.color} border`}>
              {sourceInfo.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${authorityBadge.className}`}>
                  {authorityBadge.label}
                </span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 leading-tight">
                {source}
              </h3>
              <p className="text-sm text-neutral-500 mt-0.5">
                {sourceInfo.type} {region && `• ${region}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-neutral-200 active:bg-neutral-300 transition-colors -mr-1 -mt-1"
          >
            <XMarkIcon className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1">
          {/* About This Source */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-2">
              About This Source
            </h4>
            <p className="text-sm text-neutral-600 leading-relaxed">
              {sourceInfo.description}
            </p>
          </div>

          {/* Why It Matters */}
          <div className="mb-6 p-4 bg-stc-purple-50 rounded-xl border border-stc-purple-100">
            <h4 className="text-sm font-bold text-stc-purple-900 mb-2 flex items-center gap-2">
              <LightBulbIcon className="w-4 h-4" />
              Why This Matters for Cultural Adaptation
            </h4>
            <p className="text-sm text-stc-purple-800 leading-relaxed">
              {sourceInfo.authorityLevel === 'official' &&
                'Official sources set mandatory requirements that educational content must follow. Non-compliance could result in content being rejected for use in schools or institutions.'}
              {sourceInfo.authorityLevel === 'academic' &&
                'Academic sources provide research-backed best practices for effective cross-cultural education. Following these guidelines improves learning outcomes.'}
              {sourceInfo.authorityLevel === 'industry' &&
                'Industry standards ensure your content aligns with cultural expectations and avoids unintentional offense or miscommunication.'}
              {sourceInfo.authorityLevel === 'general' &&
                'Reference sources provide valuable context for understanding local norms and expectations for educational content.'}
            </p>
          </div>

          {/* Suggested Research */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3">
              Research This Source
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sourceInfo.searchSuggestions.map((suggestion, i) => (
                <a
                  key={i}
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${source} ${suggestion}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-lg text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 text-neutral-400 group-hover:text-stc-purple-500 transition-colors" />
                  {suggestion}
                  <ArrowTopRightOnSquareIcon className="w-3 h-3 text-neutral-300 group-hover:text-stc-purple-400 ml-auto" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="px-4 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-100">
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-stc-purple-500 hover:bg-stc-purple-600 active:bg-stc-purple-700 text-white font-semibold rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              Search on Google
            </a>
            <a
              href={googleScholarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white hover:bg-neutral-100 active:bg-neutral-200 text-neutral-700 font-medium rounded-xl border border-neutral-200 transition-colors"
            >
              <BookOpenIcon className="w-5 h-5" />
              Google Scholar
            </a>
            <button
              onClick={handleCopy}
              className="sm:w-auto flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white hover:bg-neutral-100 active:bg-neutral-200 text-neutral-700 font-medium rounded-xl border border-neutral-200 transition-colors"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-5 h-5 text-stc-green" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-5 h-5" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
