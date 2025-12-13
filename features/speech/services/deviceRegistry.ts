type DeviceSelection = {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
};

const registry: DeviceSelection = {
  inputDeviceId: null,
  outputDeviceId: null,
};

export function setPreferredInputDevice(deviceId: string | null) {
  registry.inputDeviceId = deviceId ?? null;
}

export function getPreferredInputDevice(): string | null {
  return registry.inputDeviceId;
}

export function setPreferredOutputDevice(deviceId: string | null) {
  registry.outputDeviceId = deviceId ?? null;
}

export function getPreferredOutputDevice(): string | null {
  return registry.outputDeviceId;
}
