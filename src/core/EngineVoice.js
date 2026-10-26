/**
 * Render one engine loop per machine, in the browser.
 *
 * The audio engine can layer a recorded loop under its synthesised note, but
 * shipping 19 recordings is not practical: only the Cobalt has a real take, so
 * every other machine used to re-pitch the same three shared loops and a V12
 * started from the same recording as a diesel I4.
 *
 * This renders a seamless loop from the machine's own voice profile (firing
 * order, harmonic balance, rasp, lope) so each machine has its own take:
 * a big-cube V8 is all sub-bass and wobble, a V12 is bright upper harmonics,
 * a rotary is thin and high.  It is generated once per machine and cached.
 *
 * The rpm fraction a take is rendered at (`ENGINE_LOOP_REF_FRAC`).  AudioEngine
 * plays a machine's own take back at `rpmFrac / ENGINE_LOOP_REF_FRAC`, so at
 * this fraction the loop runs at 1x and sits exactly on the machine's own note;
 * above and below it the loop glides with the revs in unison with the synth.
 */
export const ENGINE_LOOP_REF_FRAC = 0.474

const DEFAULTS = {
  firing: 2,
  redline: 7000,
  rasp: 1,
  lope: 0,
  harmonics: { sub: 0.6, saw: 0.32, saw2: 0.27, harm: 0.1 }
}

export function renderEngineLoop(ctx, sound = {}, id = 'engine') {
  if (!ctx) return null

  const firing = Math.max(0.5, sound.firing ?? DEFAULTS.firing)
  const redline = sound.redline ?? DEFAULTS.redline
  const H = { ...DEFAULTS.harmonics, ...(sound.harmonics || {}) }
  const rasp = sound.rasp ?? DEFAULTS.rasp
  const lope = sound.lope ?? DEFAULTS.lope

  const sr = ctx.sampleRate
  // the note the exhaust actually plays at the reference rpm
  const refRpm = redline * ENGINE_LOOP_REF_FRAC
  const base = Math.max(12, (refRpm * firing) / 60)

  // whole, even and quarter-cycle counts keep every partial in phase at the
  // loop point: the sub-octave needs 2 cycles, the lope modulation 4
  const cycles = Math.max(8, Math.round((1.15 * base) / 4) * 4)
  const n = Math.round((cycles / base) * sr)
  const fade = Math.round(0.02 * sr)
  const total = n + fade

  const scratch = new Float32Array(total)

  // deterministic noise: the same machine always renders the same take
  let seed = 2166136261
  for (let i = 0; i < id.length; i++) seed = ((seed ^ id.charCodeAt(i)) * 16777619) >>> 0
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const step = (2 * Math.PI * base) / sr
  const lopeStep = step / 4

  for (let i = 0; i < total; i++) {
    const ph = step * i

    // sub-octave: the bass you feel through the floor
    let w = H.sub * Math.sin(ph * 0.5)

    // harmonic stack — the saw-ish body of the note
    for (let k = 1; k <= 10; k++) {
      let amp = H.saw / k
      if (k === 2) amp += H.saw2
      if (k === 4) amp += H.harm
      if (amp !== 0) w += amp * Math.sin(ph * k + k * 0.7)
    }

    // intake / exhaust rasp
    w += (rand() * 2 - 1) * rasp * 0.11

    // uneven firing: a big-cube V8 wobbles at idle, a V-twin burbles
    if (lope > 0) w *= 1 + lope * 0.45 * Math.sin(lopeStep * i)

    scratch[i] = w
  }

  // gentle saturation gives the hard, raspy exhaust edge
  const drive = 0.9 + rasp * 0.85
  for (let i = 0; i < total; i++) scratch[i] = Math.tanh(scratch[i] * drive)

  const buffer = ctx.createBuffer(1, n, sr)
  const out = buffer.getChannelData(0)
  out.set(scratch.subarray(0, n))

  // fold the tail back over the head so the seam is inaudible: the wrap from
  // the last sample into the first continues the waveform instead of cutting it
  for (let i = 0; i < fade; i++) {
    const k = i / fade
    out[i] = scratch[i] * k + scratch[n + i] * (1 - k)
  }

  // normalise every take to the same peak; the mixer levels the rest per machine
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
  const g = peak > 0 ? 0.85 / peak : 1
  for (let i = 0; i < n; i++) out[i] *= g

  return buffer
}