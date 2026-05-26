-- Create tournament_results table
CREATE TABLE IF NOT EXISTS tournament_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    athlete_name TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    round_date DATE NOT NULL,
    daily_score TEXT,
    daily_rank INTEGER,
    cumulative_score INTEGER,
    rank INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tournament_id, athlete_name, round_number)
);

-- Add RLS (assuming public access or similar policy as tournaments table)
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for tournament_results" ON tournament_results
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access for tournament_results" ON tournament_results
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access for tournament_results" ON tournament_results
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access for tournament_results" ON tournament_results
    FOR DELETE USING (true);
