import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface InvitationRequest {
  email: string;
  message?: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let email: string;
    let message: string | undefined;

    try {
      const body = await req.json();
      console.log('Request body:', body);
      email = body.email;
      message = body.message;
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: recentInvitations, error: checkError } = await supabase
      .from('invitations')
      .select('id')
      .eq('inviter_id', user.id)
      .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (checkError) {
      throw checkError;
    }

    if (recentInvitations && recentInvitations.length >= 10) {
      return new Response(
        JSON.stringify({ error: 'Maximum 10 invitations per day. Please try again tomorrow.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id, status')
      .eq('email', email)
      .eq('inviter_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'You have already sent an invitation to this email address' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: invitation, error: insertError } = await supabase
      .from('invitations')
      .insert({
        inviter_id: user.id,
        email: email.toLowerCase(),
        message: message || null,
      })
      .select('id, invitation_code')
      .single();

    if (insertError) {
      throw insertError;
    }

    const { data: inviterProfile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const inviterName = inviterProfile?.display_name || 'A friend';
    const inviteUrl = `${req.headers.get('origin') || 'https://yourdomain.com'}/signup?invite=${
      invitation.invitation_code
    }`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">You're Invited!</h1>
        <p style="font-size: 16px; color: #555;">
          ${inviterName} has invited you to join Wishlist, a platform where you can create and share wishes with friends.
        </p>
        ${message ? `<blockquote style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 20px 0; font-style: italic; color: #666;">${message}</blockquote>` : ''}
        <p style="margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Accept Invitation
          </a>
        </p>
        <p style="font-size: 14px; color: #888;">
          This invitation will expire in 30 days.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #aaa;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `;

    const emailText = `${inviterName} has invited you to join Wishlist!\n\n${message ? `Message: ${message}\n\n` : ''}Click here to accept: ${inviteUrl}\n\nThis invitation will expire in 30 days.`;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (resendApiKey) {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Wishlist <onboarding@resend.dev>',
            to: [email],
            subject: `${inviterName} invited you to join Wishlist!`,
            html: emailHtml,
            text: emailText,
          }),
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.json();
          console.error('Resend API error:', errorData);
          throw new Error(`Failed to send email: ${errorData.message || 'Unknown error'}`);
        }

        const emailResult = await resendResponse.json();
        console.log('Email sent successfully via Resend:', emailResult);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invitation sent successfully via email',
            invitation_id: invitation.id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (emailError) {
        console.error('Failed to send email via Resend:', emailError);
        return new Response(
          JSON.stringify({
            error: 'Invitation created but email delivery failed',
            details: emailError instanceof Error ? emailError.message : 'Unknown email error',
            invitation_id: invitation.id,
            invitation_code: invitation.invitation_code,
          }),
          {
            status: 207,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      console.log('RESEND_API_KEY not configured. Email content:', {
        to: email,
        subject: `${inviterName} invited you to join Wishlist!`,
        inviteUrl,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invitation created successfully',
          invitation_id: invitation.id,
          invitation_code: invitation.invitation_code,
          note: 'Email delivery requires RESEND_API_KEY configuration. Share this invitation link manually: ' + inviteUrl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error sending invitation:', error);
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
