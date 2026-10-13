#version 300 es

layout(location = 0) in vec3 a_state;

uniform float u_aspect;

void main() {
    vec3 p = vec3(
        a_state.x / 24.0,
        (a_state.z - 25.0) / 27.0,
        a_state.y / 30.0
    );

    float yaw = 0.55;
    float pitch = -0.3;

    vec3 rotated = vec3(
        cos(yaw) * p.x + sin(yaw) * p.z,
        p.y,
        -sin(yaw) * p.x + cos(yaw) * p.z
    );

    vec3 tilted = vec3(
        rotated.x,
        cos(pitch) * rotated.y - sin(pitch) * rotated.z,
        sin(pitch) * rotated.y + cos(pitch) * rotated.z
    );

    float scale = 2.8 / (4.0 - tilted.z);

    gl_Position = vec4(
        tilted.x * scale * 1.5 / u_aspect,
        tilted.y * scale * 1.5,
        tilted.z * 0.08,
        1.0
    );
}