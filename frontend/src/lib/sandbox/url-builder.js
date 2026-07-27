import { encodeBase64Url, SANDBOX_STATE_KEYS } from "./url-session.js";

export const SANDBOX_PARAMETER_KEYS = [...SANDBOX_STATE_KEYS, "o"];

function rawPayload(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function encodeSandboxPayloads(values) {
  const payloads = Object.fromEntries(
    SANDBOX_STATE_KEYS.map((key) => [key, encodeBase64Url(rawPayload(values[key] ?? ""))]),
  );
  payloads.o = encodeBase64Url(JSON.stringify(Object.fromEntries(
    SANDBOX_STATE_KEYS.map((key) => [key, values[key] ?? ""]),
  )));
  return payloads;
}

export function buildSandboxUrl(baseUrl, values, keys = SANDBOX_PARAMETER_KEYS) {
  const url = new URL("/sandbox", baseUrl);
  const payloads = encodeSandboxPayloads(values);

  for (const key of keys) {
    if (SANDBOX_PARAMETER_KEYS.includes(key)) url.searchParams.set(key, payloads[key]);
  }

  return url.toString();
}

export function allSandboxUrlCombinations(baseUrl, values) {
  const combinations = [];
  const payloads = encodeSandboxPayloads(values);

  for (let mask = 1; mask < 2 ** SANDBOX_STATE_KEYS.length; mask += 1) {
    const keys = SANDBOX_STATE_KEYS.filter((_, index) => mask & (1 << index));
    combinations.push({
      id: keys.join("+"),
      keys,
      payloads: Object.fromEntries(keys.map((key) => [key, payloads[key]])),
      url: buildSandboxUrl(baseUrl, values, keys),
    });
  }

  combinations.push({
    id: "o",
    keys: ["o"],
    payloads: { o: payloads.o },
    url: buildSandboxUrl(baseUrl, values, ["o"]),
  });

  return combinations.sort((left, right) => (
    left.keys.length - right.keys.length
    || left.id.localeCompare(right.id)
  ));
}
