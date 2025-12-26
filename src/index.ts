import { API } from "homebridge";
import { PLATFORM_NAME } from "./types";
import { ShellyBluPlatform } from "./platform";

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, ShellyBluPlatform);
};
