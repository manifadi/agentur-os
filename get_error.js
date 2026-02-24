const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { error } = await supabase.from("project_logs").insert([{
      project_id: "00000000-0000-0000-0000-000000000000",
      title: "Test",
      content: "test",
      image_urls: [],
      entry_date: "2023-01-01",
      is_public: false,
      organization_id: "00000000-0000-0000-0000-000000000000"
  }]);
  console.log("Supabase Error:", JSON.stringify(error, null, 2));
}
run();
