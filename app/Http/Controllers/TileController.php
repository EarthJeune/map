<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use PDO;

class TileController extends Controller
{
    /**
     * Serve offline drone orthomosaic tiles (PNG, JPEG, WebP) from station .mbtiles SQLite archives.
     * Optimized for the ~210 MB Zoom 14-21 MBTiles files (LARES, QARES, RARES).
     */
    public function serveTile(Request $request, string $station = 'lares', int $z, int $x, string $y)
    {
        $yClean = (int) preg_replace('/\.(png|jpg|jpeg|webp)$/i', '', $y);
        $tmsY = (1 << $z) - 1 - $yClean;

        $mbtilesMap = [
            'lares' => base_path('LARES v1.mbtiles'),
            'qares' => base_path('QARES v1.mbtiles'),
            'rares' => base_path('RARES v1.mbtiles'),
        ];

        $dbPath = $mbtilesMap[strtolower($station)] ?? $mbtilesMap['lares'];
        if (!file_exists($dbPath)) {
            return response('', 204);
        }

        $pdo = new PDO('sqlite:' . $dbPath, null, null, [
            PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY,
        ]);

        $stmt = $pdo->prepare('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1');
        $stmt->execute([$z, $x, $tmsY]);
        $tileData = $stmt->fetchColumn();

        if (!$tileData) {
            return response('', 204)->header('Cache-Control', 'public, max-age=86400');
        }

        // Auto-detect magic bytes (PNG, JPEG, WebP)
        $mime = 'image/png';
        if (substr($tileData, 0, 2) === "\xFF\xD8") {
            $mime = 'image/jpeg';
        } elseif (substr($tileData, 0, 4) === 'RIFF' && substr($tileData, 8, 4) === 'WEBP') {
            $mime = 'image/webp';
        }

        return response($tileData, 200)
            ->header('Content-Type', $mime)
            ->header('Cache-Control', 'public, max-age=86400');
    }
}

