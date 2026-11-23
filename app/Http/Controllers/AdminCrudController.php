<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminCrudController extends Controller
{
    /**
     * Public Read-Only 3D Map Bootstrap Endpoint
     * GET /api/bootstrap?station=lares
     */
    public function bootstrap(Request $request)
    {
        $stationId = strtolower($request->query('station', 'lares'));

        $allStations = DB::table('stations')
            ->orderByRaw("FIELD(station_id, 'lares', 'qares', 'rares', 'cares')")
            ->get();

        $station = $allStations->firstWhere('station_id', $stationId) ?? $allStations->first();

        $buildings = DB::table('buildings')
            ->where('station_id', $stationId)
            ->where('is_visible', 1)
            ->orderByRaw('CASE WHEN building_num IS NULL THEN 1 ELSE 0 END, building_num ASC, id ASC')
            ->get();

        $images = DB::table('building_images')
            ->where('station_id', $stationId)
            ->orderByDesc('is_primary')
            ->orderBy('display_order')
            ->get()
            ->groupBy('building_code');

        $offices = DB::table('building_offices')
            ->where('station_id', $stationId)
            ->orderBy('display_order')
            ->get()
            ->groupBy('building_code');

        $entrances = DB::table('building_entrances')
            ->where('station_id', $stationId)
            ->get()
            ->groupBy('building_code');

        $enrichedBuildings = $buildings->map(function ($b) use ($images, $offices, $entrances) {
            $b->images = $images->get($b->building_code, collect())->values();
            $b->offices = $offices->get($b->building_code, collect())->values();
            $b->entrances = $entrances->get($b->building_code, collect())->map(fn($e) => [$e->entrance_lng, $e->entrance_lat])->values();
            return $b;
        });

        $subplots = DB::table('plot_subplots')
            ->where('station_id', $stationId)
            ->orderBy('display_order')
            ->get()
            ->groupBy('parent_plot_code');

        $plots = DB::table('agricultural_plots')
            ->where('station_id', $stationId)
            ->orderBy('id')
            ->get()
            ->map(function ($p) use ($subplots) {
                $p->subPlots = $subplots->get($p->plot_code, collect())->values();
                return $p;
            });

        return response()->json([
            'station' => $station,
            'allStations' => $allStations,
            'buildings' => $enrichedBuildings,
            'plots' => $plots,
        ]);
    }
}

