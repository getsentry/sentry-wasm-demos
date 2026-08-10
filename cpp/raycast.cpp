#include "raycast.h"

#include <cmath>
#include <cstring>

void raycast_frame(const Maze& /*maze*/, const Player& /*player*/, uint8_t* rgba_buffer, int width, int height) {
    // Stub: solid ceiling/floor gradient so the canvas is visibly alive.
    for (int y = 0; y < height; ++y) {
        const uint8_t shade = static_cast<uint8_t>(40 + (y * 80 / height));
        for (int x = 0; x < width; ++x) {
            const int idx = (y * width + x) * 4;
            rgba_buffer[idx + 0] = shade / 3;
            rgba_buffer[idx + 1] = shade / 2;
            rgba_buffer[idx + 2] = shade;
            rgba_buffer[idx + 3] = 255;
        }
    }
}
