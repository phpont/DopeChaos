#version 300 es

layout(location = 0) in vec3 a_state;

uniform float u_aspect;

void main() {
    vec3 eye = vec3(45.0, -70.0, 40.0);
    vec3 target = vec3(0.0, 0.0, 24.0);
    vec3 world_up = vec3(0.0, 0.0, 1.0);

    vec3 forward = normalize(target - eye);
    vec3 right = normalize(cross(forward, world_up));
    vec3 up = cross(right, forward);

    vec3 relative = a_state - eye;

    float camera_x = dot(relative, right);
    float camera_y = dot(relative, up);
    float depth = dot(relative, forward);

    float fov = radians(39.0);
    float focal = 1.0 / tan(fov * 0.5);

    float near_plane = 1.0;
    float far_plane = 300.0;

    float clip_z = (
        (far_plane + near_plane) * depth
        - 2.0 * far_plane * near_plane
    ) / (far_plane - near_plane);

    gl_Position = vec4(
        camera_x * focal / u_aspect,
        camera_y * focal,
        clip_z,
        depth
    );

    gl_PointSize = 5.0;
}
