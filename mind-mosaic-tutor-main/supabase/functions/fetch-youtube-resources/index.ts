import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, maxResults = 3 } = await req.json();

    if (!topic) {
      throw new Error('Topic is required');
    }

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not configured");
    }

    console.log('Fetching YouTube videos for topic:', topic);

    // Search for educational videos
    const searchQuery = `${topic} tutorial educational`;
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&videoCategoryId=27&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(youtubeUrl);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('YouTube API error:', error);
      throw new Error(`YouTube API error: ${error}`);
    }

    const data = await response.json();

    // Get video details including duration
    const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    // Format the results
    const videos = data.items.map((item: any, index: number) => {
      const details = detailsData.items[index];
      return {
        type: 'video',
        source: 'youtube',
        title: item.snippet.title,
        description: item.snippet.description,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        thumbnail_url: item.snippet.thumbnails.high.url,
        duration: details?.contentDetails?.duration || 'Unknown',
        metadata: {
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          viewCount: details?.statistics?.viewCount || 0,
        }
      };
    });

    console.log(`Found ${videos.length} YouTube videos for topic: ${topic}`);

    return new Response(
      JSON.stringify({ success: true, resources: videos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-youtube-resources:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
