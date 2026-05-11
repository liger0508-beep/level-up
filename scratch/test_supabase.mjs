import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjIzODAsImV4cCI6MjA5MjkzODM4MH0.qaQtCZmqN1TJ0yaFOqmSwC3IY7wcbA5vz0BJgo3zdCs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase.from('sg_baseline').select('*').limit(5);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Data:', JSON.stringify(data, null, 2));
    }
}

test();
