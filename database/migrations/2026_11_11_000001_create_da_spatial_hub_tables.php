<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for the 10-Table DA-CALABARZON Interactive Map & Agronomic CRUD Architecture.
     */
    public function up(): void
    {
        // 1. stations
        Schema::create('stations', function (Blueprint $table) {
            $table->string('station_id', 50)->primary();
            $table->string('name', 100);
            $table->string('label', 150);
            $table->string('subtitle', 255)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->string('province', 150)->nullable();
            $table->enum('status', ['live', 'under_development'])->default('under_development');
            $table->double('kiosk_pin_lng');
            $table->double('kiosk_pin_lat');
            $table->double('drone_offset_dx')->default(0);
            $table->double('drone_offset_dy')->default(0);
            $table->double('default_center_lng');
            $table->double('default_center_lat');
            $table->double('default_zoom')->default(19.0);
            $table->double('default_pitch')->default(52.0);
            $table->double('default_bearing')->default(0.0);
            $table->string('mbtiles_filename', 255)->nullable();
            $table->longText('boundary_geojson')->nullable();
            $table->timestamps();
        });

        // 2. buildings
        Schema::create('buildings', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('building_code', 100);
            $table->integer('building_num')->nullable();
            $table->string('name', 255);
            $table->string('category', 80)->default('infrastructure');
            $table->string('type_label', 150)->nullable();
            $table->string('section', 150)->nullable();
            $table->string('icon', 80)->default('building-2');
            $table->string('pin_color', 30)->default('#22c55e');
            $table->string('roof_color', 30)->default('#334155');
            $table->text('description')->nullable();
            $table->double('marker_lng')->nullable();
            $table->double('marker_lat')->nullable();
            $table->double('label_offset_lng')->nullable();
            $table->double('label_offset_lat')->nullable();
            $table->string('model_glb_url', 255)->nullable();
            $table->json('model_scale')->nullable();
            $table->json('model_rotation')->nullable();
            $table->double('model_altitude')->default(0);
            $table->longText('footprint_geojson')->nullable();
            $table->double('height')->default(5.0);
            $table->boolean('is_visible')->default(true);
            $table->timestamps();

            $table->unique(['station_id', 'building_code'], 'uq_station_building');
            $table->foreign('station_id')->references('station_id')->on('stations')->onDelete('cascade');
        });

        // 3. building_images
        Schema::create('building_images', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('building_code', 100);
            $table->string('image_webp_url', 255);
            $table->string('caption', 255)->nullable();
            $table->integer('display_order')->default(1);
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->index(['station_id', 'building_code'], 'idx_bldg_images');
        });

        // 4. building_offices
        Schema::create('building_offices', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('building_code', 100);
            $table->string('office_name', 255);
            $table->text('office_desc')->nullable();
            $table->string('floor_or_room', 100)->nullable();
            $table->string('search_keywords', 255)->nullable();
            $table->integer('display_order')->default(1);
            $table->timestamps();

            $table->index(['station_id', 'building_code'], 'idx_bldg_offices');
        });

        // 5. building_entrances
        Schema::create('building_entrances', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('building_code', 100);
            $table->double('entrance_lng');
            $table->double('entrance_lat');
            $table->boolean('is_main_entrance')->default(true);
            $table->timestamps();

            $table->index(['station_id', 'building_code'], 'idx_bldg_entrances');
        });

        // 6. agricultural_plots
        Schema::create('agricultural_plots', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('plot_code', 100);
            $table->string('plot_number', 50)->nullable();
            $table->string('zone_name', 255);
            $table->string('category', 80)->default('orchard');
            $table->string('icon', 80)->default('sprout');
            $table->string('color', 30)->default('#22c55e');
            $table->string('current_crop', 255)->nullable();
            $table->integer('tree_or_plant_count')->nullable();
            $table->enum('cropping_cycle', ['annual', 'perennial', 'monthly_seasonal', 'fallow'])->default('perennial');
            $table->string('cycle_months', 100)->nullable();
            $table->decimal('area_hectares', 8, 2)->nullable();
            $table->string('soil_type', 150)->nullable();
            $table->string('status', 80)->default('Active');
            $table->text('description')->nullable();
            $table->string('image_webp_url', 255)->nullable();
            $table->double('center_lng')->nullable();
            $table->double('center_lat')->nullable();
            $table->double('label_offset_lng')->nullable();
            $table->double('label_offset_lat')->nullable();
            $table->longText('polygon_geojson')->nullable();
            $table->timestamps();

            $table->unique(['station_id', 'plot_code'], 'uq_station_plot');
            $table->foreign('station_id')->references('station_id')->on('stations')->onDelete('cascade');
        });

        // 7. plot_subplots
        Schema::create('plot_subplots', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('parent_plot_code', 100);
            $table->string('subplot_code', 100);
            $table->string('name', 255);
            $table->string('category', 80)->nullable();
            $table->string('current_crop', 255)->nullable();
            $table->integer('tree_or_plant_count')->nullable();
            $table->string('cropping_cycle', 80)->nullable();
            $table->text('description')->nullable();
            $table->string('image_webp_url', 255)->nullable();
            $table->text('extra_images_json')->nullable();
            $table->double('center_lng')->nullable();
            $table->double('center_lat')->nullable();
            $table->longText('polygon_geojson')->nullable();
            $table->integer('display_order')->default(1);
            $table->timestamps();

            $table->index(['station_id', 'parent_plot_code'], 'idx_plot_subplots');
        });

        // 8. campus_trees
        Schema::create('campus_trees', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('tree_code', 100)->nullable();
            $table->string('species_model', 100)->default('mango');
            $table->double('lng');
            $table->double('lat');
            $table->double('scale')->default(1.0);
            $table->double('rotation')->default(0.0);
            $table->timestamps();

            $table->index('station_id', 'idx_trees_station');
        });

        // 9. road_features
        Schema::create('road_features', function (Blueprint $table) {
            $table->id();
            $table->string('station_id', 50);
            $table->string('feature_code', 100)->nullable();
            $table->string('road_type', 80)->default('road');
            $table->string('name', 255)->nullable();
            $table->string('building_code', 100)->nullable();
            $table->longText('geometry_geojson');
            $table->text('properties_json')->nullable();
            $table->timestamps();

            $table->index('station_id', 'idx_roads_station');
        });

        // 10. admin_audit_logs
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('admin_username', 100)->default('admin');
            $table->string('action', 100);
            $table->string('target_table', 100);
            $table->string('target_id', 100)->nullable();
            $table->text('summary')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        // 11. admin_users (SHA-256 encrypted username & password)
        Schema::create('admin_users', function (Blueprint $table) {
            $table->id();
            $table->char('username_sha256', 64)->unique();
            $table->char('password_sha256', 64);
            $table->string('role', 50)->default('super_admin');
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_users');
        Schema::dropIfExists('admin_audit_logs');
        Schema::dropIfExists('road_features');
        Schema::dropIfExists('campus_trees');
        Schema::dropIfExists('plot_subplots');
        Schema::dropIfExists('agricultural_plots');
        Schema::dropIfExists('building_entrances');
        Schema::dropIfExists('building_offices');
        Schema::dropIfExists('building_images');
        Schema::dropIfExists('buildings');
        Schema::dropIfExists('stations');
    }
};

