/* Global constants for DopeChaos */

export const ASCII_LOGO = `________                         _________ .__
\\______ \\   ____ ______   ____   \\_   ___ \\|  |__ _____    ____  ______
 |    |  \\ /  _ \\\\____ \\_/ __ \\  /    \\  \\/|  |  \\\\__  \\  /  _ \\/  ___/
 |    \`   (  <_> )  |_> >  ___/  \\     \\___|   Y  \\/ __ \\(  <_> )___ \\
/_______  /\\____/|   __/ \\___  >  \\______  /___|  (____  /\\____/____  >
        \\/       |__|        \\/          \\/     \\/     \\/           \\/ `;

export const ASCII_CHARSETS: Record<string, string> = {
  standard: " .:-=+*#%@",
  blocks: " ░▒▓█",
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  minimal: " .oO@",
};

export const REFINE_DEBOUNCE_MS = 200;
export const DEFAULT_TILE_SIZE = 128;
export const MOBILE_BREAKPOINT = 768;
