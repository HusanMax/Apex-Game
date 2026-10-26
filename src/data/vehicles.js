/**
 * Garage roster — 19 machines (19 GLB models), each with its own real-world
 * engine voice and performance package.
 *
 * Every machine carries its own physics package (mass, gearing, tyre grip,
 * drag, top speed), its own engine voice profile and its own body model.
 * Engine sounds are synthesised live with Web Audio so every machine sounds
 * different: the cylinder count, firing order, turbo/blower, redline and
 * harmonic balance are all per-machine.  On top of the synth every machine gets
 * a recorded layer of its own: a real take if one is listed in
 * public/audio/engines/manifest.json, otherwise a loop rendered from its own
 * profile by src/core/EngineVoice.js, so no two machines share a recording.
 */

const wb = (wheelBase, frontBias = 0.48) => ({
  wheelBase,
  a: wheelBase * frontBias,
  b: wheelBase * (1 - frontBias)
})

export const VEHICLES = [
  /* ================================================================ COBALT */
  {
    id: 'cobalt',
    name: 'Chevrolet Cobalt LTZ',
    short: 'Cobalt LTZ',
    type: 'car',
    klass: 'TUNER',
    year: 2007,
    tagline: 'Yengil ko‘cha kupe. Oldingi g‘ildirakda tortadi, turbo I4 xirillashi.',
    paint: 0xe8ecf0,
    rim: 0xc6ced6,
    accent: '#19ff8a',
    engine: '2.2L Ecotec Turbo I4',
    drivetrain: 'FWD',
    gearbox: '5 pog‘onali mexanika',
    powerHp: 240,
    torqueNm: 300,
    weightKg: 1180,
    zeroToHundred: 5.1,
    topSpeedKph: 250,
    stats: { speed: 66, accel: 68, handling: 63, braking: 60 },
    soundFlavor: 'Turbo to‘rt silindr: xirillash, gazdan tushganda dump-valve “psssh”',
    model: { kind: 'glb', url: '/models/chevrolet_cobalt_ltz.glb', style: 'sports' },
    sound: {
      cylinders: 4, firing: 2, redline: 6800, idle: 820,
      turbo: true, rasp: 1.0, sub: 0.55, brightness: 1.0, lope: 0, useSamples: true,
      harmonics: { sub: 0.45, saw: 0.42, saw2: 0.3, harm: 0.14 },
      samplePitch: 1.12, sampleLevel: 0.85
    },
    physics: {
      ...wb(2.62, 0.48),
      mass: 1180, iz: 2005, cgHeight: 0.40, trackWidth: 1.50, mu: 1.50,
      wheelRadius: 0.33,
      gearRatios: [3.58, 2.02, 1.35, 0.98, 0.75],
      finalDrive: 3.94, redline: 6800, idle: 820, torque: 300,
      driveFront: 1.0, driveRear: 0.0,
      dragCd: 0.31, area: 2.00, brakeForce: 21000, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 250, maxSteer: 0.64, maxSteerHigh: 0.16
    }
  },

  /* ================================================================ SKYLINE */
  {
    id: 'skyline',
    name: 'Nissan Skyline GT-R R34',
    short: 'Skyline R34',
    type: 'car',
    klass: 'JDM LEGEND',
    year: 1999,
    tagline: 'RB26 ikki turbo, ATTESA AWD. Startda shafqatsiz, yo‘lda ham sokin.',
    paint: 0x1e5fa8,
    rim: 0xc9a227,
    accent: '#4aa8ff',
    engine: '2.6L RB26DETT Twin-Turbo I6',
    drivetrain: 'AWD',
    gearbox: '6 pog‘onali mexanika',
    powerHp: 480,
    torqueNm: 640,
    weightKg: 1560,
    zeroToHundred: 2.8,
    topSpeedKph: 315,
    stats: { speed: 88, accel: 95, handling: 86, braking: 82 },
    soundFlavor: 'Ikki turbo to‘g‘ri oltilik: chuqur xirillash, turbo hushtagi',
    model: { kind: 'glb', url: '/models/skyline.glb', style: 'jdm' },
    sound: {
      cylinders: 6, firing: 3, redline: 8000, idle: 900,
      turbo: true, rasp: 0.85, sub: 0.62, brightness: 1.05, lope: 0, useSamples: true,
      harmonics: { sub: 0.55, saw: 0.35, saw2: 0.32, harm: 0.18 },
      samplePitch: 0.9, sampleLevel: 0.8
    },
    physics: {
      ...wb(2.665, 0.48),
      mass: 1560, iz: 2808, cgHeight: 0.45, trackWidth: 1.56, mu: 1.70,
      wheelRadius: 0.33,
      gearRatios: [3.83, 2.36, 1.69, 1.31, 1.00, 0.79],
      finalDrive: 3.55, redline: 8000, idle: 900, torque: 640,
      driveFront: 0.35, driveRear: 0.65,
      dragCd: 0.33, area: 1.95, brakeForce: 26000, brakeFront: 0.66, brakeRear: 0.34,
      topSpeedKph: 315, maxSteer: 0.66, maxSteerHigh: 0.17
    }
  },

  /* ================================================================ SUPRA */
  {
    id: 'supra',
    name: 'Toyota Supra MK4',
    short: 'Supra MK4',
    type: 'car',
    klass: 'DRAG TUNER',
    year: 1997,
    tagline: '2JZ-GTE. To‘g‘ri yo‘lda deyarli cheksiz tortish kuchi.',
    paint: 0xff8a1e,
    rim: 0x1b1e22,
    accent: '#ff9d2e',
    engine: '3.0L 2JZ-GTE Twin-Turbo I6',
    drivetrain: 'RWD',
    gearbox: '6 pog‘onali mexanika',
    powerHp: 420,
    torqueNm: 620,
    weightKg: 1500,
    zeroToHundred: 3.9,
    topSpeedKph: 305,
    stats: { speed: 84, accel: 82, handling: 78, braking: 78 },
    soundFlavor: 'Silliq oltilik, uzun turbo hushtagi va gazdan tushganda poplar',
    model: { kind: 'glb', url: '/models/toyota_supra_m4.glb', style: 'sports' },
    sound: {
      cylinders: 6, firing: 3, redline: 7200, idle: 850,
      turbo: true, rasp: 0.75, sub: 0.7, brightness: 0.95, lope: 0, useSamples: true,
      harmonics: { sub: 0.6, saw: 0.3, saw2: 0.34, harm: 0.15 },
      samplePitch: 0.86, sampleLevel: 0.8
    },
    physics: {
      ...wb(2.55, 0.48),
      mass: 1500, iz: 2625, cgHeight: 0.44, trackWidth: 1.54, mu: 1.62,
      wheelRadius: 0.33,
      gearRatios: [3.83, 2.36, 1.69, 1.31, 1.00, 0.79],
      finalDrive: 3.13, redline: 7200, idle: 850, torque: 620,
      driveFront: 0.0, driveRear: 1.0,
      dragCd: 0.32, area: 1.98, brakeForce: 25000, brakeFront: 0.66, brakeRear: 0.34,
      topSpeedKph: 305, maxSteer: 0.66, maxSteerHigh: 0.16
    }
  },

  /* ================================================================ HELLCAT */
  {
    id: 'hellcat',
    name: 'Dodge Challenger SRT',
    short: 'Challenger SRT',
    type: 'car',
    klass: 'MUSCLE',
    year: 2015,
    tagline: '6.2 litr, kompressor va faqat orqa g‘ildirak.',
    paint: 0x15181c,
    rim: 0x8f969f,
    accent: '#ff3b4e',
    engine: '6.2L Supercharged V8 (Hellcat)',
    drivetrain: 'RWD',
    gearbox: '6 pog‘onali mexanika',
    powerHp: 707,
    torqueNm: 880,
    weightKg: 1990,
    zeroToHundred: 4.1,
    topSpeedKph: 328,
    stats: { speed: 91, accel: 80, handling: 66, braking: 76 },
    soundFlavor: 'Past oktavali V8 gumburlashi, kompressor xirillashi',
    model: { kind: 'glb', url: '/models/dodge_challenger_srt.glb', style: 'muscle' },
    sound: {
      cylinders: 8, firing: 4, redline: 6200, idle: 700,
      turbo: true, turboKind: 'blower', rasp: 1.1, sub: 0.95, brightness: 0.75, lope: 0.25, useSamples: true,
      harmonics: { sub: 1.0, saw: 0.22, saw2: 0.3, harm: 0.1 },
      samplePitch: 0.62, sampleLevel: 0.95
    },
    physics: {
      ...wb(2.95, 0.48),
      mass: 1990, iz: 3780, cgHeight: 0.50, trackWidth: 1.62, mu: 1.58,
      wheelRadius: 0.36,
      gearRatios: [2.97, 1.82, 1.35, 1.00, 0.80, 0.62],
      finalDrive: 3.09, redline: 6200, idle: 700, torque: 880,
      driveFront: 0.0, driveRear: 1.0,
      dragCd: 0.33, area: 2.18, brakeForce: 30000, brakeFront: 0.64, brakeRear: 0.36,
      topSpeedKph: 328, maxSteer: 0.62, maxSteerHigh: 0.15
    }
  },

  /* ================================================================ AVENTADOR */
  {
    id: 'aventador',
    name: 'Lamborghini Aventador SV',
    short: 'Aventador SV',
    type: 'car',
    klass: 'SUPERCAR',
    year: 2015,
    tagline: 'V12 qichqirig‘i, karbon monokok va 350 km/soat.',
    paint: 0xf7d117,
    rim: 0x111315,
    accent: '#ffd400',
    engine: '6.5L Naturally Aspirated V12',
    drivetrain: 'AWD',
    gearbox: '7 pog‘onali sekvensial',
    powerHp: 740,
    torqueNm: 720,
    weightKg: 1575,
    zeroToHundred: 2.5,
    topSpeedKph: 350,
    stats: { speed: 100, accel: 99, handling: 94, braking: 92 },
    soundFlavor: 'Yuqori aylanishli V12 faryodi, har uzatishda “crack”',
    model: { kind: 'glb', url: '/models/lamborghini_aventador_auto_veloce.glb', style: 'super' },
    sound: {
      cylinders: 12, firing: 6, redline: 8500, idle: 900,
      turbo: false, rasp: 0.55, sub: 0.5, brightness: 1.35, lope: 0, useSamples: false,
      harmonics: { sub: 0.35, saw: 0.3, saw2: 0.4, harm: 0.42 },
      samplePitch: 1.25, sampleLevel: 0
    },
    physics: {
      ...wb(2.70, 0.48),
      mass: 1575, iz: 2835, cgHeight: 0.38, trackWidth: 1.66, mu: 1.82,
      wheelRadius: 0.35,
      gearRatios: [3.91, 2.44, 1.70, 1.32, 1.05, 0.88, 0.72],
      finalDrive: 3.42, redline: 8500, idle: 900, torque: 720,
      driveFront: 0.4, driveRear: 0.6,
      dragCd: 0.31, area: 2.05, brakeForce: 33000, brakeFront: 0.70, brakeRear: 0.30,
      topSpeedKph: 350, maxSteer: 0.7, maxSteerHigh: 0.18
    }
  },

  /* ================================================================ ECLIPSE */
  {
    id: 'eclipse',
    name: 'Mitsubishi Eclipse GS-T',
    short: 'Eclipse GS-T',
    type: 'car',
    klass: '90s TURBO',
    year: 1995,
    tagline: '4G63T turbo, oldingi g‘ildirak. Tez va o‘tkir, 90s jap tuning.',
    paint: 0x2a4a6e,
    rim: 0xb0b8c0,
    accent: '#00e5ff',
    engine: '2.0L 4G63T Turbo I4',
    drivetrain: 'FWD',
    gearbox: '5 pog‘onali mexanika',
    powerHp: 210,
    torqueNm: 280,
    weightKg: 1320,
    zeroToHundred: 5.6,
    topSpeedKph: 235,
    stats: { speed: 62, accel: 64, handling: 60, braking: 56 },
    soundFlavor: 'Kichik turbo to‘rtlik: yuqori ton xirillash, qisqa dump-valve',
    model: { kind: 'glb', url: '/models/eclipse.glb', style: 'sports' },
    sound: {
      cylinders: 4, firing: 2, redline: 7000, idle: 850,
      turbo: true, rasp: 0.95, sub: 0.4, brightness: 1.15, lope: 0, useSamples: true,
      harmonics: { sub: 0.35, saw: 0.45, saw2: 0.32, harm: 0.16 },
      samplePitch: 1.18, sampleLevel: 0.8
    },
    physics: {
      ...wb(2.50, 0.48),
      mass: 1320, iz: 2250, cgHeight: 0.42, trackWidth: 1.48, mu: 1.45,
      wheelRadius: 0.32,
      gearRatios: [3.25, 1.95, 1.35, 1.00, 0.78],
      finalDrive: 4.15, redline: 7000, idle: 850, torque: 280,
      driveFront: 1.0, driveRear: 0.0,
      dragCd: 0.34, area: 1.92, brakeForce: 19500, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 235, maxSteer: 0.64, maxSteerHigh: 0.16
    }
  },

  /* ================================================================ RX7 */
  {
    id: 'rx7',
    name: 'Mazda RX-7 FD Veilside',
    short: 'RX-7 FD',
    type: 'car',
    klass: 'ROTARY',
    year: 1997,
    tagline: '13B-REW rotatsion dvigatel, ikki turbo. Tokyo drift afzali.',
    paint: 0xe0212e,
    rim: 0x1a1a1a,
    accent: '#ff5566',
    engine: '1.3L 13B-REW Twin-Turbo Rotary',
    drivetrain: 'RWD',
    gearbox: '5 pog‘onali mexanika',
    powerHp: 280,
    torqueNm: 320,
    weightKg: 1310,
    zeroToHundred: 4.4,
    topSpeedKph: 250,
    stats: { speed: 72, accel: 76, handling: 85, braking: 70 },
    soundFlavor: 'Rotatsion dvigatel: o‘ziga xos nola, yumshoq turbo spool',
    model: { kind: 'glb', url: '/models/rx7.glb', style: 'sports' },
    sound: {
      // rotatsion dvigatel — boshqa hech narsaga o‘xshamaydi: yuqori ton,
      // nola, kam oktava sub-bass
      cylinders: 2, firing: 1, redline: 8200, idle: 1000,
      turbo: true, rasp: 0.9, sub: 0.3, brightness: 1.5, lope: 0, useSamples: true,
      harmonics: { sub: 0.2, saw: 0.35, saw2: 0.5, harm: 0.45 },
      samplePitch: 1.3, sampleLevel: 0.85
    },
    physics: {
      ...wb(2.42, 0.48),
      mass: 1310, iz: 2250, cgHeight: 0.40, trackWidth: 1.49, mu: 1.68,
      wheelRadius: 0.32,
      gearRatios: [3.40, 2.15, 1.45, 1.08, 0.85],
      finalDrive: 4.10, redline: 8200, idle: 1000, torque: 320,
      driveFront: 0.0, driveRear: 1.0,
      dragCd: 0.30, area: 1.86, brakeForce: 23000, brakeFront: 0.65, brakeRear: 0.35,
      topSpeedKph: 250, maxSteer: 0.66, maxSteerHigh: 0.17
    }
  },

  /* ================================================================ RS6 */
  {
    id: 'rs6',
    name: 'Audi RS6-R (ABT)',
    short: 'RS6-R',
    type: 'car',
    klass: 'SUPER WAGON',
    year: 2020,
    tagline: '4.0 biturbo V8, Avant kuzov. Oilaviy vagon — lekin 600 hp.',
    paint: 0x0a0a0c,
    rim: 0x9aa3ad,
    accent: '#ff3030',
    engine: '4.0L Biturbo V8 (ABT)',
    drivetrain: 'AWD',
    gearbox: '8 pog‘onali avtomat',
    powerHp: 730,
    torqueNm: 920,
    weightKg: 2075,
    zeroToHundred: 3.2,
    topSpeedKph: 320,
    stats: { speed: 89, accel: 90, handling: 80, braking: 85 },
    soundFlavor: 'Twin-turbo V8: chuqur g‘uldirash, qisqa turbo hushtagi',
    model: { kind: 'glb', url: '/models/rs6.glb', style: 'muscle' },
    sound: {
      cylinders: 8, firing: 4, redline: 7000, idle: 750,
      turbo: true, rasp: 0.95, sub: 0.85, brightness: 0.85, lope: 0.1, useSamples: true,
      harmonics: { sub: 0.85, saw: 0.28, saw2: 0.3, harm: 0.12 },
      samplePitch: 0.7, sampleLevel: 0.85
    },
    physics: {
      ...wb(2.90, 0.48),
      mass: 2075, iz: 3500, cgHeight: 0.48, trackWidth: 1.60, mu: 1.65,
      wheelRadius: 0.34,
      gearRatios: [4.50, 2.90, 1.90, 1.40, 1.10, 0.85, 0.70, 0.58],
      finalDrive: 3.20, redline: 7000, idle: 750, torque: 920,
      driveFront: 0.40, driveRear: 0.60,
      dragCd: 0.32, area: 2.30, brakeForce: 32000, brakeFront: 0.66, brakeRear: 0.34,
      topSpeedKph: 320, maxSteer: 0.62, maxSteerHigh: 0.15
    }
  },

  /* ================================================================ MCQUEEN */
  {
    id: 'mcqueen',
    name: 'Lightning McQueen',
    short: 'McQueen',
    type: 'car',
    klass: 'PIXAR ICON',
    year: 2006,
    tagline: 'Kino situvachisining qizil to\'tasi. "Ka-chow!" shovqi bilan yugurib, ishni qil.',
    paint: 0xff0000,
    rim: 0x1a1a1a,
    accent: '#ffff00',
    engine: 'V8',
    drivetrain: 'RWD',
    gearbox: 'Transmission',
    powerHp: 750,
    torqueNm: 850,
    weightKg: 1500,
    zeroToHundred: 3.0,
    topSpeedKph: 280,
    stats: { speed: 90, accel: 95, handling: 80, braking: 75 },
    soundFlavor: 'Kinematografik turbo V8: tez, quvvatli, rasply',
    model: { kind: 'glb', url: '/models/lightning_mcqueen_xbox_360.glb', style: 'super' },
    sound: {
      cylinders: 8, firing: 4, redline: 7000, idle: 800,
      turbo: true, rasp: 1.1, sub: 0.95, brightness: 0.95, lope: 0.05, useSamples: true,
      harmonics: { sub: 0.9, saw: 0.35, saw2: 0.35, harm: 0.18 },
      samplePitch: 0.72, sampleLevel: 0.9
    },
    physics: {
      ...wb(2.75, 0.48),
      mass: 1500, iz: 2600, cgHeight: 0.42, trackWidth: 1.55, mu: 1.75,
      wheelRadius: 0.33,
      gearRatios: [4.00, 2.50, 1.70, 1.25, 0.95, 0.75],
      finalDrive: 3.25, redline: 7000, idle: 800, torque: 850,
      driveFront: 0.0, driveRear: 1.0,
      dragCd: 0.32, area: 2.10, brakeForce: 32000, brakeFront: 0.66, brakeRear: 0.34,
      topSpeedKph: 280, maxSteer: 0.64, maxSteerHigh: 0.14
    }
  },

  /* ================================================================ M3 */
  {
    id: 'm3',
    name: 'BMW M3 Competition',
    short: 'M3 Comp',
    type: 'car',
    klass: 'M POWER',
    year: 2020,
    tagline: '3.0 twin-turbo I6 S58, xDrive. 510 hp, track kunlik qurol.',
    paint: 0x1e2a3a,
    rim: 0xc0c4c8,
    accent: '#5577ff',
    engine: '3.0L Twin-Turbo I6 (S58)',
    drivetrain: 'AWD',
    gearbox: '8 pog‘onali avtomat',
    powerHp: 510,
    torqueNm: 650,
    weightKg: 1730,
    zeroToHundred: 3.4,
    topSpeedKph: 290,
    stats: { speed: 80, accel: 88, handling: 88, braking: 84 },
    soundFlavor: 'BMW I6 turbo: tekis, uyg‘un xirillash, qisqa tushish poplari',
    model: { kind: 'glb', url: '/models/bmw_m3_competition.glb', style: 'sports' },
    sound: {
      cylinders: 6, firing: 3, redline: 7500, idle: 800,
      turbo: true, rasp: 0.8, sub: 0.55, brightness: 1.1, lope: 0, useSamples: true,
      harmonics: { sub: 0.5, saw: 0.38, saw2: 0.35, harm: 0.2 },
      samplePitch: 0.92, sampleLevel: 0.85
    },
    physics: {
      ...wb(2.75, 0.48),
      mass: 1730, iz: 2950, cgHeight: 0.44, trackWidth: 1.57, mu: 1.68,
      wheelRadius: 0.34,
      gearRatios: [4.50, 2.90, 1.90, 1.40, 1.10, 0.85, 0.70, 0.58],
      finalDrive: 3.15, redline: 7500, idle: 800, torque: 650,
      driveFront: 0.30, driveRear: 0.70,
      dragCd: 0.30, area: 2.10, brakeForce: 29000, brakeFront: 0.66, brakeRear: 0.34,
      topSpeedKph: 290, maxSteer: 0.64, maxSteerHigh: 0.16
    }
  },

  /* ================================================================ S1000RR */
  {
    id: 's1000rr',
    name: 'BMW S1000RR',
    short: 'S1000RR',
    type: 'bike',
    klass: 'SUPERBIKE',
    year: 2019,
    tagline: '999cc to‘rt silindrli superbayk. 205 hp, 199 kg, 300+ km/soat.',
    paint: 0xe0e0e0,
    rim: 0x101214,
    accent: '#1a3a6e',
    engine: '999cc Inline-4',
    drivetrain: 'Chain / RWD',
    gearbox: '6 pog‘onali kassetali',
    powerHp: 205,
    torqueNm: 113,
    weightKg: 199,
    zeroToHundred: 3.1,
    topSpeedKph: 305,
    stats: { speed: 88, accel: 92, handling: 95, braking: 88 },
    soundFlavor: 'Yuqori aylanishli I4 qichqirig‘i, 14500 rpm gacha',
    model: { kind: 'glb', url: '/models/bmw_s1000_rr.glb', style: 'sportbike' },
    sound: {
      cylinders: 4, firing: 2, redline: 14500, idle: 1200,
      turbo: false, rasp: 0.9, sub: 0.3, brightness: 1.6, lope: 0, useSamples: false,
      harmonics: { sub: 0.2, saw: 0.3, saw2: 0.45, harm: 0.35 },
      samplePitch: 1.45, sampleLevel: 0
    },
    physics: {
      ...wb(1.44, 0.46),
      mass: 199, iz: 248, cgHeight: 0.58, trackWidth: 0.60, mu: 1.55,
      wheelRadius: 0.31,
      gearRatios: [2.60, 1.95, 1.55, 1.30, 1.10, 0.90],
      finalDrive: 5.60, redline: 14500, idle: 1200, torque: 113,
      driveFront: 0.0, driveRear: 1.0,
      dragCd: 0.55, area: 0.55, brakeForce: 11000, brakeFront: 0.82, brakeRear: 0.18,
      topSpeedKph: 305, maxSteer: 0.52, maxSteerHigh: 0.12
    }
  },

  /* ================================================================ EQUINOX */
  {
    id: 'equinox',
    name: 'Chevrolet Equinox RS',
    short: 'Equinox RS',
    type: 'car',
    klass: 'CROSSOVER',
    year: 2023,
    tagline: 'Kichik crossover, 1.5 turbo. Shahar o‘rtasida tez va qulay.',
    paint: 0x3a3a42,
    rim: 0x8a9098,
    accent: '#00e5ff',
    engine: '1.5L Turbo I4',
    drivetrain: 'FWD',
    gearbox: '6 pog‘onali avtomat',
    powerHp: 175,
    torqueNm: 275,
    weightKg: 1620,
    zeroToHundred: 8.2,
    topSpeedKph: 200,
    stats: { speed: 48, accel: 52, handling: 58, braking: 62 },
    soundFlavor: 'Sokin turbo to‘rtlik: yumshoq xirillash, kam shovqin',
    model: { kind: 'glb', url: '/models/chevrolet_equinox_rs.glb', style: 'sports' },
    sound: {
      cylinders: 4, firing: 2, redline: 5800, idle: 750,
      turbo: true, rasp: 0.7, sub: 0.45, brightness: 0.95, lope: 0, useSamples: true,
      harmonics: { sub: 0.4, saw: 0.4, saw2: 0.28, harm: 0.1 },
      samplePitch: 1.15, sampleLevel: 0.7
    },
    physics: {
      ...wb(2.72, 0.48),
      mass: 1620, iz: 2700, cgHeight: 0.55, trackWidth: 1.58, mu: 1.35,
      wheelRadius: 0.35,
      gearRatios: [3.20, 2.05, 1.40, 1.05, 0.85, 0.70],
      finalDrive: 3.80, redline: 5800, idle: 750, torque: 275,
      driveFront: 1.0, driveRear: 0.0,
      dragCd: 0.36, area: 2.40, brakeForce: 24000, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 200, maxSteer: 0.60, maxSteerHigh: 0.15
    }
  },

  /* ================================================================ NEXIA */
  {
    id: 'nexia',
    name: 'Chevrolet Nexia 2',
    short: 'Nexia 2',
    type: 'car',
    klass: 'BUDGET',
    year: 2010,
    tagline: 'O‘zbekiston ko‘chalarining qahramoni. Sokin, sodda, ishonchli.',
    paint: 0x8a8a90,
    rim: 0x404048,
    accent: '#88aabb',
    engine: '1.6L DOHC I4',
    drivetrain: 'FWD',
    gearbox: '5 pog‘onali mexanika',
    powerHp: 109,
    torqueNm: 150,
    weightKg: 1180,
    zeroToHundred: 10.5,
    topSpeedKph: 185,
    stats: { speed: 35, accel: 38, handling: 45, braking: 48 },
    soundFlavor: 'Sokin atmosferik to‘rtlik: yumshoq xirillash, hech qanday turbo',
    model: { kind: 'glb', url: '/models/chevrolet_nexia_2.glb', style: 'sports' },
    sound: {
      cylinders: 4, firing: 2, redline: 6200, idle: 800,
      turbo: false, rasp: 0.6, sub: 0.4, brightness: 0.9, lope: 0, useSamples: true,
      harmonics: { sub: 0.35, saw: 0.42, saw2: 0.3, harm: 0.12 },
      samplePitch: 1.1, sampleLevel: 0.7
    },
    physics: {
      ...wb(2.58, 0.48),
      mass: 1180, iz: 2000, cgHeight: 0.42, trackWidth: 1.44, mu: 1.20,
      wheelRadius: 0.31,
      gearRatios: [3.42, 1.95, 1.30, 0.95, 0.75],
      finalDrive: 3.94, redline: 6200, idle: 800, torque: 150,
      driveFront: 1.0, driveRear: 0.0,
      dragCd: 0.35, area: 1.95, brakeForce: 18000, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 185, maxSteer: 0.62, maxSteerHigh: 0.15
    }
  },

  /* ================================================================ ONIX */
  {
    id: 'onix',
    name: 'Chevrolet Onix',
    short: 'Onix',
    type: 'car',
    klass: 'COMPACT',
    year: 2020,
    tagline: '1.0 turbo uch silindr. Kichik, tez, iqtisodiy.',
    paint: 0x1a4a7a,
    rim: 0x606068,
    accent: '#4aa8ff',
    engine: '1.0L Turbo I3',
    drivetrain: 'FWD',
    gearbox: '6 pog‘onali mexanika',
    powerHp: 116,
    torqueNm: 166,
    weightKg: 1080,
    zeroToHundred: 9.2,
    topSpeedKph: 195,
    stats: { speed: 40, accel: 45, handling: 52, braking: 50 },
    soundFlavor: 'Uch silindrli turbo: o‘ziga xos g‘alati burinish, kichik turbo',
    model: { kind: 'glb', url: '/models/chevrolet_onix.glb', style: 'sports' },
    sound: {
      // uch silindr: kamaygan olov va o‘ziga xos tekis nola
      cylinders: 3, firing: 1.5, redline: 6500, idle: 850,
      turbo: true, rasp: 0.85, sub: 0.35, brightness: 1.1, lope: 0.1, useSamples: true,
      harmonics: { sub: 0.3, saw: 0.45, saw2: 0.32, harm: 0.14 },
      samplePitch: 1.2, sampleLevel: 0.75
    },
    physics: {
      ...wb(2.50, 0.48),
      mass: 1080, iz: 1850, cgHeight: 0.40, trackWidth: 1.42, mu: 1.30,
      wheelRadius: 0.30,
      gearRatios: [3.50, 2.10, 1.40, 1.05, 0.85, 0.70],
      finalDrive: 4.05, redline: 6500, idle: 850, torque: 166,
      driveFront: 1.0, driveRear: 0.0,
      dragCd: 0.34, area: 1.85, brakeForce: 19000, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 195, maxSteer: 0.62, maxSteerHigh: 0.15
    }
  },

  /* ================================================================ SPARK */
  {
    id: 'spark',
    name: 'Chevrolet Spark (Tuned)',
    short: 'Spark Tuned',
    type: 'car',
    klass: 'CITY TUNER',
    year: 2018,
    tagline: '1.2 litr, lekin tuning bilan. Shahar bo‘ylab sayr uchun.',
    paint: 0xff8a1e,
    rim: 0x1a1a1e,
    accent: '#ffaa44',
    engine: '1.2L I4 (Tuned)',
    drivetrain: 'FWD',
    gearbox: '5 pog‘onali mexanika',
    powerHp: 95,
    torqueNm: 120,
    weightKg: 950,
    zeroToHundred: 9.8,
    topSpeedKph: 180,
    stats: { speed: 32, accel: 40, handling: 55, braking: 48 },
    soundFlavor: 'Kichik atmosferik to‘rtlik: baland xirillash, engil vintil',
    model: { kind: 'glb', url: '/models/spark.glb', style: 'sports' },
    sound: {
      cylinders: 4, firing: 2, redline: 6500, idle: 820,
      turbo: false, rasp: 0.8, sub: 0.3, brightness: 1.2, lope: 0, useSamples: true,
      harmonics: { sub: 0.25, saw: 0.45, saw2: 0.35, harm: 0.18 },
      samplePitch: 1.25, sampleLevel: 0.7
    },
    physics: {
      ...wb(2.38, 0.48),
      mass: 950, iz: 1600, cgHeight: 0.40, trackWidth: 1.40, mu: 1.25,
      wheelRadius: 0.29,
      gearRatios: [3.35, 1.95, 1.30, 0.95, 0.75],
      finalDrive: 4.15, redline: 6500, idle: 820, torque: 120,
      driveFront: 1.0, driveRear: 0.0,
      dragCd: 0.36, area: 1.80, brakeForce: 16000, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 180, maxSteer: 0.62, maxSteerHigh: 0.15
    }
  },

  /* ================================================================ JESKO */
  {
    id: 'jesko',
    name: 'Koenigsegg Jesko',
    short: 'Jesko',
    type: 'car',
    klass: 'HYPERCAR',
    year: 2021,
    tagline: '5.0 twin-turbo V8, 1600 hp, 9 pog‘onali. Fanga mos.',
    paint: 0xf0f0f0,
    rim: 0x101015,
    accent: '#ffffff',
    engine: '5.0L Twin-Turbo V8',
    drivetrain: 'RWD',
    gearbox: '9 pog‘onali LST',
    powerHp: 1600,
    torqueNm: 1500,
    weightKg: 1420,
    zeroToHundred: 2.5,
    topSpeedKph: 482,
    stats: { speed: 100, accel: 100, handling: 92, braking: 90 },
    soundFlavor: 'Twin-turbo V8 giper-mashina: nola, portlash, barchasi ekstremal',
    model: { kind: 'glb', url: '/models/koenigsegg_jesco.glb', style: 'super' },
    sound: {
      cylinders: 8, firing: 4, redline: 8500, idle: 950,
      turbo: true, rasp: 1.2, sub: 0.9, brightness: 1.1, lope: 0.1, useSamples: true,
      harmonics: { sub: 0.75, saw: 0.35, saw2: 0.4, harm: 0.2 },
      samplePitch: 0.75, sampleLevel: 0.9
    },
    physics: {
      ...wb(2.80, 0.48),
      mass: 1420, iz: 2400, cgHeight: 0.34, trackWidth: 1.66, mu: 1.90,
      wheelRadius: 0.35,
      gearRatios: [4.72, 3.29, 2.38, 1.78, 1.38, 1.08, 0.85, 0.68, 0.55],
      finalDrive: 2.85, redline: 8500, idle: 950, torque: 1500,
      driveFront: 0.0, driveRear: 1.0,
      dragCd: 0.28, area: 2.00, brakeForce: 40000, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 482, maxSteer: 0.70, maxSteerHigh: 0.18
    }
  },

  /* ================================================================ LACETTI */
  {
    id: 'lacetti',
    name: 'Chevrolet Lacetti',
    short: 'Lacetti',
    type: 'car',
    klass: 'CLASSIC',
    year: 2008,
    tagline: '1.6 litr, ishonchli va sokin. O‘zbek ko‘chasining doimiysi.',
    paint: 0x8a8a8e,
    rim: 0x404048,
    accent: '#aabbcc',
    engine: '1.6L E-TEC II I4',
    drivetrain: 'FWD',
    gearbox: '5 pog‘onali mexanika',
    powerHp: 109,
    torqueNm: 150,
    weightKg: 1250,
    zeroToHundred: 10.2,
    topSpeedKph: 187,
    stats: { speed: 34, accel: 36, handling: 44, braking: 47 },
    soundFlavor: 'Atmosferik to‘rtlik: sokin, deyarli bema’ni, faqat engil xirillash',
    model: { kind: 'glb', url: '/models/lacetti.glb', style: 'sports' },
    sound: {
      cylinders: 4, firing: 2, redline: 6300, idle: 800,
      turbo: false, rasp: 0.55, sub: 0.4, brightness: 0.88, lope: 0, useSamples: true,
      harmonics: { sub: 0.36, saw: 0.4, saw2: 0.28, harm: 0.1 },
      samplePitch: 1.08, sampleLevel: 0.7
    },
    physics: {
      ...wb(2.60, 0.48),
      mass: 1250, iz: 2120, cgHeight: 0.43, trackWidth: 1.46, mu: 1.22,
      wheelRadius: 0.31,
      gearRatios: [3.42, 1.95, 1.30, 0.95, 0.75],
      finalDrive: 3.94, redline: 6300, idle: 800, torque: 150,
      driveFront: 1.0, driveRear: 0.0,
      dragCd: 0.35, area: 1.98, brakeForce: 19000, brakeFront: 0.68, brakeRear: 0.32,
      topSpeedKph: 187, maxSteer: 0.62, maxSteerHigh: 0.15
    }
  },

  /* ================================================================ G63 */
  {
    id: 'g63',
    name: 'Mercedes-AMG G63',
    short: 'G63 AMG',
    type: 'car',
    klass: 'OFF-ROAD LUX',
    year: 2019,
    tagline: '4.0 biturbo V8 AMG, Gelandewagen. Shahar jangchisi.',
    paint: 0x1a1a1e,
    rim: 0x202024,
    accent: '#aaaaaa',
    engine: '4.0L Biturbo V8 (M176)',
    drivetrain: 'AWD',
    gearbox: '9 pog‘onali avtomat',
    powerHp: 585,
    torqueNm: 850,
    weightKg: 2550,
    zeroToHundred: 4.4,
    topSpeedKph: 240,
    stats: { speed: 68, accel: 72, handling: 55, braking: 68 },
    soundFlavor: 'V8 AMG gumburlashi, biturbo, ammo og‘ir kuzov — chuqur va jevarli',
    model: { kind: 'glb', url: '/models/g63.glb', style: 'muscle' },
    sound: {
      cylinders: 8, firing: 4, redline: 6800, idle: 750,
      turbo: true, rasp: 1.0, sub: 0.9, brightness: 0.78, lope: 0.2, useSamples: true,
      harmonics: { sub: 0.9, saw: 0.25, saw2: 0.3, harm: 0.12 },
      samplePitch: 0.65, sampleLevel: 0.85
    },
    physics: {
      ...wb(2.89, 0.48),
      mass: 2550, iz: 4300, cgHeight: 0.60, trackWidth: 1.66, mu: 1.40,
      wheelRadius: 0.38,
      gearRatios: [4.50, 2.90, 1.90, 1.40, 1.10, 0.85, 0.70, 0.58, 0.48],
      finalDrive: 3.10, redline: 6800, idle: 750, torque: 850,
      driveFront: 0.35, driveRear: 0.65,
      dragCd: 0.40, area: 2.70, brakeForce: 36000, brakeFront: 0.66, brakeRear: 0.34,
      topSpeedKph: 240, maxSteer: 0.58, maxSteerHigh: 0.14
    }
  },

  /* ================================================================ M5 */
  {
    id: 'm5',
    name: 'BMW M5 E60',
    short: 'M5 E60',
    type: 'car',
    klass: 'V10 SEDAN',
    year: 2006,
    tagline: '5.0 V10, 507 hp. Tabiiy havo o‘zlashtirilgan, 8250 rpm gacha.',
    paint: 0x1a2028,
    rim: 0x8a9098,
    accent: '#5577ff',
    engine: '5.0L Naturally Aspirated V10 (S85)',
    drivetrain: 'RWD',
    gearbox: '7 pog‘onali sekvensial SMG',
    powerHp: 507,
    torqueNm: 520,
    weightKg: 1755,
    zeroToHundred: 4.2,
    topSpeedKph: 305,
    stats: { speed: 78, accel: 82, handling: 72, braking: 76 },
    soundFlavor: 'V10 naforat: baland, o‘tkir, 8000 rpm dan yuqori qichqiraydi',
    model: { kind: 'glb', url: '/models/update_bmw_m5_e60.glb', style: 'sports' },
    sound: {
      // V10 — V12 bilan biroz o‘xshash, ammo o‘rtada, ko‘proq nola
      cylinders: 10, firing: 5, redline: 8400, idle: 900,
      turbo: false, rasp: 0.6, sub: 0.45, brightness: 1.4, lope: 0, useSamples: false,
      harmonics: { sub: 0.32, saw: 0.3, saw2: 0.4, harm: 0.4 },
      samplePitch: 1.3, sampleLevel: 0
    },
    physics: {
      ...wb(2.89, 0.48),
      mass: 1755, iz: 3000, cgHeight: 0.45, trackWidth: 1.58, mu: 1.55,
      wheelRadius: 0.34,
      gearRatios: [4.20, 2.70, 1.80, 1.35, 1.05, 0.82, 0.68],
      finalDrive: 3.20, redline: 8400, idle: 900, torque: 520,
      driveFront: 0.0, driveRear: 1.0,
      dragCd: 0.30, area: 2.20, brakeForce: 30000, brakeFront: 0.66, brakeRear: 0.34,
      topSpeedKph: 305, maxSteer: 0.62, maxSteerHigh: 0.15
    }
  },

]

export const DEFAULT_VEHICLE_ID = 'cobalt'

export function getVehicle(id) {
  return VEHICLES.find((v) => v.id === id) || VEHICLES[0]
}
