require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const p = {
      project_id: '00000000-0000-0000-0000-000000000000', // invalid but we want to see schema error first
      title: 'Test',
      content: 'test content',
      image_url: null,
      image_urls: [],
      entry_date: new Date().toISOString().split('T')[0],
      employee_id: null,
      is_public: false,
      organization_id: '00000000-0000-0000-0000-000000000000'
  };

  const { data, error } = await supabase.from('project_logs').insert([p]);
  console.log("Error:", error);
}

test();
