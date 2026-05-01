// Edge function: google-reviews
// Busca avaliações do Google Places API (New) e devolve no formato esperado pelo GoogleReviewsCarousel.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface OutReview {
  author: string;
  photo: string | null;
  profileUrl: string | null;
  rating: number;
  text: string;
  relativeTime: string;
  publishTime: string | null;
}

interface OutResponse {
  placeName: string | null;
  averageRating: number | null;
  totalRatings: number | null;
  reviews: OutReview[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const placeId = Deno.env.get('GOOGLE_PLACE_ID');
    if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY ausente');
    if (!placeId) throw new Error('GOOGLE_PLACE_ID ausente');

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'displayName,rating,userRatingCount,reviews',
      },
    });

    const raw = await resp.text();
    if (!resp.ok) {
      console.error('[google-reviews] Places API error', resp.status, raw);
      return new Response(
        JSON.stringify({ error: `Places API ${resp.status}`, details: raw.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = JSON.parse(raw);
    const reviews: OutReview[] = Array.isArray(data?.reviews)
      ? data.reviews.map((r: any) => ({
          author: r?.authorAttribution?.displayName ?? 'Anônimo',
          photo: r?.authorAttribution?.photoUri ?? null,
          profileUrl: r?.authorAttribution?.uri ?? null,
          rating: typeof r?.rating === 'number' ? r.rating : 0,
          text: r?.text?.text ?? r?.originalText?.text ?? '',
          relativeTime: r?.relativePublishTimeDescription ?? '',
          publishTime: r?.publishTime ?? null,
        }))
      : [];

    const out: OutResponse = {
      placeName: data?.displayName?.text ?? null,
      averageRating: typeof data?.rating === 'number' ? data.rating : null,
      totalRatings: typeof data?.userRatingCount === 'number' ? data.userRatingCount : null,
      reviews,
    };

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'erro';
    console.error('[google-reviews] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});