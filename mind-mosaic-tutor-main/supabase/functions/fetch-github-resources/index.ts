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

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    
    console.log('Fetching GitHub repositories for topic:', topic);

    // Search for repositories
    const searchQuery = `${topic} tutorial example`;
    const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${maxResults}`;

    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Lovable-AI-Tutor',
    };

    // Add token if available for higher rate limits
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    const response = await fetch(githubUrl, { headers });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('GitHub API error:', error);
      throw new Error(`GitHub API error: ${error}`);
    }

    const data = await response.json();

    // Format the results
    const repositories = data.items.map((repo: any) => ({
      type: 'code',
      source: 'github',
      title: repo.name,
      description: repo.description || 'No description available',
      url: repo.html_url,
      metadata: {
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        updatedAt: repo.updated_at,
        owner: repo.owner.login,
        topics: repo.topics || [],
      }
    }));

    console.log(`Found ${repositories.length} GitHub repositories for topic: ${topic}`);

    return new Response(
      JSON.stringify({ success: true, resources: repositories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-github-resources:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
