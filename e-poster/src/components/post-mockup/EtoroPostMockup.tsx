'use client';

import { Heart, MessageCircle, Share2 } from 'lucide-react';

export interface EtoroPostMockupProps {
  username: string;
  content: string;
  imageUrl?: string;
  badge?: string;
  timestamp?: string;
}

function formatContent(text: string) {
  const parts: Array<{ type: 'text' | 'ticker' | 'mention' | 'link'; value: string }> = [];
  const regex = /(\$[A-Z]{1,10})|(@[\w-]+)|(https?:\/\/\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      parts.push({ type: 'ticker', value: match[1] });
    } else if (match[2]) {
      parts.push({ type: 'mention', value: match[2] });
    } else if (match[3]) {
      parts.push({ type: 'link', value: match[3] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

function getInitials(username: string): string {
  const clean = username.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(0, 2).toUpperCase();
}

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#2563eb',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export function EtoroPostMockup({
  username,
  content,
  imageUrl,
  badge = 'Smart Portfolio',
  timestamp,
}: EtoroPostMockupProps) {
  const displayTimestamp = timestamp || 'Just now';

  const lines = content.split('\n');

  return (
    <div className="max-w-[480px] mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: getAvatarColor(username) }}
        >
          {getInitials(username)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900">
              @{username}
            </span>
            {badge && (
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{displayTimestamp}</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-2 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
        {lines.map((line, lineIdx) => (
          <span key={lineIdx}>
            {lineIdx > 0 && '\n'}
            {formatContent(line).map((part, partIdx) => {
              switch (part.type) {
                case 'ticker':
                  return (
                    <span
                      key={partIdx}
                      className="font-semibold text-blue-600"
                    >
                      {part.value}
                    </span>
                  );
                case 'mention':
                  return (
                    <span
                      key={partIdx}
                      className="font-semibold text-blue-600"
                    >
                      {part.value}
                    </span>
                  );
                case 'link':
                  return (
                    <span
                      key={partIdx}
                      className="text-blue-500 underline break-all"
                    >
                      {part.value}
                    </span>
                  );
                default:
                  return <span key={partIdx}>{part.value}</span>;
              }
            })}
          </span>
        ))}
      </div>

      {/* Attached Image */}
      {imageUrl && (
        <div className="mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Post attachment"
            className="w-full object-cover max-h-[400px]"
          />
        </div>
      )}

      {/* Engagement Bar */}
      <div className="flex items-center gap-6 px-4 py-3 border-t border-gray-100 text-gray-500">
        <button className="flex items-center gap-1.5 text-xs hover:text-red-500 transition-colors">
          <Heart className="h-4 w-4" />
          <span>0</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs hover:text-blue-500 transition-colors">
          <MessageCircle className="h-4 w-4" />
          <span>0</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs hover:text-green-500 transition-colors">
          <Share2 className="h-4 w-4" />
          <span>0</span>
        </button>
      </div>
    </div>
  );
}
