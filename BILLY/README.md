# Billy

A digital companion for Tony, made by Bas.

---

## Quick Setup (15-20 minutes)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project (or use an existing one)
3. Wait for the project to finish setting up

### Step 2: Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/schema.sql` and paste it in
4. Click **Run**

This creates the tables and inserts default settings including Billy's full personality/system prompt.

### Step 3: Set Up the Edge Functions

1. In Terminal, navigate to your billy folder:
   ```bash
   cd ~/Desktop/billy
   ```

2. Login to Supabase (if not already):
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Set the Anthropic API key as a secret:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

5. Deploy both Edge Functions:
   ```bash
   supabase functions deploy chat
   supabase functions deploy outreach
   ```

### Step 4: Deploy the Frontend

Drag and drop the billy folder to [netlify.com](https://netlify.com) → Add new site → Deploy manually

---

## Setting Up Proactive Outreach

Billy can reach out to Tony occasionally—casual check-ins or interesting discoveries based on past conversations.

### Using cron-job.org (Free & Easy)

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - **URL**: `https://ocddhdopyabimzqjtyzd.supabase.co/functions/v1/outreach`
   - **Schedule**: Every 12 hours (or whatever frequency you want)
   - **Headers**: Add header `Authorization` with value `Bearer sb_publishable_6-9zMzGcYlJK5sAdUPyLyw_LerWLbkq`
3. Save and enable

### How It Works

- The outreach function checks if it should send a message
- It won't send if the last message was from Billy (no double-messaging)
- It won't send if there was activity in the last 12 hours
- 30% of the time: casual check-in ("How's your day going?")
- 70% of the time: researches something Tony mentioned and shares a discovery

---

## For Tony's Phone

1. Open the deployed URL in Safari (iPhone) or Chrome (Android)
2. Enter the PIN
3. Add to Home Screen:
   - **iPhone**: Tap Share → "Add to Home Screen"
   - **Android**: Tap menu (⋮) → "Add to Home Screen"

---

## File Structure

```
billy/
├── index.html          # The main app
├── manifest.json       # PWA configuration
├── README.md           # This file
└── supabase/
    ├── schema.sql      # Database setup
    └── functions/
        ├── chat/
        │   └── index.ts    # Chat function
        └── outreach/
            └── index.ts    # Proactive outreach function
```

---

## Updating Billy's Personality

1. Go to Supabase → Table Editor → `settings`
2. Find the row where `key` is `system_prompt`
3. Edit the `value` column
4. Changes take effect immediately

---

## Viewing Conversations

Go to Supabase → Table Editor → `messages`

---

## Resetting for Tony

To clear everything and let Tony start fresh:

```sql
DELETE FROM messages;
DELETE FROM settings WHERE key = 'pin';
```

---

Made with care for Tony.
