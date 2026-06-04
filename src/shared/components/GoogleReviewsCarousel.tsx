import { useEffect, useState } from 'react';
import Autoplay from 'embla-carousel-autoplay';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { supabase } from '@/integrations/supabase/client';
import { Star, Quote, ShieldCheck } from 'lucide-react';

interface GoogleReview {
  author: string;
  photo: string | null;
  profileUrl: string | null;
  rating: number;
  text: string;
  relativeTime: string;
  publishTime: string | null;
}

interface ReviewsResponse {
  placeName: string | null;
  averageRating: number | null;
  totalRatings: number | null;
  reviews: GoogleReview[];
}

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrelas`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`size-4 ${i < Math.round(rating) ? 'fill-accent text-accent' : 'text-muted-foreground/40'}`}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

const Avatar = ({ name, photo }: { name: string; photo: string | null }) => {
  const initials = name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-12 shrink-0 rounded-full border border-accent/40 object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-primary/20 font-heading text-sm font-bold uppercase tracking-wider text-accent">
      {initials || 'QA'}
    </div>
  );
};

export const GoogleReviewsCarousel = () => {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<ReviewsResponse>('google-reviews', { method: 'GET' });
        if (cancelled) return;
        if (error) setError(error.message);
        else if (data) setData(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'erro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const reviews = data?.reviews ?? [];
  // Se a edge function não estiver configurada (Google Places key pendente), oculta a seção sem quebrar o layout.
  if (!loading && (error || reviews.length === 0)) return null;
  const showSkeletons = loading;

  return (
    <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--accent)/0.12),transparent_60%)]" />
      <div className="mx-auto w-full max-w-full box-border px-4 sm:container sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
              <ShieldCheck className="size-3.5" />
              Provas de fogo · Operadores reais
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Cansaram de promessa vazia <span className="text-tactical-gradient">e vieram pra cá se armar de verdade.</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Cada estrela aqui embaixo é a assinatura de quem botou a cara, encarou o processo e saiu armado, treinado e dormindo de olho fechado. Direto do Google.
            </p>
          </div>
          {data?.averageRating != null && (
            <div className="flex items-center gap-4 rounded-sm border border-accent/40 bg-card/80 px-4 py-3">
              <div className="text-right">
                <div className="font-heading text-2xl font-bold text-accent sm:text-3xl">{data.averageRating.toFixed(1)}</div>
                <div className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">{data.totalRatings ?? 0} avaliações Google</div>
              </div>
              <Stars rating={data.averageRating} />
            </div>
          )}
        </div>
        <Carousel
          opts={{ align: 'start', loop: reviews.length > 1 }}
          plugins={reviews.length > 1 ? [Autoplay({ delay: 6000, stopOnInteraction: true })] : []}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {showSkeletons
              ? Array.from({ length: 3 }).map((_, i) => (
                  <CarouselItem key={i} className="pl-4 sm:basis-1/2 lg:basis-1/3">
                    <div className="h-[280px] animate-pulse rounded-sm border border-border bg-card/60" />
                  </CarouselItem>
                ))
              : reviews.map((r, i) => (
                  <CarouselItem key={`${r.author}-${i}`} className="pl-4 sm:basis-1/2 lg:basis-1/3">
                    <a
                      href={r.profileUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="group relative flex h-full flex-col gap-4 rounded-sm border border-border bg-card p-6 shadow-deep transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-tactical"
                    >
                      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-tactical opacity-70" />
                      <Quote className="size-6 text-accent/60" strokeWidth={1.5} />
                      <p className="line-clamp-6 text-sm leading-relaxed text-foreground/90">{r.text || 'Avaliação sem comentário escrito.'}</p>
                      <div className="mt-auto flex items-center gap-3 border-t border-border/60 pt-4">
                        <Avatar name={r.author} photo={r.photo} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-heading text-sm font-semibold uppercase tracking-wide text-foreground">{r.author}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <Stars rating={r.rating} />
                            {r.relativeTime && (
                              <span className="font-heading text-xs uppercase tracking-wider text-muted-foreground">· {r.relativeTime}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </a>
                  </CarouselItem>
                ))}
          </CarouselContent>
          <div className="mt-8 flex items-center justify-end gap-2">
            <CarouselPrevious className="static translate-y-0 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent" />
            <CarouselNext className="static translate-y-0 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent" />
          </div>
        </Carousel>
        <p className="mt-6 text-center font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Avaliações verificadas · Google · Quero Armas
        </p>
      </div>
    </section>
  );
};