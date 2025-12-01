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
    const { taskId, topicId, topic, difficultyLevel = 'beginner' } = await req.json();

    if (!taskId || !topic) {
      throw new Error('Task ID and topic are required');
    }

    console.log(`Fetching resources for task ${taskId}, topic: ${topic}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const allResources = [];

    // Fetch YouTube videos
    try {
      const youtubeResponse = await supabase.functions.invoke('fetch-youtube-resources', {
        body: { topic, maxResults: 3 }
      });
      
      if (youtubeResponse.data?.resources) {
        allResources.push(...youtubeResponse.data.resources.map((r: any) => ({
          ...r,
          difficulty_level: difficultyLevel,
        })));
      }
    } catch (error) {
      console.error('Error fetching YouTube resources:', error);
    }

    // Fetch GitHub repositories (only for programming topics)
    const programmingKeywords = ['programming', 'code', 'software', 'development', 'javascript', 'python', 'java', 'react', 'node', 'web', 'app'];
    const isProgrammingTopic = programmingKeywords.some(keyword => 
      topic.toLowerCase().includes(keyword)
    );

    if (isProgrammingTopic) {
      try {
        const githubResponse = await supabase.functions.invoke('fetch-github-resources', {
          body: { topic, maxResults: 5 }
        });
        
        if (githubResponse.data?.resources) {
          allResources.push(...githubResponse.data.resources.map((r: any) => ({
            ...r,
            difficulty_level: difficultyLevel,
          })));
        }
      } catch (error) {
        console.error('Error fetching GitHub resources:', error);
      }
    }

    // Fetch articles
    try {
      const articlesResponse = await supabase.functions.invoke('fetch-articles', {
        body: { topic, maxResults: 5 }
      });
      
      if (articlesResponse.data?.resources) {
        allResources.push(...articlesResponse.data.resources.map((r: any) => ({
          ...r,
          difficulty_level: difficultyLevel,
        })));
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    }

    console.log(`Fetched ${allResources.length} total resources`);

    // Store resources in database
    const resourceRecords = allResources.map(resource => ({
      task_id: taskId,
      topic_id: topicId || null,
      type: resource.type,
      title: resource.title,
      url: resource.url,
      source: resource.source,
      description: resource.description || '',
      difficulty_level: resource.difficulty_level,
      thumbnail_url: resource.thumbnail_url,
      duration: resource.duration,
      metadata: resource.metadata || {},
    }));

    if (resourceRecords.length > 0) {
      const { data: insertedResources, error: insertError } = await supabase
        .from('resources')
        .insert(resourceRecords)
        .select();

      if (insertError) {
        console.error('Error inserting resources:', insertError);
        throw insertError;
      }

      // Update task resource count
      await supabase
        .from('tasks')
        .update({ resource_count: resourceRecords.length })
        .eq('id', taskId);

      console.log(`Successfully stored ${insertedResources.length} resources`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        resourceCount: allResources.length,
        resources: allResources 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-resources:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
