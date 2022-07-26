/* eslint-disable @typescript-eslint/naming-convention */
import { GeneralObject } from "./util";
export const userSettings = [
    {
        "yaml.schemas": {
            "https://github.com/eravatee/caliper/blob/packages/caliper-vscode/artifacts/default.json?raw=true": "*.default.runtime.yaml",
            "https://github.com/eravatee/caliper/blob/json-schema/packages/caliper-vscode/artifacts/benchmark.json?raw=true": "*.benchmark.config.yaml",
            "https://github.com/eravatee/caliper/blob/json-schema/packages/caliper-vscode/artifacts/ethereum-besu.json?raw=true": "*.ethereum.net.json",
            "https://github.com/eravatee/caliper/blob/json-schema/packages/caliper-vscode/artifacts/fabric.json?raw=true": "*.fabric.net.yaml"
        }
    }
] as GeneralObject[];

