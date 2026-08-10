#include "minimap.h"

#include <cmath>

namespace {

void set_pixel(uint8_t* buffer, int width, int x, int y, uint8_t r, uint8_t g, uint8_t b) {
    if (x < 0 || y < 0) {
        return;
    }
    const int idx = (y * width + x) * 4;
    buffer[idx + 0] = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = 255;
}

bool is_beacon_cell(uint8_t cell) {
    return cell == CELL_EXIT || cell == CELL_KEY;
}

void cell_color(uint8_t cell, uint8_t& r, uint8_t& g, uint8_t& b) {
    switch (cell) {
    case CELL_EXIT:
        r = 253;
        g = 184;
        b = 27;
        break;
    case CELL_KEY:
        r = 62;
        g = 220;
        b = 255;
        break;
    case CELL_ENTRANCE:
        r = 146;
        g = 221;
        b = 0;
        break;
    case CELL_WALL:
        r = 78;
        g = 42;
        b = 154;
        break;
    default:
        r = 24;
        g = 18;
        b = 37;
        break;
    }
}

void fog_color(uint8_t& r, uint8_t& g, uint8_t& b) {
    r = 14;
    g = 10;
    b = 22;
}

void fill_rect(uint8_t* buffer, int width, int x0, int y0, int w, int h, uint8_t r, uint8_t g, uint8_t b) {
    for (int y = y0; y < y0 + h; ++y) {
        for (int x = x0; x < x0 + w; ++x) {
            set_pixel(buffer, width, x, y, r, g, b);
        }
    }
}

void draw_player_marker(uint8_t* buffer, int width, int cx, int cy, float angle) {
    for (int dy = -2; dy <= 2; ++dy) {
        for (int dx = -2; dx <= 2; ++dx) {
            if (dx * dx + dy * dy <= 5) {
                set_pixel(buffer, width, cx + dx, cy + dy, 255, 69, 168);
            }
        }
    }

    const int tip_x = cx + static_cast<int>(std::cos(angle) * 6.0f);
    const int tip_y = cy + static_cast<int>(std::sin(angle) * 6.0f);
    set_pixel(buffer, width, tip_x, tip_y, 253, 184, 27);
}

} // namespace

void draw_minimap(
    const Maze& maze,
    const Player& player,
    const bool explored[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    uint8_t* rgba_buffer,
    int screen_width,
    int screen_height) {
    const int map_x = screen_width - MINIMAP_SIZE - 8;
    const int map_y = 8;
    const int maze_w = maze.width();
    const int maze_h = maze.height();
    const int cell_px = MINIMAP_SIZE / maze_w;

    fill_rect(rgba_buffer, screen_width, map_x - 2, map_y - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4, 24, 18, 37);

    for (int gy = 0; gy < maze_h; ++gy) {
        for (int gx = 0; gx < maze_w; ++gx) {
            uint8_t r = 0;
            uint8_t g = 0;
            uint8_t b = 0;

            if (explored[gy][gx]) {
                cell_color(maze.cell(gx, gy), r, g, b);
            } else {
                fog_color(r, g, b);
            }

            const int px0 = map_x + gx * cell_px;
            const int py0 = map_y + gy * cell_px;
            fill_rect(rgba_buffer, screen_width, px0, py0, cell_px, cell_px, r, g, b);
        }
    }

    // Keys and exit stay visible through unexplored fog on the minimap only.
    for (int gy = 0; gy < maze_h; ++gy) {
        for (int gx = 0; gx < maze_w; ++gx) {
            const uint8_t cell = maze.cell(gx, gy);
            if (!is_beacon_cell(cell)) {
                continue;
            }

            uint8_t r = 0;
            uint8_t g = 0;
            uint8_t b = 0;
            cell_color(cell, r, g, b);

            const int px0 = map_x + gx * cell_px;
            const int py0 = map_y + gy * cell_px;
            fill_rect(rgba_buffer, screen_width, px0, py0, cell_px, cell_px, r, g, b);
        }
    }

    const int player_px = map_x + static_cast<int>(player.x * static_cast<float>(cell_px));
    const int player_py = map_y + static_cast<int>(player.y * static_cast<float>(cell_px));
    draw_player_marker(rgba_buffer, screen_width, player_px, player_py, player.angle);
}
