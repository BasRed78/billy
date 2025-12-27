// Billy Proactive Outreach Edge Function
// This function runs on a schedule and occasionally adds a message from Billy
// Deploy to Supabase Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the most recent message
    const { data: recentMessages, error: msgError } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (msgError) throw msgError

    // Don't send if no conversation yet
    if (!recentMessages || recentMessages.length === 0) {
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no conversation yet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Don't send if the last message was from Billy (don't double-message)
    if (recentMessages[0].role === 'assistant') {
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'last message was from Billy' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Don't send if last message was within the last 12 hours
    const lastMessageTime = new Date(recentMessages[0].created_at)
    const hoursSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceLastMessage < 12) {
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'too recent', hours: hoursSinceLastMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decide: casual check-in (30%) or discovery based on conversation (70%)
    const messageType = Math.random() < 0.3 ? 'checkin' : 'discovery'

    let billyMessage = ''

    if (messageType === 'checkin') {
      // Simple casual check-ins
      const checkins = [
        "How's your day going?",
        "Been thinking about anything interesting lately?",
        "How are things?",
        "Anything on your mind today?",
      ]
      billyMessage = checkins[Math.floor(Math.random() * checkins.length)]
    } else {
      // Discovery: analyze recent conversation for topics, then generate something interesting
      const conversationContext = recentMessages
        .slice(0, 15)
        .reverse()
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n')

      // Call Claude to generate a discovery message
      const prompt = `You are Billy, a companion for Tony. You've been having conversations with him. Based on the recent conversation below, identify something Tony mentioned that you could research and come back with an interesting fact or observation about.

This should feel natural - like you went away, thought about something he said, looked into it, and found something genuinely interesting to share. Not a list of facts, just one thing.

Keep it brief - 2-3 sentences max. Be conversational, not formal. If it's about WW2 or history, even better - Tony loves that.

If you can't find a good topic from the conversation, just share something interesting about WW2 or British history that Tony might not know.

Start your message directly - no "Hi Tony" or greeting needed. Just the observation or discovery.

Recent conversation:
${conversationContext}

Your message:`

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!anthropicResponse.ok) {
        throw new Error(`Anthropic API error: ${anthropicResponse.status}`)
      }

      const anthropicData = await anthropicResponse.json()
      billyMessage = anthropicData.content[0].text
    }

    // Save Billy's proactive message
    const { error: insertError } = await supabase
      .from('messages')
      .insert({ role: 'assistant', content: billyMessage })

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ status: 'sent', type: messageType, message: billyMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
