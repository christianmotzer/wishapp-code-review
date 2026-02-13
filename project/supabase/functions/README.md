# Supabase Edge Functions

This directory contains Supabase Edge Functions for the Wishlist application.

## Available Functions

### send-invitation

Sends email invitations to new users using Resend.

**Endpoint:** `https://your-project.supabase.co/functions/v1/send-invitation`

**Authentication:** Requires valid user JWT token in Authorization header

**Deployment Settings:**
- `verify_jwt: false` - Authentication is handled manually in the function code

**Required Secrets:**
- `resend_api_key` (optional) - For sending emails via Resend

## Email Service Setup

The invitation system uses [Resend](https://resend.com) for email delivery.

### Steps to Enable Email Delivery:

1. **Create a Resend Account**
   - Go to https://resend.com
   - Sign up for a free account

2. **Get Your API Key**
   - Navigate to https://resend.com/api-keys
   - Create a new API key
   - Copy the key (you won't be able to see it again)

3. **Configure the Secret in Supabase**
   - Go to your Supabase project at https://app.supabase.com
   - Navigate to Settings > Edge Functions
   - Click "Add Secret"
   - Name: `resend_api_key` (lowercase - Supabase converts all secret names to lowercase)
   - Value: Paste your Resend API key
   - Click Save

4. **Verify Setup**
   - Try sending an invitation from the app
   - Check the edge function logs if there are any issues

### Without Email Service

The application will work without email configuration, but:
- Invitations will be created in the database
- No emails will be sent
- The invitation link must be shared manually
- Users can still sign up using the invitation code

## Edge Function Best Practices

### Authentication

All edge functions should handle authentication in one of two ways:

1. **Manual JWT Verification** (Recommended)
   ```typescript
   const supabaseAuth = createClient(
     Deno.env.get('SUPABASE_URL')!,
     Deno.env.get('SUPABASE_ANON_KEY')!,
     {
       global: {
         headers: { Authorization: authHeader },
       },
     }
   );

   const { data: { user }, error } = await supabaseAuth.auth.getUser();
   ```
   - Deploy with `verify_jwt: false`
   - Provides better error handling
   - Allows custom authentication logic

2. **Automatic JWT Verification**
   - Deploy with `verify_jwt: true`
   - Supabase handles authentication
   - Less control over error messages

### CORS Headers

Always include these CORS headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
```

Handle OPTIONS requests:

```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}
```

### Error Handling

Always wrap your function in try-catch:

```typescript
Deno.serve(async (req: Request) => {
  try {
    // Function logic here
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### Import Dependencies

Use npm: or jsr: prefixes for external dependencies:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
```

### Environment Variables

These are automatically available in all edge functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

Custom secrets must be configured in the Supabase dashboard.

## Deployment

Edge functions are deployed automatically through the Bolt.new interface.

**Important:** All functions are deployed with the correct settings automatically. No manual CLI commands are needed.

## Monitoring and Debugging

View edge function logs:
1. Go to your Supabase project
2. Navigate to Edge Functions
3. Select the function
4. View logs in real-time

Common issues:
- **401 Unauthorized**: Check Authorization header format
- **CORS errors**: Verify CORS headers are included in all responses
- **Email not sending**: Verify resend_api_key secret is configured (must be lowercase)
- **Rate limiting**: Check daily invitation limits (10 per user)
