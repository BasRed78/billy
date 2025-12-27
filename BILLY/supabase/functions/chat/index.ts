// Billy Chat Edge Function
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
    const { message } = await req.json()

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get system prompt from settings
    const { data: promptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'system_prompt')
      .single()

    const systemPrompt = promptSetting?.value || 'You are Billy, a helpful assistant.'

    // Get conversation history (last 50 messages for context)
    const { data: historyData } = await supabase
      .from('messages')
      .select('role, content')
      .order('created_at', { ascending: true })
      .limit(50)

    const conversationHistory = historyData || []

    // Add the new user message to history for the API call
    const messagesForAPI = [
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    // Save user message to database
    await supabase
      .from('messages')
      .insert({ role: 'user', content: message })

    // Call Claude API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messagesForAPI
      })
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error('Anthropic API error:', errorText)
      throw new Error(`Anthropic API error: ${anthropicResponse.status}`)
    }

    const anthropicData = await anthropicResponse.json()
    const assistantMessage = anthropicData.content[0].text

    // Save assistant message to database
    await supabase
      .from('messages')
      .insert({ role: 'assistant', content: assistantMessage })

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
