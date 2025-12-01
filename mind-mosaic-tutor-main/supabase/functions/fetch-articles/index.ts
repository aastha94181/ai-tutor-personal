import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, maxResults = 5 } = await req.json();

    if (!topic) {
      throw new Error('Topic is required');
    }

    console.log('Fetching articles for topic:', topic);

    const articles = [];

    // Fetch from Dev.to API
    try {
      const devToUrl = `https://dev.to/api/articles?tag=${encodeURIComponent(topic)}&per_page=${Math.min(maxResults, 3)}`;
      const devToResponse = await fetch(devToUrl);
      
      if (devToResponse.ok) {
        const devToData = await devToResponse.json();
        const devToArticles = devToData.map((article: any) => ({
          type: 'article',
          source: 'dev.to',
          title: article.title,
          description: article.description || article.title,
          url: article.url,
          thumbnail_url: article.cover_image || article.social_image,
          metadata: {
            author: article.user.name,
            publishedAt: article.published_at,
            readTimeMinutes: article.reading_time_minutes,
            tags: article.tag_list,
            reactions: article.public_reactions_count,
          }
        }));
        articles.push(...devToArticles);
      }
    } catch (error) {
      console.error('Dev.to fetch error:', error);
    }

    // Fetch from Wikipedia API
    try {
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
      const wikiResponse = await fetch(wikiUrl);
      
      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        if (wikiData.type !== 'disambiguation') {
          articles.push({
            type: 'documentation',
            source: 'wikipedia',
            title: wikiData.title,
            description: wikiData.extract,
            url: wikiData.content_urls.desktop.page,
            thumbnail_url: wikiData.thumbnail?.source,
            metadata: {
              pageId: wikiData.pageid,
              lastModified: wikiData.timestamp,
            }
          });
        }
      }
    } catch (error) {
      console.error('Wikipedia fetch error:', error);
    }

    // Fetch additional articles using a generic search approach
    try {
      // Search for programming articles on Medium via RSS
      const mediumRssUrl = `https://medium.com/feed/tag/${encodeURIComponent(topic)}`;
      const mediumResponse = await fetch(mediumRssUrl);
      
      if (mediumResponse.ok) {
        const rssText = await mediumResponse.text();
        // Parse RSS (simple extraction)
        const itemMatches = rssText.matchAll(/<item>[\s\S]*?<\/item>/g);
        let count = 0;
        for (const match of itemMatches) {
          if (count >= 2) break;
          const item = match[0];
          const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
          
          if (titleMatch && linkMatch) {
            articles.push({
              type: 'article',
              source: 'medium',
              title: titleMatch[1],
              description: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').substring(0, 200) : '',
              url: linkMatch[1],
              metadata: {}
            });
            count++;
          }
        }
      }
    } catch (error) {
      console.error('Medium fetch error:', error);
    }

    console.log(`Found ${articles.length} articles for topic: ${topic}`);

    // Limit to maxResults
    const limitedArticles = articles.slice(0, maxResults);

    return new Response(
      JSON.stringify({ success: true, resources: limitedArticles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-articles:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
