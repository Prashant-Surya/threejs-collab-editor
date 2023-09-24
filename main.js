import Spaces from "@ably/spaces";
import { Realtime } from "ably";
import { nanoid } from "nanoid";
import queryString from "query-string";

import { getMemberName } from "./utils";

console.log(location.search);

const parsed = queryString.parse(location.search);
console.log(parsed);

if (parsed["spaceName"] == null) {
  console.log("Space not found");
  window.location.href = window.location.href + `?spaceName=${nanoid()}`;
}

const client = new Realtime.Promise({
  key: "8CzhaQ.r2TPUw:08QKep0fif06gAgLznl4RP8RlhQsf_zq6HOeXK6vsP8",
  clientId: nanoid(),
});

const spaceName = parsed["spaceName"];

const channel = client.channels.get(spaceName);

const spaces = new Spaces(client);

const currentSpace = await spaces.get(spaceName);

currentSpace.enter({
  userName: getMemberName(),
});

window.currentSpace = currentSpace;
window.spacesClient = spaces;
window.realtimeChannel = channel;