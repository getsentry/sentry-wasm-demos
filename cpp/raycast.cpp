#include "raycast.h"

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace {

struct Color {
    uint8_t r;
    uint8_t g;
    uint8_t b;
};

// Neon wall palette — index is (map_x + map_y) % 4 at the hit cell.
constexpr Color WALL_PALETTE[4] = {
    {255, 42, 109},  // #ff2a6d
    {5, 217, 232},   // #05d9e8
    {123, 47, 247},  // #7b2ff7
    {209, 247, 255}, // #d1f7ff
};

constexpr float FOV = 0.66f;
constexpr float MAX_DEPTH = 16.0f;

void set_pixel(uint8_t* buffer, int width, int x, int y, uint8_t r, uint8_t g, uint8_t b) {
    const int idx = (y * width + x) * 4;
    buffer[idx + 0] = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = 255;
}

uint8_t lerp_byte(uint8_t from, uint8_t to, float t) {
    return static_cast<uint8_t>(from + (to - from) * t);
}

void apply_distance_fog(uint8_t& r, uint8_t& g, uint8_t& b, float distance) {
    float fog = distance / MAX_DEPTH;
    if (fog > 1.0f) {
        fog = 1.0f;
    }
    const float keep = 1.0f - fog * 0.78f;
    r = static_cast<uint8_t>(r * keep);
    g = static_cast<uint8_t>(g * keep);
    b = static_cast<uint8_t>(b * keep);
}

void draw_ceiling_and_floor(uint8_t* buffer, int width, int height) {
    const int horizon = height / 2;

    // Top half: dark blue ceiling (lighter toward the horizon).
    for (int y = 0; y < horizon; ++y) {
        const float t = static_cast<float>(y) / static_cast<float>(horizon);
        const uint8_t r = lerp_byte(6, 18, t);
        const uint8_t g = lerp_byte(10, 36, t);
        const uint8_t b = lerp_byte(28, 72, t);
        for (int x = 0; x < width; ++x) {
            set_pixel(buffer, width, x, y, r, g, b);
        }
    }

    // Bottom half: dark grey/brown floor (darker toward the bottom).
    for (int y = horizon; y < height; ++y) {
        const float t = static_cast<float>(y - horizon) / static_cast<float>(height - horizon);
        const uint8_t r = lerp_byte(42, 14, t);
        const uint8_t g = lerp_byte(36, 12, t);
        const uint8_t b = lerp_byte(30, 10, t);
        for (int x = 0; x < width; ++x) {
            set_pixel(buffer, width, x, y, r, g, b);
        }
    }
}

} // namespace

void raycast_frame(const Maze& maze, const Player& player, bool has_key, uint8_t* rgba_buffer, int width, int height) {
    draw_ceiling_and_floor(rgba_buffer, width, height);

    // View direction and a vector perpendicular to it that spans the screen (camera plane).
    const float dir_x = std::cos(player.angle);
    const float dir_y = std::sin(player.angle);
    const float plane_x = -dir_y * FOV;
    const float plane_y = dir_x * FOV;

    for (int column = 0; column < width; ++column) {
        // Map this screen column to a ray angle across the field of view.
        const float camera_x = 2.0f * static_cast<float>(column) / static_cast<float>(width) - 1.0f;
        const float ray_dir_x = dir_x + plane_x * camera_x;
        const float ray_dir_y = dir_y + plane_y * camera_x;

        int map_x = static_cast<int>(player.x);
        int map_y = static_cast<int>(player.y);

        // DDA step size between grid lines (how far along the ray to move one cell).
        const float delta_dist_x =
            ray_dir_x == 0.0f ? 1e30f : std::fabs(1.0f / ray_dir_x);
        const float delta_dist_y =
            ray_dir_y == 0.0f ? 1e30f : std::fabs(1.0f / ray_dir_y);

        int step_x = 0;
        int step_y = 0;
        float side_dist_x = 0.0f;
        float side_dist_y = 0.0f;

        if (ray_dir_x < 0.0f) {
            step_x = -1;
            side_dist_x = (player.x - static_cast<float>(map_x)) * delta_dist_x;
        } else {
            step_x = 1;
            side_dist_x = (static_cast<float>(map_x) + 1.0f - player.x) * delta_dist_x;
        }

        if (ray_dir_y < 0.0f) {
            step_y = -1;
            side_dist_y = (player.y - static_cast<float>(map_y)) * delta_dist_y;
        } else {
            step_y = 1;
            side_dist_y = (static_cast<float>(map_y) + 1.0f - player.y) * delta_dist_y;
        }

        // Walk the grid: at each step jump to the next vertical or horizontal grid line,
        // whichever is closer (the smaller side_dist wins). Stop on the first wall cell.
        bool hit = false;
        int side = 0;
        while (!hit) {
            if (side_dist_x < side_dist_y) {
                side_dist_x += delta_dist_x;
                map_x += step_x;
                side = 0;
            } else {
                side_dist_y += delta_dist_y;
                map_y += step_y;
                side = 1;
            }

            if (maze.blocks_raycast(map_x, map_y, has_key)) {
                hit = true;
            }
        }

        // Perpendicular distance removes the "fisheye" bulge at screen edges.
        float perp_wall_dist = 0.0f;
        if (side == 0) {
            perp_wall_dist = (static_cast<float>(map_x) - player.x + (1 - step_x) / 2.0f) / ray_dir_x;
        } else {
            perp_wall_dist = (static_cast<float>(map_y) - player.y + (1 - step_y) / 2.0f) / ray_dir_y;
        }
        if (perp_wall_dist < 0.05f) {
            perp_wall_dist = 0.05f;
        }

        int line_height = static_cast<int>(static_cast<float>(height) / perp_wall_dist);
        if (line_height < 1) {
            line_height = 1;
        }

        int draw_start = -line_height / 2 + height / 2;
        int draw_end = line_height / 2 + height / 2;
        draw_start = std::max(0, draw_start);
        draw_end = std::min(height - 1, draw_end);

        const int palette_idx = (map_x + map_y) % 4;
        uint8_t r = WALL_PALETTE[palette_idx].r;
        uint8_t g = WALL_PALETTE[palette_idx].g;
        uint8_t b = WALL_PALETTE[palette_idx].b;
        apply_distance_fog(r, g, b, perp_wall_dist);

        for (int y = draw_start; y <= draw_end; ++y) {
            set_pixel(rgba_buffer, width, column, y, r, g, b);
        }
    }
}
