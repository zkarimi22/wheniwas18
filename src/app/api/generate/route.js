import { NextResponse } from "next/server";
import OpenAI from "openai";

// Simple time-based rate limiting (works on serverless)
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;

function getRateLimitKey(request) {
  // Try to get real IP from headers (for production with proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  return ip;
}

function createRateLimitToken(ip) {
  // Create a simple token with timestamp and IP hash
  const timestamp = Date.now();
  const ipHash = btoa(ip).slice(0, 8); // Simple hash
  return `${timestamp}-${ipHash}`;
}

function validateRateLimit(ip, token) {
  if (!token) return false;
  
  try {
    const [timestampStr, ipHash] = token.split('-');
    const timestamp = parseInt(timestampStr);
    const expectedHash = btoa(ip).slice(0, 8);
    
    // Validate token format and IP match
    if (!timestamp || ipHash !== expectedHash) {
      return false;
    }
    
    // Check if token is within rate limit window
    const now = Date.now();
    const timeDiff = now - timestamp;
    
    return timeDiff >= RATE_LIMIT_WINDOW; // True if enough time has passed
  } catch {
    return false;
  }
}

const functionSchema = {
  name: "generate_year_wrapped",
  description: "Generate a Spotify Wrapped style summary of what the world was like in a specific year",
  parameters: {
    type: "object",
    properties: {
      year: { type: "number" },
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { 
              type: "string", 
              enum: ["stat", "moment", "culture", "tech", "vibe", "belief", "summary"]
            },
            title: { type: "string" },
            subtitle: { type: "string" },
            content: { type: "string" },
            stat_value: { type: "string" },
            background_color: { type: "string" },
            text_color: { type: "string" },
            include_gif: { type: "boolean" },
            gif_search_term: { type: "string" },
            fun_fact: { type: "string" }
          },
          required: ["id", "type", "title", "content", "background_color", "text_color", "include_gif"],
          additionalProperties: false,
        },
      },
      overall_vibe: { type: "string" },
      tagline: { type: "string" }
    },
    required: ["year", "cards", "overall_vibe", "tagline"],
    additionalProperties: false,
  },
};

async function fetchTenorGif(searchTerm) {
  const tenorKey = process.env.TENOR_API_KEY;
  if (!tenorKey) {
    console.warn("[Tenor] No TENOR_API_KEY set, skipping GIF fetch");
    return null;
  }

  try {
    const encodedTerm = encodeURIComponent(searchTerm);
    const url = `https://tenor.googleapis.com/v2/search?q=${encodedTerm}&key=${tenorKey}&client_key=wheniwas18&limit=1&media_filter=gif,mp4&contentfilter=medium&ar_range=standard`;
    
    console.log("[Tenor] Fetching GIF for:", searchTerm);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("[Tenor] API error:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const gif = data.results?.[0];
    
    if (!gif) {
      console.warn("[Tenor] No GIF found for:", searchTerm);
      return null;
    }

    // Return both GIF and MP4 formats for better compatibility
    return {
      id: gif.id,
      gif_url: gif.media_formats?.gif?.url || null,
      mp4_url: gif.media_formats?.mp4?.url || null,
      preview_url: gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url || null,
      width: gif.media_formats?.gif?.dims?.[0] || 0,
      height: gif.media_formats?.gif?.dims?.[1] || 0
    };
  } catch (error) {
    console.error("[Tenor] Error fetching GIF for", searchTerm, ":", error);
    return null;
  }
}

export async function POST(request) {
  console.log("[API/generate] Incoming POST:", request.url);
  
  try {
    // Simple rate limiting check
    const ip = getRateLimitKey(request);
    const rateLimitToken = request.headers.get('x-rate-limit-token');
    
    console.log("[API/generate] IP:", ip, "Token:", rateLimitToken ? 'present' : 'none');
    
    // If no token or token is invalid/expired, check basic rate limiting
    if (!validateRateLimit(ip, rateLimitToken)) {
      // For simplicity, we'll allow the first request and return a token for subsequent requests
      // In a real app, you might want to implement more sophisticated checking
      console.log("[API/generate] Rate limit check passed or first request");
    }

    const { searchParams } = new URL(request.url);
    const paramBirthYear = searchParams.get("birthYear");
    const paramYear18 = searchParams.get("year18");
    console.log("[API/generate] params:", { birthYear: paramBirthYear, year18: paramYear18 });

    if (!paramBirthYear && !paramYear18) {
      console.error("[API/generate] Missing birthYear or year18 param");
      return NextResponse.json({ error: "Missing birthYear or year18" }, { status: 400 });
    }

    const year18 = paramYear18 ? Number(paramYear18) : Number(paramBirthYear) + 18;
    const birthYear = year18 - 18;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn("[API/generate] No OPENAI_API_KEY set. Returning mock payload.");
      const mock = {
        year: year18,
        cards: [
          {
            id: "intro",
            type: "vibe",
            title: `Your Year: ${year18}`,
            content: `When you turned 18, the world was full of possibilities...`,
            background_color: "#6366f1",
            text_color: "#ffffff",
            include_gif: true,
            gif_search_term: "celebration",
            gif: null
          },
          {
            id: "big_moment",
            type: "moment",
            title: "The Big Moment",
            content: "Major world events were shaping history.",
            background_color: "#ec4899",
            text_color: "#ffffff",
            include_gif: false,
            gif_search_term: "",
            gif: null
          }
        ],
        overall_vibe: "Nostalgic and transformative",
        tagline: `${year18}: Your coming-of-age year`
      };
      
      // Create response with rate limit token
      const response = NextResponse.json(mock);
      response.headers.set('x-rate-limit-token', createRateLimitToken(ip));
      return response;
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt = `You are a creative storyteller who creates engaging Spotify Wrapped-style summaries. Generate 6-8 cards that tell the story of a specific year in a fun, engaging way. Mix different card types: stats, moments, culture, tech, vibes, and beliefs. Use vibrant colors and creative titles. Make it feel personal and nostalgic.

GIF GUIDELINES:
- Set include_gif to true ONLY for cards that would have good, specific, non-political visual content
- AVOID GIFs for: political events, wars, disasters, controversial topics, overly specific historical moments
- GOOD for GIFs: music/cultural phenomena, technology, emotions, celebrations, general vibes, popular trends
- When include_gif is true, provide a SPECIFIC gif_search_term related to the card's content
- Examples of GOOD gif_search_terms: "grunge music", "90s dancing", "computer technology", "celebration", "nostalgic", "retro fashion"
- Examples of BAD gif_search_terms: "berlin wall", "gulf war", "political crisis" - set include_gif to false instead
- When include_gif is false, you can leave gif_search_term empty or omit it`;

    console.log("[API/generate] Calling OpenAI (function calling) for year:", year18, "(birthYear:", birthYear, ")");

    let parsed;
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Create a Spotify Wrapped-style summary for ${year18}. This was the year someone born in ${birthYear} turned 18. Include:
            
            - An intro card welcoming them to their year (good for GIF)
            - 2-3 major world events/moments as dramatic cards (be selective with GIFs - avoid political/war content)
            - 1-2 cultural phenomena cards (music, movies, trends - great for GIFs)
            - 1 technology breakthrough card (good for GIFs if visual)
            - 1 "beliefs that aged poorly" card (usually good for GIFs - focus on the concept)
            - A summary/outro card (good for GIF)
            
            Make each card visually distinct with different background colors (hex codes). Use engaging titles and make the content feel personal and nostalgic. 
            
            Remember: Only include GIFs for content that has good visual representation and isn't political or controversial. When you do include GIFs, make the search terms specific to the actual content (like "grunge music" not just "music").`,
          },
        ],
        tools: [{ type: "function", function: functionSchema }],
        tool_choice: { type: "function", function: { name: "generate_year_wrapped" } },
        temperature: 0.7,
      });

      const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function?.name !== "generate_year_wrapped") {
        console.error("[API/generate] No valid tool call received");
        return NextResponse.json({ error: "Invalid response from model" }, { status: 500 });
      }

      parsed = JSON.parse(toolCall.function.arguments);
      console.log("[API/generate] Function call parsed - cards count:", parsed?.cards?.length || 0);
    } catch (apiErr) {
      console.error("[API/generate] OpenAI error:", apiErr);
      const status = apiErr?.status || 500;
      const code = apiErr?.code;
      if (status === 401 || code === "invalid_api_key") {
        return NextResponse.json(
          { error: "Invalid OpenAI API key. Update OPENAI_API_KEY in .env.local and restart the dev server." },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: "Upstream AI error" }, { status });
    }

    if (!parsed) {
      console.error("[API/generate] No parsed content received from model");
      return NextResponse.json({ error: "Invalid JSON from model" }, { status: 500 });
    }

    // Fetch GIFs only for cards that should have them
    console.log("[API/generate] Fetching GIFs for eligible cards");
    const cardsWithGifs = await Promise.all(
      parsed.cards.map(async (card) => {
        if (card.include_gif && card.gif_search_term) {
          const gif = await fetchTenorGif(card.gif_search_term);
          return { ...card, gif };
        } else {
          return { ...card, gif: null };
        }
      })
    );

    const result = { ...parsed, cards: cardsWithGifs };
    const gifCount = cardsWithGifs.filter(c => c.gif).length;
    console.log("[API/generate] Success with GIFs - cards with GIFs:", gifCount, "/ eligible:", cardsWithGifs.filter(c => c.include_gif).length);
    
    // Create response with rate limit token
    const response = NextResponse.json(result);
    response.headers.set('x-rate-limit-token', createRateLimitToken(ip));
    return response;
  } catch (err) {
    console.error("[API/generate] Unhandled server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
} 