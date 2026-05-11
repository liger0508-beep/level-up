import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

const data = [
  [0, 0, 0, 0, 0, -1, 0.00, 0, 1.10, -0.35, -0.60, -0.60, -0.65],
  [1, -2.175, -0.45, -0.925, 0.45, -0.9, 0.9, 0.1, 0.00, -0.25, -0.50, -0.50, -0.55],
  [2, -2.125, -0.45, -0.875, 0.45, -0.65, 0.65, 0.35, 0.50, -0.25, -0.25, -0.25, -0.30],
  [3, -2.075, -0.45, -0.825, 0.45, -0.4, 0.40, 0.60, 0.50, 0.25, 0.00, 0.00, -0.05],
  [4, -2.025, -0.45, -0.775, 0.45, -0.3, 0.30, 0.70, 0.60, 0.35, 0.10, 0.10, 0.05],
  [5, -1.975, -0.45, -0.725, 0.45, -0.2, 0.20, 0.80, 0.70, 0.45, 0.20, 0.20, 0.15],
  [6, -1.925, -0.45, -0.675, 0.45, -0.15, 0.15, 0.85, 0.75, 0.50, 0.25, 0.25, 0.20],
  [7, -1.875, -0.45, -0.625, 0.45, -0.1, 0.10, 0.90, 0.80, 0.55, 0.30, 0.30, 0.25],
  [8, -1.825, -0.45, -0.575, 0.45, -0.05, 0.05, 0.95, 0.85, 0.60, 0.35, 0.35, 0.30],
  [9, -1.775, -0.45, -0.525, 0.45, -0.03, 0.03, 0.97, 0.90, 0.65, 0.40, 0.40, 0.35],
  [10, -1.725, -0.45, -0.475, 0.45, 0, 0.00, 1, 0.95, 0.70, 0.45, 0.45, 0.40],
  [11, -1.675, -0.45, -0.425, 0.45, 0.05, -0.05, 1.05, 1.00, 0.75, 0.50, 0.50, 0.45],
  [12, -1.625, -0.45, -0.375, 0.45, 0.10, -0.10, 1.10, 1.04, 0.79, 0.54, 0.54, 0.49],
  [13, -1.575, -0.45, -0.325, 0.45, 0.14, -0.14, 1.15, 1.08, 0.83, 0.58, 0.58, 0.53],
  [14, -1.525, -0.45, -0.275, 0.45, 0.18, -0.18, 1.20, 1.11, 0.86, 0.61, 0.61, 0.56],
  [15, -1.475, -0.45, -0.225, 0.45, 0.21, -0.21, 1.25, 1.14, 0.89, 0.64, 0.64, 0.59],
  [16, -1.425, -0.45, -0.175, 0.45, 0.24, -0.24, 1.30, 1.16, 0.91, 0.66, 0.66, 0.61],
  [17, -1.375, -0.45, -0.125, 0.45, 0.26, -0.26, 1.35, 1.18, 0.93, 0.68, 0.68, 0.63],
  [18, -1.325, -0.45, -0.075, 0.45, 0.28, -0.28, 1.40, 1.20, 0.95, 0.70, 0.70, 0.65],
  [19, -1.275, -0.45, -0.025, 0.45, 0.30, -0.30, 1.45, 1.21, 0.96, 0.71, 0.71, 0.66],
  [20, -1.225, -0.45, 0.025, 0.45, 0.31, -0.31, 1.50, 1.22, 0.97, 0.72, 0.72, 0.67],
  [30, -1.175, -0.45, 0.075, 0.45, null, -0.32, 1.55, 1.23, 0.98, 0.73, 0.73, 0.68],
  [40, -1.125, -0.375, 0.125, 0.375, null, -0.33, 1.60, 1.24, 0.99, 0.74, 0.74, 0.69],
  [50, -1.075, -0.325, 0.175, 0.325, null, -0.34, 1.65, 1.25, 1.00, 0.75, 0.75, 0.70],
  [60, -1.025, -0.275, 0.225, 0.275, null, -0.35, 1.70, null, null, null, null, null],
  [70, -0.975, -0.225, 0.275, 0.225, null, null, null, null, null, null, null, null],
  [80, -0.925, -0.175, 0.325, 0.175, null, null, null, null, null, null, null, null],
  [90, -0.875, -0.125, 0.375, 0.125, null, null, null, null, null, null, null, null],
  [100, -0.825, -0.075, 0.425, 0.075, null, null, null, null, null, null, null, null],
  [110, -0.775, -0.025, 0.475, 0.025, null, null, null, null, null, null, null, null],
  [120, -0.725, 0.025, 0.525, -0.025, null, null, null, null, null, null, null, null],
  [130, -0.675, 0.075, 0.575, -0.075, null, null, null, null, null, null, null, null],
  [140, -0.625, 0.125, 0.625, -0.125, null, null, null, null, null, null, null, null],
  [150, -0.575, 0.175, 0.675, -0.175, null, null, null, null, null, null, null, null],
  [160, -0.525, 0.225, 0.725, -0.225, null, null, null, null, null, null, null, null],
  [170, -0.475, 0.275, 0.775, -0.275, null, null, null, null, null, null, null, null],
  [180, -0.425, 0.325, 0.825, -0.325, null, null, null, null, null, null, null, null],
  [190, -0.375, 0.375, 0.875, -0.375, null, null, null, null, null, null, null, null],
  [200, -0.325, 0.425, 0.925, -0.425, null, null, null, null, null, null, null, null],
  [210, -0.275, 0.475, 0.975, -0.475, null, null, null, null, null, null, null, null],
  [220, -0.225, 0.525, 1.025, -0.525, null, null, null, null, null, null, null, null],
  [230, -0.175, 0.575, 1.075, -0.575, null, null, null, null, null, null, null, null],
  [240, -0.125, 0.625, 1.125, -0.625, null, null, null, null, null, null, null, null],
  [250, -0.075, 0.675, 1.175, -0.675, null, null, null, null, null, null, null, null],
  [260, -0.025, 0.725, 1.225, -0.725, null, null, null, null, null, null, null, null],
  [270, 0.025, 0.775, 1.275, -0.775, null, null, null, null, null, null, null, null],
  [280, 0.075, 0.825, 1.325, -0.825, null, null, null, null, null, null, null, null],
  [290, 0.125, 0.875, 1.375, -0.875, null, null, null, null, null, null, null, null],
  [300, 0.175, 0.925, 1.425, -0.925, null, null, null, null, null, null, null, null],
  [310, 0.225, 0.975, 1.475, -0.975, null, null, null, null, null, null, null, null],
  [320, 0.275, 1.025, 1.525, -1.025, null, null, null, null, null, null, null, null],
  [330, 0.325, 1.075, 1.575, -1.075, null, null, null, null, null, null, null, null],
  [340, 0.375, 1.125, 1.625, -1.125, null, null, null, null, null, null, null, null],
  [350, 0.425, 1.175, 1.675, -1.175, null, null, null, null, null, null, null, null],
  [360, 0.475, 1.225, 1.725, -1.225, null, null, null, null, null, null, null, null],
  [370, 0.525, 1.275, 1.775, -1.275, null, null, null, null, null, null, null, null],
  [380, 0.575, 1.325, 1.825, -1.325, null, null, null, null, null, null, null, null],
  [390, 0.625, 1.375, 1.875, -1.375, null, null, null, null, null, null, null, null],
  [400, 0.675, 1.425, 1.925, -1.425, null, null, null, null, null, null, null, null],
  [410, 0.725, 1.475, 1.975, -1.475, null, null, null, null, null, null, null, null],
  [420, 0.775, 1.525, 2.025, -1.525, null, null, null, null, null, null, null, null],
  [430, 0.825, 1.575, 2.075, -1.575, null, null, null, null, null, null, null, null],
  [440, 0.875, 1.625, 2.125, -1.625, null, null, null, null, null, null, null, null],
  [450, 0.925, 1.675, 2.175, -1.675, null, null, null, null, null, null, null, null],
  [460, 0.975, 1.725, 2.225, -1.725, null, null, null, null, null, null, null, null],
  [470, 1.025, 1.775, 2.275, -1.775, null, null, null, null, null, null, null, null],
  [480, 1.075, 1.825, 2.325, -1.825, null, null, null, null, null, null, null, null],
  [490, 1.125, 1.875, 2.375, -1.875, null, null, null, null, null, null, null, null],
  [500, 1.175, 1.925, 2.425, -1.925, null, null, null, null, null, null, null, null],
];

async function updateBaseline() {
    for (const row of data) {
        const [dist, t5, t4, rough, bunker, putting, h, i, app10, app25, app30, bnk25, bnk30] = row;
        
        const { error } = await supabase
            .from('sg_baseline')
            .upsert({
                distance_m: dist,
                tee_p5: t5,
                tee_p4: t4,
                rough: rough,
                bunker: bunker,
                putting: putting,
                app_10m: app10,
                app_25m: app25,
                app_30m: app30,
                bunker_25m: bnk25,
                bunker_30m: bnk30
            }, { onConflict: 'distance_m' });

        if (error) {
            console.error(`Error updating distance ${dist}:`, error);
        } else {
            console.log(`Updated distance ${dist}`);
        }
    }
}

updateBaseline();
