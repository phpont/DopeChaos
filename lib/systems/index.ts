/* System registration entry point — import this to ensure all systems are available */

import { registerSystem } from "./registry";
import { logisticSystem } from "./logistic";
import { lorenzSystem } from "./lorenz";
import { juliaSystem } from "./julia";

registerSystem(logisticSystem);
registerSystem(lorenzSystem);
registerSystem(juliaSystem);

export { getSystem, getAllSystems, getSystemIds } from "./registry";
