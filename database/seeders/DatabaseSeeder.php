<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the DA-CALABARZON 10-Table MySQL Database (`kiosk`).
     * Invokes the canonical ES-module ground-truth seeder (`database/migrate_and_seed.mjs`)
     * so all JS modules (`buildings.js`, `offices.js`, `descriptions.js`, `plots.js`, `stations.js`)
     * and GeoJSON files (`roads.json`, `trees.json`, `qares_*.json`, `rares_*.json`) are imported 1:1.
     */
    public function run(): void
    {
        $scriptPath = base_path('database/migrate_and_seed.mjs');
        if (file_exists($scriptPath)) {
            $output = [];
            $code = 0;
            exec('node "' . $scriptPath . '" 2>&1', $output, $code);
            foreach ($output as $line) {
                if ($this->command) {
                    $this->command->info($line);
                }
            }
        }
    }
}

