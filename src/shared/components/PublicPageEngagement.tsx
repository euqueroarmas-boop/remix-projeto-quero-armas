import { Eye, Share2 } from 'lucide-react';
import { ShareButton } from '@/shared/components/ShareButton';
import { usePageEngagement } from '@/shared/lib/pageEngagement';

type PublicPageEngagementProps = {
  pageKey: string;
  title: string;
  pageType?: string;
  shareLabel?: string;
  shareText?: string;
  className?: string;
  countsClassName?: string;
  buttonClassName?: string;
};

export function PublicPageEngagement({
  pageKey,
  title,
  pageType = 'page',
  shareLabel = 'Compartilhar',
  shareText,
  className = '',
  countsClassName = 'text-xs text-muted-foreground',
  buttonClassName = '',
}: PublicPageEngagementProps) {
  const { counts, registerShare } = usePageEngagement({
    pageKey,
    pageType,
    title,
  });

  return (
    <div className={`flex flex-col gap-3 ${className}`.trim()}>
      <ShareButton
        label={shareLabel}
        size="lg"
        variant="outline"
        className={buttonClassName}
        shareText={shareText}
        includeTextInShare={Boolean(shareText)}
        onShareSuccess={registerShare}
      />
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${countsClassName}`.trim()}>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="size-3.5" />
          {counts.views} visualizações
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Share2 className="size-3.5" />
          {counts.shares} compartilhamentos
        </span>
      </div>
    </div>
  );
}
