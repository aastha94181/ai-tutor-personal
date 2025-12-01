import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], taskContext } = await req.json();

    if (!message) {
      throw new Error("Message is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build messages array for the AI
    let systemPrompt = `You are a helpful learning assistant that provides guidance through hints and examples, NOT direct answers.

Your role is to:
- Guide students to discover answers themselves through thoughtful questioning
- Provide vague examples and analogies that illustrate concepts without solving the problem
- Break down complex problems into smaller thinking steps
- Encourage critical thinking with "what if" scenarios
- Use Socratic method to lead them to understanding

What you should NEVER do:
- Give direct answers to assignment questions
- Provide complete code solutions
- Solve problems step-by-step with exact answers
- Do the work for the student

Instead of: "The answer is X"
Say: "Think about how this relates to Y. What happens when you consider Z?"

Instead of: "Here's the complete solution..."
Say: "Let's break this down. What do you think the first step might be? Consider how similar problems are approached..."

Keep responses concise (2-4 sentences) and always end with a guiding question to encourage further thinking.`;

    // Add task context if available
    if (taskContext) {
      systemPrompt += `\n\nCURRENT TASK CONTEXT:
Task: ${taskContext.title}
Description: ${taskContext.description}
Lesson Content Summary: ${taskContext.content.substring(0, 500)}...
${taskContext.question ? `Assignment Question: ${taskContext.question}` : ''}

Use this context to provide relevant hints and guidance related to the current task the student is working on.`;
    }

    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add conversation history (limit to last 10 messages for context)
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory);
    
    // Add the new user message
    messages.push({
      role: "user",
      content: message
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
          { 
            status: 429, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { 
            status: 402, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in help-chat function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
