// Browser geolocation. Works in Safari/Chrome only over HTTPS (or localhost).
export function getPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ error: 'unsupported' });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) => resolve({ error: e.code === 1 ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}
