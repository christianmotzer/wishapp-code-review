import { createClient } from "npm:@supabase/supabase-js@2.57.4";

interface DeleteUserRequest {
  user_id?: string;
  target_user_id?: string;
  deletion_type: "self" | "admin";
  reason?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: DeleteUserRequest = await req.json();
    const userToDelete = body.deletion_type === "admin" ? body.target_user_id : user.id;
    const deletedBy = body.deletion_type === "admin" ? user.email : "user";

    if (!userToDelete) {
      return new Response(
        JSON.stringify({ error: "Invalid request: user_id or target_user_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (body.deletion_type === "admin") {
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("role")
        .eq("email", user.email || "")
        .maybeSingle();

      if (!adminData) {
        return new Response(JSON.stringify({ error: "Only admins can delete other users" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: logError } = await supabase
      .from("account_deletion_log")
      .insert({
        user_id: userToDelete,
        deleted_by: deletedBy,
        deletion_type: body.deletion_type,
        reason: body.reason || null,
        status: "pending",
      });

    if (logError) throw logError;

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        full_name: null,
        phone: null,
        address_line1: null,
        address_line2: null,
        city: null,
        state: null,
        postal_code: null,
        country: null,
        bio: null,
        avatar_url: null,
        email: null,
        account_status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("user_id", userToDelete);

    if (updateError) throw updateError;

    const { error: friendError } = await supabase
      .from("friendships")
      .delete()
      .or(`requester_id.eq.${userToDelete},addressee_id.eq.${userToDelete}`);

    if (friendError) throw friendError;

    const { error: logUpdateError } = await supabase
      .from("account_deletion_log")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("user_id", userToDelete);

    if (logUpdateError) throw logUpdateError;

    if (body.deletion_type === "self") {
      await supabase.auth.admin.deleteUser(userToDelete);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account deletion initiated",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error deleting account:", error);
    return new Response(JSON.stringify({ error: "Failed to delete account" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
