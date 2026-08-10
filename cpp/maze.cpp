#include "maze.h"

#include <algorithm>
#include <cstring>

namespace {

struct Rng {
    uint32_t state;

    explicit Rng(uint32_t seed) : state(seed != 0 ? seed : 1u) {}

    uint32_t next() {
        state = state * 1664525u + 1013904223u;
        return state;
    }

    int range(int lo, int hi_inclusive) {
        const int span = hi_inclusive - lo + 1;
        return lo + static_cast<int>(next() % static_cast<uint32_t>(span));
    }
};

bool in_carve_grid(int x, int y) {
    return x >= 1 && y >= 1 && x <= MAZE_WIDTH - 2 && y <= MAZE_HEIGHT - 2 && (x % 2 == 1) && (y % 2 == 1);
}

void shuffle_dirs(int dirs[4][2], Rng& rng) {
    for (int i = 3; i > 0; --i) {
        const int j = rng.range(0, i);
        const int tx = dirs[i][0];
        const int ty = dirs[i][1];
        dirs[i][0] = dirs[j][0];
        dirs[i][1] = dirs[j][1];
        dirs[j][0] = tx;
        dirs[j][1] = ty;
    }
}

void carve_recursive(uint8_t grid[MAZE_HEIGHT][MAZE_WIDTH], int x, int y, Rng& rng) {
    grid[y][x] = CELL_OPEN;
    int dirs[4][2] = {{0, -2}, {0, 2}, {-2, 0}, {2, 0}};
    shuffle_dirs(dirs, rng);

    for (int i = 0; i < 4; ++i) {
        const int nx = x + dirs[i][0];
        const int ny = y + dirs[i][1];
        if (!in_carve_grid(nx, ny) || grid[ny][nx] != CELL_WALL) {
            continue;
        }
        grid[y + dirs[i][1] / 2][x + dirs[i][0] / 2] = CELL_OPEN;
        carve_recursive(grid, nx, ny, rng);
    }
}

bool reachable(
    const uint8_t grid[MAZE_HEIGHT][MAZE_WIDTH],
    int from_x,
    int from_y,
    int to_x,
    int to_y) {
    bool seen[MAZE_HEIGHT][MAZE_WIDTH];
    std::memset(seen, 0, sizeof(seen));

    int queue_x[MAZE_WIDTH * MAZE_HEIGHT];
    int queue_y[MAZE_WIDTH * MAZE_HEIGHT];
    int head = 0;
    int tail = 0;

    queue_x[tail] = from_x;
    queue_y[tail] = from_y;
    ++tail;
    seen[from_y][from_x] = true;

    while (head < tail) {
        const int x = queue_x[head];
        const int y = queue_y[head];
        ++head;

        if (x == to_x && y == to_y) {
            return true;
        }

        static constexpr int kDx[4] = {1, -1, 0, 0};
        static constexpr int kDy[4] = {0, 0, 1, -1};
        for (int i = 0; i < 4; ++i) {
            const int nx = x + kDx[i];
            const int ny = y + kDy[i];
            if (nx < 0 || ny < 0 || nx >= MAZE_WIDTH || ny >= MAZE_HEIGHT || seen[ny][nx]) {
                continue;
            }
            const uint8_t c = grid[ny][nx];
            if (c == CELL_WALL) {
                continue;
            }
            seen[ny][nx] = true;
            queue_x[tail] = nx;
            queue_y[tail] = ny;
            ++tail;
        }
    }

    return false;
}

int bfs_distances(
    const uint8_t grid[MAZE_HEIGHT][MAZE_WIDTH],
    int from_x,
    int from_y,
    int dist[MAZE_HEIGHT][MAZE_WIDTH]) {
    for (int y = 0; y < MAZE_HEIGHT; ++y) {
        for (int x = 0; x < MAZE_WIDTH; ++x) {
            dist[y][x] = -1;
        }
    }

    int queue_x[MAZE_WIDTH * MAZE_HEIGHT];
    int queue_y[MAZE_WIDTH * MAZE_HEIGHT];
    int head = 0;
    int tail = 0;

    queue_x[tail] = from_x;
    queue_y[tail] = from_y;
    ++tail;
    dist[from_y][from_x] = 0;

    while (head < tail) {
        const int x = queue_x[head];
        const int y = queue_y[head];
        const int d = dist[y][x];
        ++head;

        static constexpr int kDx[4] = {1, -1, 0, 0};
        static constexpr int kDy[4] = {0, 0, 1, -1};
        for (int i = 0; i < 4; ++i) {
            const int nx = x + kDx[i];
            const int ny = y + kDy[i];
            if (nx < 0 || ny < 0 || nx >= MAZE_WIDTH || ny >= MAZE_HEIGHT || dist[ny][nx] >= 0) {
                continue;
            }
            if (grid[ny][nx] == CELL_WALL) {
                continue;
            }
            dist[ny][nx] = d + 1;
            queue_x[tail] = nx;
            queue_y[tail] = ny;
            ++tail;
        }
    }

    return tail;
}

// Reconstruct the unique spawn→exit route (perfect maze tree) into path_x/y; returns path length.
int build_path(
    const uint8_t grid[MAZE_HEIGHT][MAZE_WIDTH],
    int from_x,
    int from_y,
    int to_x,
    int to_y,
    int path_x[],
    int path_y[],
    int max_len) {
    int dist[MAZE_HEIGHT][MAZE_WIDTH];
    int parent_x[MAZE_HEIGHT][MAZE_WIDTH];
    int parent_y[MAZE_HEIGHT][MAZE_WIDTH];

    for (int y = 0; y < MAZE_HEIGHT; ++y) {
        for (int x = 0; x < MAZE_WIDTH; ++x) {
            dist[y][x] = -1;
            parent_x[y][x] = -1;
            parent_y[y][x] = -1;
        }
    }

    int queue_x[MAZE_WIDTH * MAZE_HEIGHT];
    int queue_y[MAZE_WIDTH * MAZE_HEIGHT];
    int head = 0;
    int tail = 0;

    queue_x[tail] = from_x;
    queue_y[tail] = from_y;
    ++tail;
    dist[from_y][from_x] = 0;

    while (head < tail) {
        const int x = queue_x[head];
        const int y = queue_y[head];
        ++head;

        if (x == to_x && y == to_y) {
            break;
        }

        static constexpr int kDx[4] = {1, -1, 0, 0};
        static constexpr int kDy[4] = {0, 0, 1, -1};
        for (int i = 0; i < 4; ++i) {
            const int nx = x + kDx[i];
            const int ny = y + kDy[i];
            if (nx < 0 || ny < 0 || nx >= MAZE_WIDTH || ny >= MAZE_HEIGHT || dist[ny][nx] >= 0) {
                continue;
            }
            if (grid[ny][nx] == CELL_WALL) {
                continue;
            }
            dist[ny][nx] = dist[y][x] + 1;
            parent_x[ny][nx] = x;
            parent_y[ny][nx] = y;
            queue_x[tail] = nx;
            queue_y[tail] = ny;
            ++tail;
        }
    }

    if (dist[to_y][to_x] < 0) {
        return 0;
    }

    int len = 0;
    int cx = to_x;
    int cy = to_y;
    while (len < max_len) {
        path_x[len] = cx;
        path_y[len] = cy;
        ++len;
        if (cx == from_x && cy == from_y) {
            break;
        }
        const int px = parent_x[cy][cx];
        const int py = parent_y[cy][cx];
        cx = px;
        cy = py;
    }

    for (int i = 0; i < len / 2; ++i) {
        const int tx = path_x[i];
        const int ty = path_y[i];
        path_x[i] = path_x[len - 1 - i];
        path_y[i] = path_y[len - 1 - i];
        path_x[len - 1 - i] = tx;
        path_y[len - 1 - i] = ty;
    }

    return len;
}

void place_key_and_doors_on_path(
    uint8_t grid[MAZE_HEIGHT][MAZE_WIDTH],
    int door_x[],
    int door_y[],
    int& door_count,
    int level,
    const int path_x[],
    const int path_y[],
    int path_len) {
    door_count = 0;
    if (path_len < 4) {
        return;
    }

    int num_doors = level;
    if (num_doors > MAX_DOORS) {
        num_doors = MAX_DOORS;
    }
    if (num_doors < 1) {
        num_doors = 1;
    }

    // Each door needs one open path cell before it (for its key): min index gap of 2.
    const int max_doors_by_path = (path_len - 2) / 2;
    if (num_doors > max_doors_by_path) {
        num_doors = max_doors_by_path;
    }
    if (num_doors < 1) {
        return;
    }

    int door_indices[MAX_DOORS];
    for (int d = 0; d < num_doors; ++d) {
        const int prev = (d == 0) ? 0 : door_indices[d - 1];
        const int min_idx = prev + 2;
        const int remaining = num_doors - d - 1;
        const int max_idx = path_len - 2 - remaining * 2;
        if (min_idx > max_idx) {
            break;
        }

        const int door_idx = min_idx + (max_idx - min_idx) / 2;
        if (grid[path_y[door_idx]][path_x[door_idx]] != CELL_OPEN) {
            break;
        }

        grid[path_y[door_idx]][path_x[door_idx]] = CELL_DOOR;
        door_indices[door_count] = door_idx;
        door_x[door_count] = path_x[door_idx];
        door_y[door_count] = path_y[door_idx];
        ++door_count;
    }

    // Key k sits on the path after door k-1 (or spawn) and before door k.
    for (int k = 0; k < door_count; ++k) {
        const int seg_start = (k == 0) ? 1 : door_indices[k - 1] + 1;
        const int seg_end = door_indices[k] - 1;
        if (seg_start > seg_end) {
            continue;
        }
        const int key_idx = (seg_start + seg_end) / 2;
        if (grid[path_y[key_idx]][path_x[key_idx]] == CELL_OPEN) {
            grid[path_y[key_idx]][path_x[key_idx]] = CELL_KEY;
        }
    }
}

void add_difficulty_walls(uint8_t grid[MAZE_HEIGHT][MAZE_WIDTH], int level, Rng& rng, int spawn_x, int spawn_y, int exit_x, int exit_y) {
    const int attempts = level * 4;
    for (int i = 0; i < attempts; ++i) {
        const int x = rng.range(1, MAZE_WIDTH - 2);
        const int y = rng.range(1, MAZE_HEIGHT - 2);
        if (grid[y][x] != CELL_OPEN) {
            continue;
        }
        if ((x == spawn_x && y == spawn_y) || (x == exit_x && y == exit_y)) {
            continue;
        }

        const uint8_t saved = grid[y][x];
        grid[y][x] = CELL_WALL;
        if (!reachable(grid, spawn_x, spawn_y, exit_x, exit_y)) {
            grid[y][x] = saved;
        }
    }
}

} // namespace

Maze::Maze() : grid_(), door_count_(0), start_x_(1), start_y_(1), start_angle_(0.0f), level_(1) {
    std::memset(grid_, CELL_WALL, sizeof(grid_));
}

void Maze::place_key_and_doors_on_path(const int path_x[], const int path_y[], int path_len) {
    ::place_key_and_doors_on_path(grid_, door_x_, door_y_, door_count_, level_, path_x, path_y, path_len);
}

void Maze::generate(int seed, int level) {
    std::memset(grid_, CELL_WALL, sizeof(grid_));
    level_ = level < 1 ? 1 : level;

    Rng rng(static_cast<uint32_t>(seed) ^ static_cast<uint32_t>(level_ * 2654435761u));

    // West entrance gap in the outer wall; carve from that row so it stays connected.
    const int entrance_y = 1 + 2 * rng.range(0, (MAZE_HEIGHT - 2) / 2);
    grid_[entrance_y][0] = CELL_ENTRANCE;
    grid_[entrance_y][1] = CELL_OPEN;
    start_x_ = 1;
    start_y_ = entrance_y;
    start_angle_ = 0.0f;

    carve_recursive(grid_, 1, entrance_y, rng);

    int dist[MAZE_HEIGHT][MAZE_WIDTH];
    bfs_distances(grid_, start_x_, start_y_, dist);

    // Exit gap on the opposite margin (east): inner win tile + border hole.
    int best_x = MAZE_WIDTH - 2;
    int best_y = entrance_y;
    int best_dist = -1;
    for (int y = 1; y < MAZE_HEIGHT - 1; ++y) {
        const int x = MAZE_WIDTH - 2;
        if (grid_[y][x] == CELL_WALL || dist[y][x] < 0) {
            continue;
        }
        if (dist[y][x] > best_dist) {
            best_dist = dist[y][x];
            best_x = x;
            best_y = y;
        }
    }

    if (best_dist < 0) {
        grid_[entrance_y][MAZE_WIDTH - 2] = CELL_OPEN;
        best_x = MAZE_WIDTH - 2;
        best_y = entrance_y;
        bfs_distances(grid_, start_x_, start_y_, dist);
        best_dist = dist[best_y][best_x];
    }

    grid_[best_y][best_x] = CELL_EXIT;
    grid_[best_y][MAZE_WIDTH - 1] = CELL_EXIT;

    add_difficulty_walls(grid_, level_, rng, start_x_, start_y_, best_x, best_y);

    int path_x[MAZE_WIDTH * MAZE_HEIGHT];
    int path_y[MAZE_WIDTH * MAZE_HEIGHT];
    const int path_len = build_path(grid_, start_x_, start_y_, best_x, best_y, path_x, path_y, MAZE_WIDTH * MAZE_HEIGHT);
    place_key_and_doors_on_path(path_x, path_y, path_len);
}

uint8_t Maze::cell(int x, int y) const {
    if (x < 0 || y < 0 || x >= MAZE_WIDTH || y >= MAZE_HEIGHT) {
        return CELL_WALL;
    }
    return grid_[y][x];
}

void Maze::set_cell(int x, int y, uint8_t value) {
    if (x < 0 || y < 0 || x >= MAZE_WIDTH || y >= MAZE_HEIGHT) {
        return;
    }
    grid_[y][x] = value;
}

int Maze::door_index_at(int x, int y) const {
    for (int i = 0; i < door_count_; ++i) {
        if (door_x_[i] == x && door_y_[i] == y) {
            return i;
        }
    }
    return -1;
}

bool Maze::blocks_movement(int x, int y, int keys_collected) const {
    const uint8_t c = cell(x, y);
    if (c == CELL_OPEN || c == CELL_EXIT || c == CELL_KEY || c == CELL_ENTRANCE) {
        return false;
    }
    if (c == CELL_DOOR) {
        const int door_idx = door_index_at(x, y);
        if (door_idx < 0) {
            return true;
        }
        return keys_collected < door_idx + 1;
    }
    return true;
}

bool Maze::blocks_raycast(int x, int y, int keys_collected) const {
    const uint8_t c = cell(x, y);
    if (c == CELL_OPEN || c == CELL_EXIT || c == CELL_KEY || c == CELL_ENTRANCE) {
        return false;
    }
    if (c == CELL_DOOR) {
        const int door_idx = door_index_at(x, y);
        if (door_idx < 0) {
            return true;
        }
        return keys_collected < door_idx + 1;
    }
    return true;
}
