/**
 * Artemis II Mission Tracker — Static Data & Mock Telemetry
 * Contains crew bios, spacecraft specs, mission timeline, and fallback telemetry.
 */

// ── Launch epoch (April 1 2026, 18:24 EDT = 22:24 UTC) ────────────────────
var LAUNCH_EPOCH_UTC = new Date('2026-04-01T22:35:12Z');



// ── Crew ───────────────────────────────────────────────────────────────────
var CREW = [
  {
    name: 'Reid Wiseman',
    role: 'Commander',
    agency: 'NASA',
    photo: null,
    bio: 'U.S. Navy test pilot and former Chief of the Astronaut Office. Flew to the ISS on Expedition 41 in 2014, logging 165 days in space. Born in Baltimore, Maryland. Holds a B.S. from Rensselaer Polytechnic Institute and an M.S. in Systems Engineering from Johns Hopkins University. At 50, the oldest person to leave low Earth orbit since Apollo.'
  },
  {
    name: 'Victor Glover',
    role: 'Pilot',
    agency: 'NASA',
    photo: null,
    bio: 'U.S. Navy fighter pilot with over 3,500 flight hours across 40+ aircraft, including 24 combat missions. Piloted SpaceX Crew Dragon on its first operational flight to the ISS (2020–21), spending 168 days in orbit and completing four spacewalks. The first person of color to travel beyond low Earth orbit.'
  },
  {
    name: 'Christina Koch',
    role: 'Mission Specialist',
    agency: 'NASA',
    photo: null,
    bio: 'Electrical engineer who holds the record for the longest single spaceflight by a woman — 328 days aboard the ISS (2019–20). Participated in the first all-female spacewalk with Jessica Meir. Born in Grand Rapids, Michigan, raised in Jacksonville, North Carolina. The first woman to travel beyond low Earth orbit.'
  },
  {
    name: 'Jeremy Hansen',
    role: 'Mission Specialist',
    agency: 'CSA',
    photo: null,
    bio: 'Canadian Forces CF-18 fighter pilot, combat operations officer with NORAD, and physicist. Holds a B.Sc. in Space Science (honours) from the Royal Military College of Canada. Selected by the Canadian Space Agency in 2009. This is his first spaceflight — and he becomes the first non-U.S. citizen to travel beyond low Earth orbit.'
  }
];

// ── Spacecraft specs ───────────────────────────────────────────────────────
var SPACECRAFT = {
  orion: {
    name: 'Orion "Integrity"',
    description: 'NASA\'s deep-space crew capsule, designed to carry astronauts farther than any spacecraft built for humans has ever flown.',
    specs: [
      { label: 'Crew capacity', value: '4 astronauts' },
      { label: 'Cabin volume', value: '9.0 m\u00B3 (316 ft\u00B3) — ~2.25 m\u00B3 per crew member' },
      { label: 'Diameter', value: '5.02 m (16 ft 6 in)' },
      { label: 'Length (crew module)', value: '3.3 m (10 ft 10 in)' },
      { label: 'Duration (undocked)', value: 'Up to 21 days' },
      { label: 'Duration (docked)', value: 'Up to 6 months' }
    ]
  },
  heatShield: {
    name: 'Heat Shield',
    description: 'The largest ablative heat shield ever built. It protects the crew module during re-entry at speeds up to 40,000 km/h.',
    specs: [
      { label: 'Diameter', value: '5.0 m (16.5 ft)' },
      { label: 'Material', value: 'Avcoat ablator' },
      { label: 'Peak temperature', value: '~2,760 \u00B0C (~5,000 \u00B0F)' },
      { label: 'Re-entry speed', value: '~40,000 km/h (~25,000 mph)' }
    ]
  },
  lifeSupport: {
    name: 'Environmental Control & Life Support (ECLSS)',
    description: 'Regenerable systems that keep four astronauts alive in deep space for up to three weeks.',
    specs: [
      { label: 'Atmosphere', value: '78% N\u2082 / 21% O\u2082 — sea-level mix' },
      { label: 'Cabin pressure', value: '101.3 kPa (14.7 psi)' },
      { label: 'Cabin temperature', value: '~18–27 \u00B0C (65–80 \u00B0F)' },
      { label: 'CO\u2082 scrubbing', value: 'Regenerable amine swing-bed system' },
      { label: 'Water recycling', value: 'Humidity condensate recovery' },
      { label: 'Thermal control', value: 'Active fluid loops + radiator panels' }
    ]
  },
  esm: {
    name: 'European Service Module (ESM-2)',
    description: 'Built by Airbus for ESA, the service module provides propulsion, electrical power, thermal control, and consumables (air and water).',
    specs: [
      { label: 'Dimensions', value: '~4 m diameter \u00D7 4 m height' },
      { label: 'Mass (fuelled)', value: '~13,000 kg (28,660 lb)' },
      { label: 'Main engine', value: 'Aerojet Rocketdyne AJ10 (OMS-E), 26.7 kN' },
      { label: 'Auxiliary thrusters', value: '8 \u00D7 490 N + 24 \u00D7 220 N RCS' },
      { label: 'Solar arrays', value: '4 wings, 19 m span, 11.2 kW' },
      { label: 'Consumables', value: 'O\u2082, N\u2082, and up to 240 L of water' }
    ]
  },
  sls: {
    name: 'Space Launch System (SLS) Block 1',
    description: 'The most powerful rocket ever flown. Generates nearly 40 MN (8.8 million lbf) of thrust at liftoff.',
    specs: [
      { label: 'Height', value: '98 m (322 ft)' },
      { label: 'Liftoff mass', value: '~2,600,000 kg (5,700,000 lb)' },
      { label: 'Liftoff thrust', value: '~39.1 MN (8.8 million lbf)' },
      { label: 'Core stage engines', value: '4 \u00D7 RS-25' },
      { label: 'Solid boosters', value: '2 \u00D7 5-segment SRB' },
      { label: 'Upper stage', value: 'ICPS (Interim Cryogenic Propulsion Stage)' }
    ]
  }
};

// ── Mission timeline ───────────────────────────────────────────────────────
// Times are MET (Mission Elapsed Time) in hours from LAUNCH_EPOCH_UTC.
// Pre-launch events use negative MET hours.
// Launch times stored as UTC, displayed in user local timezone.// ── Event enrichment detail (keyed by event id) ──────────────────────────
// Contains only detail text and links. Timeline structure comes from schedule.json.
var EVENT_DETAILS = {
  "launch-team-stations": {
    "detail": "Over 100 console positions in Firing Room 1 are staffed by engineers and controllers who will monitor every system on SLS and Orion through the multi-day countdown."
  },
  "countdown-clock-begins": {
    "detail": "The countdown clock is managed from Firing Room 1 in the Launch Control Center. Artemis Launch Director Charlie Blackwell-Thompson — the first woman to hold the role — oversees the multi-day sequence that includes several planned holds."
  },
  "orion-power-up": {
    "detail": "Orion’s avionics, life support, navigation, and communication systems are brought online sequentially. Ground controllers verify telemetry links between the spacecraft and the Launch Control Center."
  },
  "core-stage-power-up": {
    "detail": "The core stage flight computer begins executing its built-in test sequences, verifying communication with the four RS-25 engines and all vehicle sensors."
  },
  "rs25-final-prep": {
    "detail": "The RS-25 engines (numbered 2045, 2056, 2058, 2060) are checked for hydraulic, pneumatic, and electrical readiness. Nozzle inspections and propellant valve cycling ensure the engines are ready for ignition."
  },
  "icps-power-up": {
    "detail": "ICPS avionics and the RL10B-2 engine controller are activated. The stage will perform the orbital insertion burn and perigee raise manoeuvres after SLS core stage separation."
  },
  "non-essential-leave-pad": {
    "detail": "Only essential pad technicians and the closeout crew remain in the vicinity of the mobile launcher. The blast danger zone perimeter is established."
  },
  "gls-activation": {
    "detail": "The GLS is the automated system that will manage over 700 steps in the final countdown. At this point it begins passive monitoring, later taking active control during the terminal count."
  },
  "built-in-hold-2h45m": {
    "detail": "Built-in holds are scheduled pauses that provide margin for troubleshooting without affecting the launch timeline. Teams use this time to verify all systems are nominal before entering the tanking phase."
  },
  "go-nogo-tanking": {
    "detail": "All console positions must confirm “Go” before propellant loading can commence. Weather, range safety, and vehicle health are all evaluated before proceeding with tanking."
  },
  "lh2-slow-fill": {
    "detail": "Liquid hydrogen at −253 °C (−423 °F) is fed through an 800-metre umbilical system from the pad’s storage sphere. The slow fill gradually cools the 40-metre-tall tank before transitioning to fast fill."
  },
  "resume-t-clock": {
    "detail": "The T-clock tracks time within the countdown sequence and includes built-in holds, while the L-clock (L-minus) counts real time to launch. The two clocks diverge whenever holds are inserted."
  },
  "lox-slow-fill": {
    "detail": "LOX at −183 °C (−297 °F) is loaded into the 742,000-litre core stage tank. The mass ratio is about 6:1 (LOX to LH₂), making the oxygen tank the heaviest component at full load."
  },
  "orion-comms-activated": {
    "detail": "The S-band and Ka-band communication systems are tested end-to-end between Orion and MCC-H, ensuring voice, telemetry, and command links are operational before crew ingress."
  },
  "closeout-crew-assemble": {
    "detail": "The closeout crew is a small team of technicians responsible for helping the astronauts board, securing the hatch, and performing final hands-on checks on the spacecraft."
  },
  "crew-weather-brief": {
    "detail": "Launch commit criteria include: no lightning within 20 nm in the last 30 minutes, no cumulus clouds with tops above the freezing level within 10 nm, surface winds below 30 knots, and no precipitation at the pad."
  },
  "built-in-hold-1h10m": {
    "detail": "This hold allows time to resolve any remaining issues from tanking, confirm weather conditions, and ensure the pad is ready for crew arrival."
  },
  "crew-deploy-to-pad": {
    "detail": "The Artemis crew uses specially modified electric vehicles for the 14.5 km (9-mile) drive to LC-39B. The drive takes about 20 minutes through Kennedy Space Center."
  },
  "crew-board-orion": {
    "detail": "Ingress happens via the 55-metre-long enclosed Crew Access Arm. The crew enters through Orion’s side hatch (83 cm diameter). Commander in upper left, Pilot in upper right, Mission Specialists below. Each is strapped in with a 5-point harness."
  },
  "hatch-preps-closure": {
    "detail": "The hatch is sealed and the cabin is pressurised to 101.3 kPa (14.7 psi) with a 21% O₂ / 79% N₂ mix. Leak checks verify the seal integrity before the closeout crew begins securing external panels."
  },
  "hatch-service-panel": {
    "detail": "Technicians install protective panels over the hatch mechanism and complete final hands-on closeout procedures on the exterior of the Orion spacecraft."
  },
  "las-hatch-closure": {
    "detail": "The LAS sits atop the crew module and provides emergency abort capability during ascent. Its hatch closure is one of the final hands-on tasks before the pad is cleared."
  },
  "launch-director-brief": {
    "detail": "The brief covers vehicle health, weather, range safety status, and any waivers or anomalies. This sets the stage for the final pad clear and terminal countdown preparations."
  },
  "closeout-crew-departs": {
    "detail": "All personnel evacuate the blast danger zone, which extends 600 metres from the pad. The mobile launcher umbilicals continue to provide power and environmental control to Orion."
  },
  "final-ntd-briefing": {
    "detail": "The NTD reviews the status of all ground systems, vehicle systems, and range readiness before the countdown enters the final built-in hold."
  },
  "built-in-hold-30m": {
    "detail": "This is the last opportunity to resolve any open issues before committing to the terminal count. The launch window typically provides a 2-hour window if additional time is needed."
  },
  "orion-earth-comm": {
    "detail": "The crew’s voice and data communications transition to the flight communication system that will be used throughout the mission, routed through TDRS satellites and the Deep Space Network."
  },
  "launch-director-poll": {
    "detail": "Every critical system is polled: propulsion, avionics, range safety, weather, ground systems, crew health, and flight dynamics. A single “No-Go” halts the countdown. The Mission Director at JSC also gives a separate Go/No-Go."
  },
  "visors-down": {
    "detail": "With visors down, each astronaut is on suit-supplied air. The OCSS provides up to 6 hours of life support in case of cabin depressurisation during ascent."
  },
  "terminal-countdown": {
    "detail": "The GLS manages over 700 automated steps in the final minutes. Human controllers can still issue a hold or abort, but the sequencer now drives the timeline."
  },
  "crew-access-arm-retract": {
    "detail": "Retraction of the Crew Access Arm is one of the visible milestones in the final minutes. Once locked, there is no pad access to the crew module."
  },
  "tank-press-internal-power": {
    "detail": "The LH₂ and LOX tanks are brought to flight pressure. Orion disconnects from ground power umbilicals and runs on its own lithium-ion batteries for the remainder of ascent."
  },
  "las-capability-available": {
    "detail": "The LAS Abort Motor can generate 400 kN of thrust for 5 seconds, accelerating the crew module away from the rocket at up to 15 g in an emergency."
  },
  "fts-armed": {
    "detail": "The FTS is a range safety requirement. If the vehicle deviates from its planned corridor, Range Safety can send a destruct command to protect populated areas."
  },
  "core-stage-apu-start": {
    "detail": "The APUs drive hydraulic pumps that actuate the RS-25 engine nozzles for thrust vector control during ascent. They must be running before the engines can gimbal."
  },
  "purge-sequence-4": {
    "detail": "Gaseous nitrogen is used to purge residual hydrogen from the aft compartment of the core stage, ensuring a safe environment for engine ignition."
  },
  "booster-internal-power": {
    "detail": "Each 54-metre SRB transitions to its own batteries. Once on internal power, the boosters are self-contained and ready for the ignition command at T−0."
  },
  "core-stage-internal-power": {
    "detail": "The tail service mast umbilicals release, severing the last physical ground connections to the core stage. The vehicle is now fully self-powered."
  },
  "icps-lh2-terminate": {
    "detail": "The ICPS has been continuously topped off with LH₂ to replace boil-off. Replenishment stops so the feed line can be disconnected before liftoff."
  },
  "go-automated-sequencer": {
    "detail": "From this point, the GLS executes the final sequence autonomously. It can still abort if any parameter goes out of limits, but human intervention is no longer in the loop."
  },
  "h2-burnoff-igniters": {
    "detail": "Sparkler-like igniters under each RS-25 nozzle burn off residual hydrogen gas, preventing an uncontrolled accumulation that could cause an overpressure event at engine start."
  },
  "rs25-start-command": {
    "detail": "The four RS-25 engines ignite in a staggered 120 ms sequence. The vehicle is held down by eight hold-down posts while engine health is verified at 109% power level."
  },
  "rs25-ignition": {
    "detail": "Each RS-25 produces 2.3 MN of thrust at 109% power level, for a combined 9.2 MN from the core stage alone. The GLS verifies all four engines are nominal before commanding SRB ignition."
  },
  "booster-ignition-liftoff": {
    "detail": "At T−0, the SRBs ignite and SLS leaves the pad with ~39.1 MN (8.8 million lbf) of combined thrust. There is no abort once the SRBs light. It takes about 8 seconds for SLS to clear the 117-metre launch tower."
  },
  "launch": {
    "detail": "At ignition, the four RS-25 engines and two SRBs together produce ~39.1 MN (8.8 million lbf) of thrust — about 15% more than the Saturn V. The vehicle weighs 2.6 million kg at liftoff. It takes about 8 seconds for SLS to clear the 117-metre launch tower. Crew members experience ~3 g during the SRB phase. The SRBs provide ~75% of total thrust for the first 2 minutes. Each SRB burns 500,000 kg of solid propellant (aluminium powder + ammonium perchlorate). The exhaust temperature is ~3,300 °C.",
    "links": [
      {
        "text": "Watch Live on NASA+",
        "url": "https://plus.nasa.gov"
      },
      {
        "text": "SLS Fact Sheet",
        "url": "https://www.nasa.gov/exploration/systems/sls/factsheets.html"
      }
    ]
  },
  "max-q": {
    "detail": "Max Q is the moment of maximum dynamic pressure — the point where the combination of air density (decreasing with altitude) and velocity (increasing) produces the highest aerodynamic force on the vehicle structure. For SLS, max Q is approximately 31 kPa (650 psf) at about Mach 1.6. The vehicle speed is roughly 450 m/s (1,600 km/h). During Apollo, the call \"Max Q\" was a critical milestone; the Saturn V experienced about 34 kPa. If SLS needed to abort at this point, the Launch Abort System would fire to pull the crew capsule away at 15 g."
  },
  "srb-sep": {
    "detail": "Each SRB is 54 metres tall, 3.7 m in diameter, and weighs 726,000 kg loaded. After 126 seconds, the propellant is exhausted. Sixteen booster separation motors (BSMs) fire to push the spent casings away at ~3 m/s. The SRBs are NOT recovered on Artemis (unlike Shuttle, which parachuted them into the ocean for reuse). They fall into the Atlantic Ocean ~230 km downrange. After SRB separation, the ride becomes much smoother — g-forces drop from ~3 g to about 1 g as only the core stage RS-25 engines continue firing. Crew members report the transition as dramatic."
  },
  "sm-fairing-jettison": {
    "detail": "Three fairing panels protect the European Service Module’s delicate solar arrays and radiators during atmospheric ascent. Once above the dense atmosphere (~100 km altitude), they are no longer needed. Pyrotechnic bolts fire to release the panels, and springs push them away. This exposes the four solar array wings (still folded) and the service module’s radiator surfaces. The fairings weigh about 4,500 kg combined."
  },
  "las-jettison": {
    "detail": "The LAS sits on top of the crew module and consists of three solid motors: the Abort Motor (400 kN), the Attitude Control Motor, and the Jettison Motor. If an abort were called during ascent, the Abort Motor would fire for 5 seconds, pulling the crew capsule away at up to 15 g. Once above ~90 km altitude, the LAS is no longer effective (the crew module can separate on its own). The Jettison Motor fires to pull the LAS tower away from the spacecraft. The LAS weighs ~7,700 kg — jettisoning it significantly lightens the vehicle for the rest of the ascent."
  },
  "meco": {
    "detail": "The RS-25 engines (formerly Space Shuttle Main Engines) each produce 2.3 MN of thrust at 109% power level. They burn liquid hydrogen and liquid oxygen at a combined flow rate of ~1,900 kg/s. By MECO, the vehicle is travelling at ~7.8 km/s (28,000 km/h) at an altitude of ~160 km. The engines throttle down before cutoff to limit g-forces to about 3 g. The Artemis II RS-25 engines (numbered 2045, 2056, 2058, 2060) are expendable — unlike Shuttle, they are not recovered."
  },
  "core-sep": {
    "detail": "The spent core stage (65 metres long, now mostly empty) separates via pyrotechnic bolts and retro-rockets. It falls back into the Atlantic Ocean in a pre-designated area. The ICPS, a modified Delta IV Heavy upper stage built by United Launch Alliance, ignites its single RL10B-2 engine (110 kN thrust) to circularise the orbit. The ICPS burn lasts about 8 minutes to achieve a ~185 km circular parking orbit. The RL10 engine burns liquid hydrogen and liquid oxygen, but in much smaller quantities than the core stage."
  },
  "icps-cutoff": {
    "detail": "Orion is now in low Earth orbit, circling the planet every ~88 minutes at ~7.8 km/s (28,000 km/h). At this altitude, the crew experiences continuous microgravity. The ISS orbits at ~420 km, so Orion is below it. Orbital insertion is confirmed by the TDRS (Tracking and Data Relay Satellite) network and ground stations. The crew can now see Earth’s curvature, the thin blue atmosphere, and (at night) city lights below."
  },
  "solar-deploy": {
    "detail": "Each of the four solar array wings is 4.75 metres long when deployed. Together they span 19 metres tip-to-tip. The arrays use triple-junction gallium arsenide solar cells with ~29% efficiency. They generate 11.2 kW at Earth distance and about 10.5 kW at Moon distance (slightly less due to distance from the Sun being roughly constant, but thermal conditions change). During eclipse (behind Earth or Moon), Orion runs on lithium-ion batteries. The ESM was built by Airbus Defence and Space in Bremen, Germany, for ESA."
  },
  "crew-checks": {
    "detail": "The crew now has time to check all vehicle systems in microgravity. They verify the ECLSS (life support), propulsion, navigation, communication links (S-band for voice, Ka-band for high-rate data), and thermal control. They may remove helmets and gloves once cabin pressure is confirmed stable. The crew communicates with Mission Control Houston (MCC-H) through NASA’s TDRS constellation and the Deep Space Network. Voice delay at this distance is negligible (<0.01 seconds)."
  },
  "perigee-raise-1": {
    "detail": "This ICPS burn raises the orbit from the initial 185 km circular parking orbit to a highly elliptical orbit. The burn adds about 3.1 km/s of delta-v. At apogee, Orion will be at ~70,400 km — well above the GPS satellite constellation (20,200 km) and approaching the outer edge of the Van Allen radiation belts. The perigee remains at 185 km."
  },
  "perigee-raise-2": {
    "detail": "This burn further refines the orbit. The crew is now above the GPS satellite belt (20,200 km) and entering the outer Van Allen radiation belt (13,000–60,000 km). Van Allen belt radiation is managed by Orion’s shielding and the relatively quick transit through the belts. The crew’s cumulative radiation dose is carefully tracked. Orion carries a Hybrid Electronic Radiation Assessor (HERA) and other dosimeters. Total mission radiation dose is expected to be about 15 mSv — roughly equivalent to 3 chest CT scans."
  },
  "orion-systems-checkout": {
    "detail": "The crew removes launch suits and reconfigures the cabin for living and work. They verify the ECLSS (life support), potable water dispenser, waste management system, CO₂ scrubbing system, propulsion, navigation, and communication links. This is the first crewed test of Orion’s life support in space — Artemis I was uncrewed."
  },
  "prox-ops": {
    "detail": "Orion separates from the ICPS using a spacecraft adapter ring. The crew then performs proximity operations — flying Orion around the spent ICPS stage to test relative navigation sensors and manual piloting. This is a critical test: future Artemis missions (III+) will need to rendezvous and dock with the Human Landing System near the Moon. The ICPS serves as a practice target. Orion is now powered entirely by the European Service Module’s AJ10 main engine and 32 reaction control thrusters."
  },
  "icps-sep-burn": {
    "detail": "After approximately 90 minutes of proximity operations, Orion fires its reaction control thrusters to move to a safe distance from the ICPS. This burn ensures adequate separation before the ICPS performs its own disposal manoeuvre. The crew has gathered valuable data on relative navigation and manual piloting that will inform docking procedures for Artemis III."
  },
  "icps-disposal": {
    "detail": "After proximity operations are complete, the ICPS fires its remaining propellant to enter a disposal trajectory. This ensures it will not pose a collision risk to Orion or future spacecraft. The stage will eventually re-enter Earth’s atmosphere and burn up, or enter a long-duration heliocentric orbit."
  },
  "cubesat-deploy": {
    "detail": "The ICPS carries ten 6U CubeSats as secondary payloads, deployed at one-minute intervals after the disposal burn. These small satellites carry a variety of experiments including lunar ice prospecting, solar sail demonstrations, and radiation environment measurements. Each CubeSat is roughly the size of a large shoebox and operates independently on solar or battery power."
  },
  "crew-sleep-1a": {
    "detail": "The crew sleeps in sleeping bags tethered to the cabin walls. Crew was woken at 7:06 AM EDT (MET ~12.5h) with the song Sleepyhead by Young and Sick to monitor the perigee raise burn."
  },
  "orbit-geometry-burn": {
    "detail": "This burn uses the ESM’s AJ10 engine (26.7 kN thrust) to refine the orbit to approximately 71,700 × 185 km. The resulting orbit has an apogee nearly one-fifth of the way to the Moon. At apogee, Orion is above the outer Van Allen belt. Communication switches between NASA’s TDRS satellites (near-Earth) and the Deep Space Network’s three ground stations (Goldstone, Canberra, Madrid)."
  },
  "dsn-emergency-checkout": {
    "detail": "The DSN consists of three ground stations spaced 120° apart around the globe (Goldstone, California; Madrid, Spain; Canberra, Australia) ensuring continuous coverage. This checkout confirms Orion can communicate in an emergency scenario using backup communication modes through these deep-space antennas."
  },
  "crew-sleep-1b": {
    "detail": "After completing the perigee raise burn, the crew returns to rest. This 4.5-hour sleep period prepares them for Flight Day 2 including the mission management team review and the critical translunar injection burn."
  },
  "exercise-wiseman-glover": {
    "detail": "The flywheel exercise device provides resistive loading in microgravity by using a spinning flywheel that resists being accelerated or decelerated. It allows squats, deadlifts, and upper-body exercises. NASA requires 2.5 hours of exercise per crew member per day on long missions to prevent bone and muscle loss."
  },
  "tli-prep": {
    "detail": "The ESM’s AJ10 engine (26.7 kN / ~6,000 lbf thrust) is prepared for TLI. Systems are verified, propellant tank pressures confirmed, and the burn timeline is loaded. The crew dons their suits as a precaution for this critical manoeuvre. If the burn fails, Orion can safely return to Earth from this orbit."
  },
  "tli": {
    "detail": "TLI is the point of no return for the lunar phase. The ESM’s AJ10 engine fires for approximately 6 minutes and 5 seconds near perigee, adding about 0.4 km/s of delta-v. This raises the orbit’s apogee from 71,700 km to beyond the Moon (~400,000 km). The trajectory is a \"free return\" — if the engine fails to fire again, Orion will swing around the Moon and return to Earth automatically, like Apollo 13. This is a key safety feature. During Apollo, TLI was performed by the Saturn V’s S-IVB third stage; Artemis II uses the ESM. After TLI, Earth’s gravity continually decelerates Orion, and speed drops from ~10.8 km/s to about 1 km/s at the midpoint.",
    "links": [
      {
        "text": "Free-Return Trajectory Explained",
        "url": "https://www.nasa.gov/missions/artemis/artemis-ii/free-return-trajectory/"
      }
    ]
  },
  "post-tli-acclimation": {
    "detail": "After the critical TLI burn, the crew confirms trajectory and spacecraft systems are nominal. Orion is now on a free-return trajectory to the Moon. The crew has lighter duties to allow acclimation to the deep-space environment. Earth is receding rapidly in the windows."
  },
  "first-video-downlink": {
    "detail": "Using the Callisto video communication system (an Alexa/WebEx terminal), the crew provides a live video tour of the cabin and shares their first impressions of leaving Earth orbit. Communication delay is still negligible at this distance (~0.1 seconds one-way). This is the first public video from humans beyond low Earth orbit since Apollo 17 in 1972."
  },
  "outbound-correction-1": {
    "detail": "Hansen prepares the spacecraft for the first course-correction burn. These are small burns — typically less than 1 m/s — using the ESM’s reaction control thrusters. By Day 3, Orion is about 130,000 km from Earth. Communication delay is about 0.43 seconds one-way. The crew follows a structured daily schedule: 8 hours sleep, 6.5 hours work, 2.5 hours exercise."
  },
  "cpr-demo": {
    "detail": "Performing CPR in microgravity is fundamentally different from on Earth — without gravity, chest compressions push the rescuer away. The crew practises the \"Evetts–Russomano\" method, bracing against the cabin wall or ceiling with their legs while performing compressions. This demonstration validates emergency medical procedures for future long-duration missions beyond LEO."
  },
  "medical-kit-checkout": {
    "detail": "Orion carries a comprehensive medical kit for the 10-day mission, including diagnostic instruments, medications, wound care supplies, and emergency surgical tools. The crew verifies each item functions properly in microgravity and practises basic medical assessments on each other."
  },
  "dsn-emergency-test": {
    "detail": "As Orion moves farther from Earth, signal strength decreases and latency increases. This test verifies that emergency communication modes — including low-bandwidth backup channels — function reliably at ~150,000 km from Earth. The DSN’s 34-metre and 70-metre antennas must track Orion precisely. Press kit timing: MET 2d 05:25."
  },
  "emergency-procedure-practice": {
    "detail": "Unlike the ISS, where crew can evacuate to a Soyuz or Crew Dragon within minutes, Orion is days from Earth. The crew practises rapid suit donning (under 5 minutes), isolating leaks using cabin pressure sensors, and operating the Emergency Atmospheric Revitalisation System. For fire scenarios, they rehearse identifying the source, cutting electrical circuits, using portable fire extinguishers, and managing smoke removal through the ECLSS air scrubbers. These rehearsals are one of Artemis II’s five core mission objectives: validating abort and rescue procedures for future lunar surface missions."
  },
  "outbound-science-experiments": {
    "detail": "Experiments include: (1) Radiation environment measurements using the HERA and Crew Active Dosimeters, providing real-time deep-space radiation data on human tissue; (2) A fluid dynamics experiment studying how liquids behave during the transition from Earth’s gravity well into deep-space coast phases; (3) A nutrition and hydration tracking study — crew logs meals and fluid intake for comparison with ISS data; (4) Cabin air quality sampling using portable monitors to validate ECLSS performance beyond LEO. The data will directly inform life support design for the Artemis III lunar landing mission."
  },
  "lunar-obs-rehearsal": {
    "detail": "With the lunar flyby just three days away, the crew runs through the complete observation plan: which windows to photograph from, camera settings for different lighting conditions, attitude manoeuvres to orient specific windows toward the lunar surface, and the sequence of geographic targets. They practise working efficiently during the limited close-approach window."
  },
  "gps-tdrs-range-limit": {
    "detail": "GPS satellites orbit at ~20,200 km and their signals are designed for Earthward reception; beyond ~36,000 km (GEO altitude) the signal becomes unreliable for navigation. NASA’s TDRS constellation, also in geosynchronous orbit, provides relay services primarily for LEO spacecraft. Beyond ~70,000 km, Orion transitions fully to the Deep Space Network’s three ground stations (Goldstone, Madrid, Canberra) for all communication, telemetry, and tracking. Navigation shifts to DSN radiometric tracking — Doppler and ranging measurements from the 34-metre and 70-metre antennas — supplemented by Orion’s onboard star trackers and optical navigation camera. This is the same navigation architecture that guided Voyager, Cassini, and the Mars rovers. The crew is now truly in deep space."
  },
  "emergency-procedure-practice-2": {
    "detail": "On the outbound coast, an emergency could require firing the ESM main engine to alter the trajectory for an earlier return to Earth. The crew walks through abort burn timeline procedures, power management during a partial electrical failure, and transferring critical navigation data between Orion’s redundant flight computers. They also practise using the manual hand controller to orient the spacecraft for an emergency burn if the autopilot fails — a skill directly tested during the Day 8 manual piloting demonstration."
  },
  "outbound-correction-2": {
    "detail": "Orion is now roughly 220,000 km from Earth and 164,000 km from the Moon. Communication delay is about 0.73 seconds one-way. This burn fine-tunes the trajectory to ensure the correct flyby altitude and angle. Earth now fits behind a thumb at arm’s length. The Moon is visibly growing in the forward-facing windows."
  },
  "lunar-target-study": {
    "detail": "The exact lunar geography targets depend on the launch date and time, which determines the lighting angle and which features are visible during closest approach. Each astronaut has a 1-hour individual study session reviewing maps, coordinates, and expected views. Key targets include the South Pole–Aitken Basin (2,500 km wide, 8 km deep — the largest impact structure in the solar system)."
  },
  "celestial-photography": {
    "detail": "Without Earth’s atmosphere, the crew can photograph stars, planets, and deep-sky objects with extraordinary clarity. The Milky Way is visible in stunning detail. Thermal management is important during photography — opening window covers changes the thermal balance. The ESM’s radiators dump excess heat while the cold side is insulated."
  },
  "spacesuit-pressure-test": {
    "detail": "The OCSS pressure suits (the orange \"pumpkin suits\") must be donnable in minutes during an emergency. The crew practises quickly putting on suits, pressurising them, and installing their seats — simulating a cabin depressurisation scenario. Each suit provides up to 6 hours of life support."
  },
  "suit-eat-drink-test": {
    "detail": "The OCSS helmet has a feed port that allows crew members to eat food bars and drink water without removing the helmet. This capability is critical for extended suited operations during emergencies or the re-entry timeline when suits must remain sealed for hours."
  },
  "outbound-correction-3": {
    "detail": "This is the last planned trajectory correction before closest approach. The burn ensures Orion will pass at the correct altitude above the lunar surface — approximately 8,900 km. Any remaining trajectory errors after this burn would need to be corrected during or after the flyby. Horizons ephemeris places this burn at MET 4d 04:29."
  },
  "lunar-sphere-influence": {
    "detail": "The lunar sphere of influence (SOI) is the boundary where the Moon’s gravitational pull exceeds Earth’s. At 66,200 km from the Moon’s centre, Orion transitions from a primarily Earth-influenced trajectory to a lunar-dominated one. From here, the Moon’s gravity accelerates the spacecraft toward closest approach. Speed begins increasing again after days of deceleration during the outbound coast. The Moon now dominates the forward view, appearing larger than a fist at arm’s length. JPL Horizons ephemeris confirms this crossing at MET 4d 06:08. Communication delay to Earth is approximately 1.2 seconds one-way."
  },
  "lunar-approach": {
    "detail": "The Moon now fills the forward windows. Speed is increasing rapidly as lunar gravity pulls Orion closer — approximately 5,800 km/h relative to the Moon. The crew is at their observation stations with cameras ready. This will be the first time humans have seen the Moon up close since Apollo 17 in December 1972 — over 53 years ago.",
    "links": [
      {
        "text": "Artemis II Trajectory Map",
        "url": "https://www.nasa.gov/missions/artemis/artemis-ii/artemis-ii-map/"
      }
    ]
  },
  "closest-approach": {
    "detail": "At closest approach (Horizons MET 5d 00:31), the crew sees the lunar surface in extraordinary detail — individual craters, mountain ranges, and the boundary between the bright highlands and dark maria are clearly visible. The far side of the Moon — never visible from Earth — is a landscape of ancient craters with no smooth \"seas.\" The crew photographs and documents the terrain, including the South Pole–Aitken Basin, the largest and oldest impact structure in the solar system (2,500 km wide, 8 km deep). The Moon appears roughly the size of a basketball held at arm’s length. Orion flies approximately 4,000–6,000 miles above the lunar surface (depending on launch date), compared to Artemis I’s 80-mile unmanned approach."
  },
  "lunar-surface-obs": {
    "detail": "The crew executes the observation plan rehearsed on Flight Day 3 — photographing assigned geographic targets, recording verbal descriptions, and capturing video of the lunar surface under varying lighting conditions. Each crew member works at their assigned window. Approximately 21% of the far side is lit by sunlight during this pass."
  },
  "far-side-blackout": {
    "detail": "During the communications blackout behind the Moon, the crew is completely on their own — the furthest any humans will have been from contact with Earth. Apollo 8 astronauts described the far side as \"the loneliest place in the universe.\" Orion’s autonomous systems manage the vehicle during the blackout. The crew continues observations and photography of the far side, recording everything for later transmission. Loss of signal duration varies between 30 and 50 minutes depending on the exact trajectory geometry and antenna angles."
  },
  "far-side-photography": {
    "detail": "With no communication possible and no operational tasks requiring Earth contact, the crew devotes the blackout period to intensive far-side photography. The far side is dramatically different from the near side: almost no smooth maria (volcanic \"seas\"), instead a heavily cratered ancient surface dominated by the South Pole–Aitken Basin. The crew photographs the basin rim, the crater Tsiolkovskiy (one of the few far-side craters with a dark volcanic floor), and the Von Kármán crater where China’s Chang’e 4 lander sits. All images and video are stored onboard for transmission after signal reacquisition."
  },
  "signal-reacquired": {
    "detail": "As Orion clears the lunar limb, the DSN antennas reacquire the signal. This is one of the most anticipated moments of the mission — confirming the crew and spacecraft are healthy after the far-side transit. The crew immediately begins transmitting recorded data and voice reports from the blackout period."
  },
  "distance-record": {
    "detail": "Apollo 13 holds the current record at 400,171 km (248,655 mi), set on April 15, 1970, during their emergency free-return trajectory around the Moon. Artemis II surpasses this by approximately 5,300 km, reaching about 405,500 km from Earth. The crew is roughly 4,600 miles (7,400 km) beyond the Moon’s far side at the farthest point — placing the entire Moon between them and home. At this distance, light (and radio signals) take 1.35 seconds one-way to reach Earth. Earth is a tiny blue marble in the black void. The \"Overview Effect\" — seeing Earth’s fragility from deep space — is reported by every astronaut who has experienced it as a profoundly life-changing moment."
  },
  "post-flyby-science": {
    "detail": "As Orion moves away from the Moon, the crew captures the iconic \"Earthrise\" view — Earth rising above the lunar horizon, first photographed by Apollo 8 in 1968. They continue recording observations while the lunar surface is still visible in detail. Scientific data from the flyby is transmitted to Earth via the DSN."
  },
  "exit-lunar-sphere": {
    "detail": "At approximately 66,200 km from the Moon (Horizons MET 5d 18:52), Orion crosses back out of the lunar sphere of influence. Earth’s gravity reasserts its pull, and Orion begins accelerating toward home. Speed will increase steadily from here — from about 3,800 km/h to over 40,000 km/h at atmospheric entry. The Moon shrinks behind the spacecraft as Earth grows in the forward windows. Communication delay starts decreasing."
  },
  "day7-off-duty": {
    "detail": "After the emotional and operationally intense lunar flyby, the crew has a well-deserved rest day. They debrief with ground scientists while the experience is fresh, but otherwise have time for personal activities, reflection, and communication with family. Orion has exited the lunar sphere of influence, with Earth’s gravity now the dominant force."
  },
  "return-correction-1": {
    "detail": "Horizons ephemeris places this burn at MET 6d 01:29. At ~320,000 km from Earth, speed is increasing under Earth’s gravitational pull. This burn fine-tunes the return trajectory to target the narrow re-entry corridor — only about 15 km wide at the top of the atmosphere. Too steep and the capsule burns up; too shallow and it skips off the atmosphere into space."
  },
  "radiation-shelter": {
    "detail": "A solar particle event (SPE) can deliver a dangerous radiation dose in hours. The crew demonstrates building a shelter using food containers, water bags, and equipment as shielding material around the crew seats. This procedure would be used during future Artemis missions if a solar storm is detected. The demonstration validates that the shelter can be assembled quickly and provides adequate protection."
  },
  "manual-piloting-demo": {
    "detail": "The crew evaluates Orion’s hand controllers in two modes: 6-DOF (six degrees of freedom — controlling translation and rotation simultaneously) and 3-DOF (rotation only). They practise target centering on stars and the Sun, tail-to-Sun thermal attitude manoeuvres, and general attitude control. This data is critical for future Artemis missions where the crew may need to manually dock with the lunar Gateway or Human Landing System."
  },
  "return-correction-2": {
    "detail": "Horizons ephemeris places this burn at MET 8d 04:29. Now approximately 150,000 km from Earth and closing fast at ~7,000 km/h. These are small burns — typically less than 1 m/s — using the ESM’s reaction control thrusters. The re-entry corridor is precisely targeted to land near the USS Portland recovery fleet in the Pacific Ocean off San Diego."
  },
  "reentry-procedure-review": {
    "detail": "The crew reviews every step of the re-entry sequence: service module separation, heat shield orientation, skip entry profile, parachute deployment altitudes, and post-splashdown procedures. They discuss contingency plans with Mission Control: what to do if parachutes partially fail, water landing orientation options, and survival equipment locations."
  },
  "equipment-stow-begins": {
    "detail": "Every loose item in the cabin must be secured — anything unsecured becomes a dangerous projectile during the 4+ g deceleration of re-entry. The crew stows experiments, cameras, personal items, and reconfigures seats to the impact-absorption position. Non-essential systems are powered down to conserve battery for re-entry and descent."
  },
  "final-stow-cabin-prep": {
    "detail": "The crew completes the transition from a living space back to a re-entry vehicle. All remaining loose items are secured, the exercise device and personal gear are stowed, and the cabin is verified clear of floating objects. The crew performs final communication checks with Mission Control."
  },
  "crew-dons-suits": {
    "detail": "The crew puts on the same orange OCSS \"pumpkin suits\" worn at launch. Visors are lowered and locked, providing suit-supplied air in case of cabin depressurisation during re-entry. Each astronaut is secured with a 5-point harness in seats designed to absorb impact forces. The suits provide up to 6 hours of life support."
  },
  "esm-sep": {
    "detail": "The ESM separates from the crew module via pyrotechnic bolts and push-off springs. This is a one-way event — once separated, the crew module is on battery power only (good for about 90 minutes). The ESM, which provided propulsion, power, and thermal control for the entire mission, will re-enter the atmosphere and burn up. The crew module rotates to orient its heat shield forward. The heat shield is a 5-metre-diameter Avcoat ablative shield — the largest ever built."
  },
  "entry-interface": {
    "detail": "Entry Interface (EI) is defined as 120 km (400,000 ft) altitude. At this speed, the air ahead of the capsule compresses and heats to ~2,760 °C — half the surface temperature of the Sun. The capsule performs a \"skip entry\": it dips into the atmosphere, decelerates, then briefly skips back up before descending again. This extends the deceleration, reducing peak g-forces from ~8 g (ballistic) to ~4 g (skip entry). The skip also provides 2× more cross-range capability. This technique was proven on Artemis I (uncrewed) in December 2022.",
    "links": [
      {
        "text": "Skip Entry Explained",
        "url": "https://www.nasa.gov/missions/artemis/orion/orion-skip-entry/"
      }
    ]
  },
  "reentry-radio-blackout": {
    "detail": "During peak heating, the air around Orion is ionised into a plasma sheath that blocks radio frequencies. This \"plasma blackout\" lasts about 5 minutes. During Apollo, this was one of the most tense moments — mission control could only wait. Orion’s guidance system continues to navigate autonomously using its IMU (Inertial Measurement Unit). The crew sees the glow of plasma through the side windows."
  },
  "drogue-chutes": {
    "detail": "The parachute sequence is fully automatic: at ~11,000 m, two small pilot parachutes deploy first to pull out the two drogue chutes (7.3 m / 24 ft diameter each). The drogues stabilise and slow the capsule over about 20 seconds. Orion’s parachute system was tested 17 times before Artemis I, including multiple failure scenarios. The system can land safely with only 2 of 3 main parachutes."
  },
  "main-chutes": {
    "detail": "The three main parachutes are the largest ever used for a human spacecraft: 35 m (116 ft) diameter each, made of Kevlar and nylon. They open in two stages: \"reefed\" (partially open) for 10 seconds, then fully inflated. Terminal descent speed is about 24–27 km/h (15–17 mph). The forward bay cover and heat shield are jettisoned to expose the airbags. Ten airbags inflate to cushion the water impact."
  },
  "splashdown": {
    "detail": "Splashdown occurs in the Pacific Ocean about 370 km (200 nm) off the coast of San Diego, California. Impact speed is about 24 km/h (15 mph) — cushioned by 10 airbags on the base of the capsule. The capsule is designed to float in either orientation (\"crew module righting system\" can flip it if inverted). Navy divers from the USS Portland (LPD-27) approach by helicopter and inflatable boats. A large collar is attached to stabilise the capsule. Water temperature in the recovery zone is typically 15–18 °C in April.",
    "links": [
      {
        "text": "Recovery Operations",
        "url": "https://www.nasa.gov/missions/artemis/orion/orion-recovery/"
      }
    ]
  },
  "recovery": {
    "detail": "Recovery takes about 60–90 minutes from splashdown to crew on the ship. After the capsule is stabilised by divers, the crew exits through the side hatch onto an inflatable platform, then is hoisted via helicopter to the USS Portland. The ship’s medical team performs initial health assessments: cardiovascular checks, vestibular (balance) testing, blood draws, and radiation dosimetry badge collection. After 10 days in microgravity, the crew may experience some disorientation and muscle weakness. The Orion capsule is also recovered: craned onto the ship’s well deck for return to port and post-flight analysis."
  }
};

// ── Fallback events (used when GitHub fetch fails) ──────────────────────────
// Baked-in copy of timeline events. schedule.json is the source of truth.
var FALLBACK_EVENTS = [
  {
    "id": "launch-team-stations",
    "metHours": -49.833,
    "phase": "prelaunch",
    "title": "Launch Team Arrives to Stations",
    "summary": "Launch team personnel report to their consoles in the Launch Control Center at Kennedy Space Center."
  },
  {
    "id": "countdown-clock-begins",
    "metHours": -49.667,
    "phase": "prelaunch",
    "title": "Countdown Clock Begins",
    "summary": "The official launch countdown clock starts at L−49 hours 40 minutes."
  },
  {
    "id": "orion-power-up",
    "metHours": -45.5,
    "phase": "prelaunch",
    "title": "Orion Spacecraft Powered Up",
    "summary": "The Orion crew module and European Service Module are powered on and begin system self-checks."
  },
  {
    "id": "core-stage-power-up",
    "metHours": -42.333,
    "phase": "prelaunch",
    "title": "Core Stage Powered Up",
    "summary": "The SLS core stage avionics and flight computers are powered on for pre-flight testing."
  },
  {
    "id": "rs25-final-prep",
    "metHours": -39.75,
    "phase": "prelaunch",
    "title": "Final Preparations of RS-25 Engines",
    "summary": "Technicians complete final inspections and preparations on the four RS-25 main engines."
  },
  {
    "id": "icps-power-up",
    "metHours": -20.25,
    "phase": "prelaunch",
    "title": "ICPS Powered Up for Launch",
    "summary": "The Interim Cryogenic Propulsion Stage upper stage is powered on and its RL10B-2 engine systems are checked."
  },
  {
    "id": "non-essential-leave-pad",
    "metHours": -15.5,
    "phase": "prelaunch",
    "title": "Non-Essential Personnel Leave Pad",
    "summary": "All non-essential workers are cleared from Launch Complex 39B as the countdown enters its critical phase."
  },
  {
    "id": "gls-activation",
    "metHours": -13.25,
    "phase": "prelaunch",
    "title": "Ground Launch Sequencer Activation",
    "summary": "The Ground Launch Sequencer (GLS) software is activated and begins monitoring vehicle health."
  },
  {
    "id": "built-in-hold-2h45m",
    "metHours": -12.583,
    "phase": "prelaunch",
    "title": "Built-in 2h 45m Hold Begins",
    "summary": "A planned 2-hour 45-minute hold in the countdown allows teams to catch up on procedures and resolve any open issues."
  },
  {
    "id": "go-nogo-tanking",
    "metHours": -10.833,
    "phase": "prelaunch",
    "title": "Go/No-Go for Tanking",
    "summary": "The Launch Director polls the team for permission to begin loading cryogenic propellants into the SLS core stage."
  },
  {
    "id": "lh2-slow-fill",
    "metHours": -9.917,
    "phase": "prelaunch",
    "title": "Core Stage LH₂ Slow Fill",
    "summary": "Loading of liquid hydrogen into the SLS core stage begins with a slow fill to chill down the tank and feed lines."
  },
  {
    "id": "resume-t-clock",
    "metHours": -9.833,
    "phase": "prelaunch",
    "title": "Resume T-Clock from T−8h 10m",
    "summary": "The T-clock resumes counting from T−8 hours 10 minutes, running in parallel with the L-clock."
  },
  {
    "id": "lox-slow-fill",
    "metHours": -9.667,
    "phase": "prelaunch",
    "title": "Core Stage LOX Slow Fill",
    "summary": "Liquid oxygen loading begins into the SLS core stage, starting with slow fill to chill the tank."
  },
  {
    "id": "orion-comms-activated",
    "metHours": -6.667,
    "phase": "prelaunch",
    "title": "Orion Comms Activated (RF to Mission Control)",
    "summary": "Orion’s RF communication link to Mission Control Houston is activated and verified."
  },
  {
    "id": "closeout-crew-assemble",
    "metHours": -6.167,
    "phase": "prelaunch",
    "title": "Closeout Crew Assemble",
    "summary": "The closeout crew assembles at the pad to prepare for crew arrival and ingress into Orion."
  },
  {
    "id": "crew-weather-brief",
    "metHours": -6,
    "phase": "prelaunch",
    "title": "Flight Crew Weather Brief",
    "summary": "The flight crew receives the final weather briefing from the 45th Weather Squadron at Patrick Space Force Base."
  },
  {
    "id": "built-in-hold-1h10m",
    "metHours": -5.167,
    "phase": "prelaunch",
    "title": "Built-in 1h 10m Hold Begins",
    "summary": "A planned 1-hour 10-minute hold provides final margin before crew transport to the pad."
  },
  {
    "id": "crew-deploy-to-pad",
    "metHours": -4.667,
    "phase": "prelaunch",
    "title": "Flight Crew Deployment to Pad",
    "summary": "The crew departs the Neil Armstrong Operations and Checkout Building for the 9-mile drive to Launch Complex 39B."
  },
  {
    "id": "crew-board-orion",
    "metHours": -4,
    "phase": "prelaunch",
    "title": "Flight Crew Board Orion (Ingress)",
    "summary": "The four crew members enter the Orion spacecraft via the Crew Access Arm and take their assigned seats."
  },
  {
    "id": "hatch-preps-closure",
    "metHours": -3.667,
    "phase": "prelaunch",
    "title": "Crew Module Hatch Preps and Closure",
    "summary": "The closeout crew prepares and closes the Orion crew module hatch, then performs leak checks."
  },
  {
    "id": "hatch-service-panel",
    "metHours": -2.333,
    "phase": "prelaunch",
    "title": "Hatch Service Panel Install / Closeouts",
    "summary": "The exterior hatch service panel is installed and final closeout tasks are performed on the crew module."
  },
  {
    "id": "las-hatch-closure",
    "metHours": -1.667,
    "phase": "prelaunch",
    "title": "Launch Abort System Hatch Closure",
    "summary": "The Launch Abort System (LAS) hatch is sealed, completing the closeout of the crew escape path."
  },
  {
    "id": "launch-director-brief",
    "metHours": -1.167,
    "phase": "prelaunch",
    "title": "Launch Director Brief",
    "summary": "Launch Director Charlie Blackwell-Thompson briefs the team on countdown status and any open items."
  },
  {
    "id": "closeout-crew-departs",
    "metHours": -0.833,
    "phase": "prelaunch",
    "title": "Closeout Crew Departs Pad",
    "summary": "The closeout crew leaves the mobile launcher and evacuates to the Launch Control Center, 5.6 km away."
  },
  {
    "id": "final-ntd-briefing",
    "metHours": -0.833,
    "phase": "prelaunch",
    "title": "Final NTD Briefing",
    "summary": "The NASA Test Director (NTD) delivers the final pre-launch briefing to all teams."
  },
  {
    "id": "built-in-hold-30m",
    "metHours": -0.667,
    "phase": "prelaunch",
    "title": "Built-in 30-Minute Hold",
    "summary": "The final planned hold in the countdown — 30 minutes of margin for last-minute issue resolution."
  },
  {
    "id": "orion-earth-comm",
    "metHours": -0.417,
    "phase": "prelaunch",
    "title": "Transition to Orion–Earth Comm Loop",
    "summary": "Communications switch from ground-based loops to the direct Orion–Earth space communication link."
  },
  {
    "id": "launch-director-poll",
    "metHours": -0.283,
    "phase": "prelaunch",
    "title": "Launch Director Polls Team for Go",
    "summary": "The Launch Director polls all console positions for a final “Go/No-Go” decision to proceed with launch."
  },
  {
    "id": "visors-down",
    "metHours": -0.25,
    "phase": "prelaunch",
    "title": "Flight Crew Visors Down",
    "summary": "The four crew members lower and lock their helmet visors, sealing their OCSS pressure suits for launch."
  },
  {
    "id": "terminal-countdown",
    "metHours": -0.167,
    "phase": "prelaunch",
    "title": "Terminal Countdown Begins (GLS)",
    "summary": "The Ground Launch Sequencer takes active control at T−10 minutes, beginning the automated terminal countdown."
  },
  {
    "id": "crew-access-arm-retract",
    "metHours": -0.133,
    "phase": "prelaunch",
    "title": "Crew Access Arm Retract",
    "summary": "The 55-metre Crew Access Arm swings away from Orion and locks into launch position."
  },
  {
    "id": "tank-press-internal-power",
    "metHours": -0.1,
    "phase": "prelaunch",
    "title": "Core Stage Tank Pressurization / Orion to Internal Power",
    "summary": "Core stage propellant tanks are pressurised to flight levels and Orion switches to internal battery power."
  },
  {
    "id": "las-capability-available",
    "metHours": -0.089,
    "phase": "prelaunch",
    "title": "LAS Capability Available",
    "summary": "The Launch Abort System is armed and ready to pull the crew module to safety if an abort is triggered."
  },
  {
    "id": "fts-armed",
    "metHours": -0.075,
    "phase": "prelaunch",
    "title": "Flight Termination System Armed",
    "summary": "The flight termination system is armed, giving Range Safety the ability to destroy the vehicle if it goes off course."
  },
  {
    "id": "core-stage-apu-start",
    "metHours": -0.067,
    "phase": "prelaunch",
    "title": "Core Stage APU Start",
    "summary": "The core stage Auxiliary Power Units start, providing hydraulic power for RS-25 engine gimballing."
  },
  {
    "id": "purge-sequence-4",
    "metHours": -0.053,
    "phase": "prelaunch",
    "title": "Purge Sequence 4",
    "summary": "The fourth and final purge sequence flushes the engine compartment with inert gas to prevent hydrogen accumulation."
  },
  {
    "id": "booster-internal-power",
    "metHours": -0.033,
    "phase": "prelaunch",
    "title": "Booster to Internal Power",
    "summary": "The twin solid rocket boosters switch to internal battery power in preparation for ignition."
  },
  {
    "id": "core-stage-internal-power",
    "metHours": -0.025,
    "phase": "prelaunch",
    "title": "Core Stage to Internal Power",
    "summary": "The SLS core stage disconnects from ground power and switches to internal batteries."
  },
  {
    "id": "icps-lh2-terminate",
    "metHours": -0.014,
    "phase": "prelaunch",
    "title": "ICPS LH₂ Terminate Replenish",
    "summary": "Liquid hydrogen replenishment to the ICPS upper stage is terminated and the fill line is secured."
  },
  {
    "id": "go-automated-sequencer",
    "metHours": -0.009,
    "phase": "prelaunch",
    "title": "Go for Automated Launch Sequencer",
    "summary": "Final “Go” is given and the automated launch sequencer takes full control for the final seconds."
  },
  {
    "id": "h2-burnoff-igniters",
    "metHours": -0.003,
    "phase": "prelaunch",
    "title": "Hydrogen Burn-Off Igniters",
    "summary": "Hydrogen burn-off igniters activate beneath the RS-25 engines to safely combust any free hydrogen before ignition."
  },
  {
    "id": "rs25-start-command",
    "metHours": -0.003,
    "phase": "prelaunch",
    "title": "RS-25 Engine Start Command",
    "summary": "The start command is sent to the four RS-25 engines, initiating the staggered ignition sequence."
  },
  {
    "id": "rs25-ignition",
    "metHours": -0.002,
    "phase": "prelaunch",
    "title": "RS-25 Engines Ignite",
    "summary": "All four RS-25 engines reach full thrust. The vehicle strains against the hold-down posts as systems are verified."
  },
  {
    "id": "booster-ignition-liftoff",
    "metHours": 0,
    "phase": "prelaunch",
    "title": "Booster Ignition — Liftoff!",
    "summary": "The twin solid rocket boosters ignite and the eight hold-down bolts are severed pyrotechnically. SLS lifts off from LC-39B."
  },
  {
    "id": "launch",
    "metHours": 0,
    "phase": "launch",
    "title": "Liftoff",
    "summary": "SLS lifts off from LC-39B at Kennedy Space Center. Nearly 40 MN of thrust pushes the crew toward orbit at ~8 km/s."
  },
  {
    "id": "max-q",
    "metHours": 0.0167,
    "phase": "launch",
    "title": "Max Q (Maximum Dynamic Pressure)",
    "summary": "The vehicle passes through the point of maximum aerodynamic stress at approximately T+60 seconds. Altitude ~14 km."
  },
  {
    "id": "srb-sep",
    "metHours": 0.035,
    "phase": "launch",
    "title": "SRB Separation",
    "summary": "The twin solid rocket boosters separate after burning for ~126 seconds, at an altitude of ~45 km."
  },
  {
    "id": "sm-fairing-jettison",
    "metHours": 0.0583,
    "phase": "launch",
    "title": "Service Module Fairing Jettison",
    "summary": "The protective fairing panels around the European Service Module are jettisoned, exposing the solar arrays and radiators."
  },
  {
    "id": "las-jettison",
    "metHours": 0.0625,
    "phase": "launch",
    "title": "Launch Abort System Jettison",
    "summary": "The Launch Abort System tower is jettisoned. It is no longer needed as the vehicle is above the altitude where it could safely pull the crew module away."
  },
  {
    "id": "meco",
    "metHours": 0.14,
    "phase": "launch",
    "title": "Core Stage MECO (Main Engine Cutoff)",
    "summary": "The four RS-25 engines shut down after ~8 minutes 24 seconds of powered flight. The core stage has done its job."
  },
  {
    "id": "core-sep",
    "metHours": 0.1433,
    "phase": "launch",
    "title": "Core Stage Separation & ICPS Ignition",
    "summary": "Core stage separates. The Interim Cryogenic Propulsion Stage (ICPS) ignites to reach initial parking orbit."
  },
  {
    "id": "icps-cutoff",
    "metHours": 0.3,
    "phase": "launch",
    "title": "ICPS Cutoff / Orbital Insertion",
    "summary": "ICPS completes its first burn. Orion reaches initial low Earth orbit at ~185 km (115 mi) altitude."
  },
  {
    "id": "solar-deploy",
    "metHours": 0.333,
    "phase": "launch",
    "title": "Solar Array Deployment",
    "summary": "The four solar array wings on the European Service Module unfurl to their full 19-metre span, generating 11.2 kW of electrical power."
  },
  {
    "id": "crew-checks",
    "metHours": 0.4,
    "phase": "launch",
    "title": "Crew Checks Begin",
    "summary": "Crew begins post-insertion checks: verifying suit integrity, cabin pressure, communications, and reviewing vehicle systems displays."
  },
  {
    "id": "perigee-raise-1",
    "metHours": 0.82,
    "phase": "earth-orbit",
    "title": "ICPS Perigee Raise Burn 1",
    "summary": "ICPS fires at T+49 min to raise orbit from 185 km circular to a highly elliptical orbit with apogee ~70,400 km."
  },
  {
    "id": "perigee-raise-2",
    "metHours": 1.82,
    "phase": "earth-orbit",
    "title": "ICPS Perigee Raise Burn 2",
    "summary": "Second ICPS burn further raises the orbit into high Earth orbit for systems checkout."
  },
  {
    "id": "orion-systems-checkout",
    "metHours": 2,
    "phase": "earth-orbit",
    "title": "Orion Systems Checkout Begins",
    "summary": "Crew begins comprehensive systems checkout: testing water dispenser, toilet, CO₂ removal, and reconfiguring the cabin for orbital operations."
  },
  {
    "id": "prox-ops",
    "metHours": 3.405,
    "phase": "earth-orbit",
    "title": "Proximity Operations Demo — ICPS Separation",
    "summary": "Orion separates from the spent ICPS upper stage at MET 3h 24m. The crew practises manual flying toward and around it as a docking-target surrogate."
  },
  {
    "id": "icps-sep-burn",
    "metHours": 4.833,
    "phase": "earth-orbit",
    "title": "Orion Upper Stage Separation Burn",
    "summary": "Orion fires its ESM thrusters to increase distance from the spent ICPS, ending proximity operations."
  },
  {
    "id": "icps-disposal",
    "metHours": 5,
    "phase": "earth-orbit",
    "title": "ICPS Disposal Burn",
    "summary": "The spent ICPS performs a disposal burn to move into a safe heliocentric orbit, away from Orion’s path."
  },
  {
    "id": "cubesat-deploy",
    "metHours": 5.067,
    "phase": "earth-orbit",
    "title": "CubeSat Deployment Sequence",
    "summary": "Ten small CubeSat satellites deploy from the ICPS at one-minute intervals, beginning secondary science missions in deep space."
  },
  {
    "id": "crew-sleep-1a",
    "metHours": 7,
    "phase": "earth-orbit",
    "title": "Crew Sleep Period 1",
    "summary": "Brief rest period after launch. Crew woken at MET ~12.5h for the perigee raise burn."
  },
  {
    "id": "orbit-geometry-burn",
    "metHours": 12.5,
    "phase": "earth-orbit",
    "title": "Orbit Geometry Burn",
    "summary": "Engine firing adjusts orbital geometry to set up the correct approach angle for the TLI burn on Flight Day 2."
  },
  {
    "id": "dsn-emergency-checkout",
    "metHours": 13,
    "phase": "earth-orbit",
    "title": "Deep Space Network Emergency Comms Checkout",
    "summary": "First test of Orion’s emergency communication system via the Deep Space Network — verifying the link that will be critical during the lunar phase."
  },
  {
    "id": "crew-sleep-1b",
    "metHours": 13,
    "phase": "earth-orbit",
    "title": "Crew Sleep Period 2",
    "summary": "After the perigee raise burn, crew returns to sleep until MET 20h. Crew requested wakeup music at MET 20:00."
  },
  {
    "id": "exercise-wiseman-glover",
    "metHours": 21.5,
    "phase": "earth-orbit",
    "title": "Crew Exercise",
    "summary": "Crew rotates on the flywheel resistive exercise device before the TLI burn."
  },
  {
    "id": "tli-prep",
    "metHours": 26,
    "phase": "earth-orbit",
    "title": "TLI Burn Preparation",
    "summary": "Koch prepares Orion’s orbital manoeuvring system engine for the critical translunar injection burn."
  },
  {
    "id": "tli",
    "metHours": 25.23,
    "phase": "translunar",
    "title": "⭐ Trans-Lunar Injection (TLI) Burn",
    "summary": "THE critical burn — ESM main engine fires for ~6 min 5 s, adding ~1,450 km/h to escape Earth orbit and set course for the Moon."
  },
  {
    "id": "post-tli-acclimation",
    "metHours": 32,
    "phase": "translunar",
    "title": "Post-TLI Crew Acclimation",
    "summary": "Crew verifies spacecraft health after TLI and begins adjusting to the outbound cruise phase."
  },
  {
    "id": "first-video-downlink",
    "metHours": 34,
    "phase": "translunar",
    "title": "First Space-to-Ground Video Communication",
    "summary": "The crew conducts their first live video session with Mission Control Houston, sharing the view of Earth receding behind them."
  },
  {
    "id": "outbound-correction-1",
    "metHours": 48.13,
    "phase": "outbound-coast",
    "title": "Outbound Trajectory Correction Burn 1",
    "summary": "First of three outbound mid-course corrections, fine-tuning Orion’s path to the Moon."
  },
  {
    "id": "cpr-demo",
    "metHours": 50,
    "phase": "outbound-coast",
    "title": "CPR Demonstration in Microgravity",
    "summary": "Glover, Koch, and Hansen demonstrate CPR procedures adapted for microgravity — a critical emergency skill for deep-space missions."
  },
  {
    "id": "medical-kit-checkout",
    "metHours": 52,
    "phase": "outbound-coast",
    "title": "Medical Kit Checkout",
    "summary": "Wiseman and Glover test the onboard medical kit: thermometer, blood pressure monitor, stethoscope, otoscope, and medications."
  },
  {
    "id": "dsn-emergency-test",
    "metHours": 53.42,
    "phase": "outbound-coast",
    "title": "Emergency Comms Test on Deep Space Network",
    "summary": "Koch tests Orion’s emergency communication modes through the Deep Space Network at increasing distance from Earth."
  },
  {
    "id": "emergency-procedure-practice",
    "metHours": 55,
    "phase": "outbound-coast",
    "title": "Emergency Procedure Practice — Cabin Depress & Fire",
    "summary": "Crew runs through emergency procedures for cabin depressurisation and fire — two of the most dangerous scenarios in deep space where rescue is impossible."
  },
  {
    "id": "outbound-science-experiments",
    "metHours": 56,
    "phase": "outbound-coast",
    "title": "Outbound Science Experiments",
    "summary": "The crew conducts a suite of biomedical and technology experiments during the outbound transit — the first human-tended experiments beyond low Earth orbit since Apollo."
  },
  {
    "id": "lunar-obs-rehearsal",
    "metHours": 57,
    "phase": "outbound-coast",
    "title": "Lunar Observation Rehearsal",
    "summary": "The crew rehearses the choreography for Flight Day 6’s lunar flyby observations — camera positions, attitude manoeuvres, and target sequences."
  },
  {
    "id": "gps-tdrs-range-limit",
    "metHours": 68,
    "phase": "outbound-coast",
    "title": "GPS & TDRS Range Limit — Beyond Earth’s Navigation Grid",
    "summary": "Orion passes beyond the effective range of GPS satellites and the TDRS relay network — from here, only NASA’s Deep Space Network can reach the crew."
  },
  {
    "id": "emergency-procedure-practice-2",
    "metHours": 70,
    "phase": "outbound-coast",
    "title": "Emergency Procedure Practice — Rapid Abort Scenarios",
    "summary": "Second emergency drill session: the crew practises abort scenarios including an emergency return trajectory burn and contingency power-down procedures."
  },
  {
    "id": "outbound-correction-2",
    "metHours": 73.13,
    "phase": "outbound-coast",
    "title": "Outbound Trajectory Correction Burn 2",
    "summary": "Second mid-course correction refines Orion’s lunar approach path."
  },
  {
    "id": "lunar-target-study",
    "metHours": 74,
    "phase": "outbound-coast",
    "title": "Lunar Geography Target Study",
    "summary": "Each crew member reviews their assigned geographic targets for lunar flyby imaging — specific craters, maria, and the South Pole–Aitken Basin."
  },
  {
    "id": "celestial-photography",
    "metHours": 78,
    "phase": "outbound-coast",
    "title": "Celestial Photography Session",
    "summary": "Crew photographs celestial bodies from Orion’s windows — a 20-minute dedicated photography session capturing views impossible from Earth."
  },
  {
    "id": "spacesuit-pressure-test",
    "metHours": 98,
    "phase": "outbound-coast",
    "title": "Spacesuit Pressure Tests",
    "summary": "Crew tests rapid donning and pressurisation of the Orion Crew Survival System (OCSS) suits — practising emergency scenarios."
  },
  {
    "id": "suit-eat-drink-test",
    "metHours": 100,
    "phase": "outbound-coast",
    "title": "Suit Eat/Drink Port Test",
    "summary": "Crew tests eating and drinking through the helmet port while suited — validating the ability to sustain crew during extended suited operations."
  },
  {
    "id": "outbound-correction-3",
    "metHours": 100.48,
    "phase": "outbound-coast",
    "title": "Outbound Trajectory Correction Burn 3",
    "summary": "Final outbound mid-course correction before the lunar flyby — last chance to fine-tune the approach trajectory."
  },
  {
    "id": "lunar-sphere-influence",
    "metHours": 102.13,
    "phase": "outbound-coast",
    "title": "⭐ Enter Lunar Sphere of Influence",
    "summary": "Orion crosses into the Moon’s gravitational sphere of influence at ~66,200 km from the lunar centre — the Moon’s gravity is now the dominant force acting on the spacecraft."
  },
  {
    "id": "lunar-approach",
    "metHours": 120,
    "phase": "lunar-flyby",
    "title": "Approach to Moon",
    "summary": "Orion begins its close approach to the Moon. The crew prepares cameras and observation equipment for the historic flyby."
  },
  {
    "id": "closest-approach",
    "metHours": 120.52,
    "phase": "lunar-flyby",
    "title": "⭐ Closest Approach — ~8,900 km Above Lunar Surface",
    "summary": "The emotional and navigational heart of the mission — Orion passes ~8,900 km (~5,530 mi) above the Moon, closer than any crewed spacecraft since Apollo."
  },
  {
    "id": "lunar-surface-obs",
    "metHours": 121,
    "phase": "lunar-flyby",
    "title": "Lunar Surface Observation & Photography",
    "summary": "Intensive photography and scientific observation of the lunar surface during the close-approach window."
  },
  {
    "id": "far-side-blackout",
    "metHours": 122,
    "phase": "lunar-flyby",
    "title": "⭐ Far Side of Moon — Communications Blackout (30–50 min)",
    "summary": "Orion passes behind the Moon. All radio contact with Earth is lost for 30–50 minutes — the crew is completely on their own, farther from contact with home than any humans in history."
  },
  {
    "id": "far-side-photography",
    "metHours": 122.5,
    "phase": "lunar-flyby",
    "title": "Far-Side Photography Session",
    "summary": "During the communications blackout, the crew turns all cameras toward the Moon’s far side — a landscape no human eye has seen directly since Apollo 17."
  },
  {
    "id": "signal-reacquired",
    "metHours": 122.8,
    "phase": "lunar-flyby",
    "title": "Signal Reacquired",
    "summary": "Orion emerges from behind the Moon and re-establishes communication with Earth. Mission Control confirms spacecraft health."
  },
  {
    "id": "distance-record",
    "metHours": 121.43,
    "phase": "lunar-flyby",
    "title": "⭐ Maximum Distance from Earth — ~4,600 mi Beyond the Far Side",
    "summary": "Orion reaches its maximum distance from Earth at approximately 405,500 km — surpassing Apollo 13’s record of 400,171 km by over 5,300 km, and passing roughly 4,600 miles beyond the Moon’s far side."
  },
  {
    "id": "post-flyby-science",
    "metHours": 130,
    "phase": "lunar-flyby",
    "title": "Post-Flyby Science Observations",
    "summary": "Continued photography and observations as Orion departs the Moon — capturing the receding lunar landscape and \"Earthrise\" views."
  },
  {
    "id": "exit-lunar-sphere",
    "metHours": 138.87,
    "phase": "return-coast",
    "title": "Exit Lunar Sphere of Influence",
    "summary": "Orion exits the Moon’s gravitational sphere of influence — Earth’s gravity is once again the dominant force. The homeward journey accelerates from here."
  },
  {
    "id": "day7-off-duty",
    "metHours": 142,
    "phase": "return-coast",
    "title": "Crew Off-Duty Day — Rest & Personal Time",
    "summary": "Largely off-duty day for the crew to rest and recover after the intense lunar flyby. Minimal scheduled activities."
  },
  {
    "id": "return-correction-1",
    "metHours": 145.48,
    "phase": "return-coast",
    "title": "Return Trajectory Correction Burn 1",
    "summary": "First of three return course-correction burns to adjust Orion’s path toward the re-entry corridor."
  },
  {
    "id": "radiation-shelter",
    "metHours": 170,
    "phase": "return-coast",
    "title": "Radiation Shelter Demonstration",
    "summary": "Crew builds a protective radiation shelter using Orion’s supplies and equipment — demonstrating shielding from solar particle events."
  },
  {
    "id": "manual-piloting-demo",
    "metHours": 174,
    "phase": "return-coast",
    "title": "Manual Piloting Demo — 6-DOF vs 3-DOF",
    "summary": "Crew tests Orion’s manual flight control modes: target centering, tail-to-Sun attitude, and comparing 6-DOF vs 3-DOF handling."
  },
  {
    "id": "return-correction-2",
    "metHours": 196.48,
    "phase": "return-coast",
    "title": "Return Trajectory Correction Burn 2",
    "summary": "Second return course correction keeps Orion precisely on target for the Pacific Ocean splashdown zone."
  },
  {
    "id": "reentry-procedure-review",
    "metHours": 196,
    "phase": "return-coast",
    "title": "Re-Entry Procedure Review",
    "summary": "Crew studies re-entry procedures and coordinates with the flight control team on the timeline for atmospheric entry."
  },
  {
    "id": "equipment-stow-begins",
    "metHours": 200,
    "phase": "return-coast",
    "title": "Equipment Stow Begins",
    "summary": "Crew begins securing loose equipment and reconfiguring the cabin for the high-g re-entry environment."
  },
  {
    "id": "final-stow-cabin-prep",
    "metHours": 214,
    "phase": "reentry",
    "title": "Final Stow & Cabin Prep",
    "summary": "Final cabin preparations for re-entry — all equipment secured, seats in landing position, cabin in launch configuration."
  },
  {
    "id": "crew-dons-suits",
    "metHours": 218,
    "phase": "reentry",
    "title": "Crew Dons Spacesuits for Re-Entry",
    "summary": "All four crew members don their OCSS pressure suits, close visors, and strap into their seats for atmospheric entry."
  },
  {
    "id": "esm-sep",
    "metHours": 222,
    "phase": "reentry",
    "title": "Service Module Separation",
    "summary": "The European Service Module separates from the crew module via pyrotechnic bolts. Only the capsule continues to splashdown."
  },
  {
    "id": "entry-interface",
    "metHours": 225,
    "phase": "reentry",
    "title": "⭐ Entry Interface — Hitting Atmosphere at 40,000 km/h",
    "summary": "Orion enters Earth’s atmosphere at 120 km altitude, travelling at ~40,000 km/h (25,000 mph). Heat shield faces ~2,760 °C (5,000 °F)."
  },
  {
    "id": "reentry-radio-blackout",
    "metHours": 225.5,
    "phase": "reentry",
    "title": "Re-Entry Communications Blackout",
    "summary": "Ionised plasma around the capsule blocks all radio signals for approximately 5 minutes during peak heating."
  },
  {
    "id": "drogue-chutes",
    "metHours": 226,
    "phase": "reentry",
    "title": "Drogue Parachute Deploy",
    "summary": "At ~11,000 m (36,000 ft), two drogue parachutes deploy to stabilise and slow the capsule from ~480 km/h to ~200 km/h."
  },
  {
    "id": "main-chutes",
    "metHours": 226.2,
    "phase": "reentry",
    "title": "Main Parachute Deploy",
    "summary": "Three 35 m (116 ft) main parachutes open in stages, slowing Orion to ~27 km/h (17 mph) for splashdown."
  },
  {
    "id": "splashdown",
    "metHours": 226.5,
    "phase": "reentry",
    "title": "⭐ Splashdown in Pacific Ocean",
    "summary": "Orion splashes down in the Pacific Ocean ~370 km off San Diego, California. The Artemis II mission is complete."
  },
  {
    "id": "recovery",
    "metHours": 228,
    "phase": "recovery",
    "title": "Crew Recovery by USS Portland",
    "summary": "Navy divers stabilise the capsule. Crew exits and is helicopter-lifted to the USS Portland (LPD-27) for medical evaluation."
  }
];

// ── Active timeline (populated from schedule.json or fallback) ─────────────
var TIMELINE = [];

// ── Untimed activities grouped by day (populated by buildTimeline) ──────────
// { 3: [{id, day, phase, title, description, detail, links}, ...], 4: [...], ... }
var UNTIMED_ACTIVITIES = {};

// ── Phase labels ───────────────────────────────────────────────────────────
var PHASE_LABELS = {
  'prelaunch':       'Pre-Launch Preparations',
  'launch':          'Launch & Ascent',
  'earth-orbit':     'Earth Orbit Operations',
  'translunar':      'Trans-Lunar Injection',
  'outbound-coast':  'Outbound Coast',
  'lunar-flyby':     'Lunar Flyby',
  'return-coast':    'Return Coast',
  'reentry':         'Re-Entry & Landing',
  'recovery':        'Recovery',
  'postmission':     'Mission Complete'
};

// Phase ordering for collapsible timeline groups
var PHASE_ORDER = [
  'prelaunch',
  'launch',
  'earth-orbit',
  'translunar',
  'outbound-coast',
  'lunar-flyby',
  'return-coast',
  'reentry',
  'recovery'
];

// ── Mock telemetry (used when AROW is unavailable) ─────────────────────────
// These values simulate the trajectory at various MET hours.
// The app interpolates between keyframes.
var MOCK_TELEMETRY_KEYFRAMES = [
  { metHours: 0,      distEarthKm: 0,       distMoonKm: 384400, speedKmh: 28800, altitudeKm: 0 },
  { metHours: 0.3,    distEarthKm: 185,     distMoonKm: 384215, speedKmh: 28000, altitudeKm: 185 },
  { metHours: 3.5,    distEarthKm: 500,     distMoonKm: 383900, speedKmh: 27500, altitudeKm: 500 },
  { metHours: 12.5,   distEarthKm: 44555,   distMoonKm: 339845, speedKmh: 15000, altitudeKm: 44555 },
  { metHours: 30,     distEarthKm: 55000,   distMoonKm: 329400, speedKmh: 10800, altitudeKm: 55000 },
  { metHours: 48,     distEarthKm: 130000,  distMoonKm: 254400, speedKmh: 5400,  altitudeKm: 130000 },
  { metHours: 72,     distEarthKm: 220000,  distMoonKm: 164400, speedKmh: 4000,  altitudeKm: 220000 },
  { metHours: 96,     distEarthKm: 320000,  distMoonKm: 64400,  speedKmh: 3200,  altitudeKm: 320000 },
  { metHours: 120,    distEarthKm: 378000,  distMoonKm: 8900,   speedKmh: 5800,  altitudeKm: 8900 },
  { metHours: 126,    distEarthKm: 405500,  distMoonKm: 25000,  speedKmh: 4200,  altitudeKm: 405500 },
  { metHours: 144,    distEarthKm: 360000,  distMoonKm: 65000,  speedKmh: 3800,  altitudeKm: 360000 },
  { metHours: 168,    distEarthKm: 270000,  distMoonKm: 155000, speedKmh: 4500,  altitudeKm: 270000 },
  { metHours: 192,    distEarthKm: 150000,  distMoonKm: 280000, speedKmh: 7000,  altitudeKm: 150000 },
  { metHours: 222,    distEarthKm: 8000,    distMoonKm: 376400, speedKmh: 25000, altitudeKm: 8000 },
  { metHours: 225,    distEarthKm: 120,     distMoonKm: 384280, speedKmh: 40000, altitudeKm: 120 },
  { metHours: 226.5,  distEarthKm: 0,       distMoonKm: 384400, speedKmh: 27,    altitudeKm: 0 }
];

// ── Placeholder news items ─────────────────────────────────────────────────
var PLACEHOLDER_NEWS = [
  {
    title: 'Artemis II Launch Countdown Begins',
    date: '2026-03-30T18:00:00Z',
    summary: 'NASA has begun the countdown for the Artemis II mission, with launch targeted for April 1 at 6:24 p.m. EDT.',
    url: 'https://www.nasa.gov/blogs/missions/2026/03/30/nasas-artemis-ii-launch-mission-countdown-begins/'
  },
  {
    title: 'Weather 80% Favourable for Launch',
    date: '2026-03-30T20:00:00Z',
    summary: 'The 45th Weather Squadron forecasts an 80% chance of acceptable conditions for the two-hour launch window.',
    url: 'https://www.nasa.gov/blogs/missions/2026/03/30/weather-for-nasas-artemis-ii-mission-launch-80-favorable/'
  },
  {
    title: 'AROW Tracking Tool Ready for Artemis II',
    date: '2026-03-09T12:00:00Z',
    summary: 'NASA\'s Artemis Real-time Orbit Website will provide live telemetry data starting one minute after liftoff.',
    url: 'https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/'
  }
];

// ── G-Force Events ───────────────────────────────────────────────────────
// Known burn events with approximate G-force ranges and timing (MET hours).
// Between events, coast phases are microgravity (0 G).
var GFORCE_EVENTS = [
  { startMET: -999,  endMET: 0,       gMin: 1.0, gMax: 1.0, label: 'Ground' },
  { startMET: 0,     endMET: 0.035,   gMin: 1.0, gMax: 3.5, label: 'Launch & SRB ascent' },
  { startMET: 0.035, endMET: 0.036,   gMin: 1.0, gMax: 1.0, label: 'SRB separation' },
  { startMET: 0.036, endMET: 0.14,    gMin: 1.0, gMax: 2.5, label: 'Core stage ascent' },
  { startMET: 0.14,  endMET: 0.1433,  gMin: 0.0, gMax: 0.0, label: 'Coast — MECO to ICPS ignition' },
  { startMET: 0.1433, endMET: 0.30,   gMin: 0.5, gMax: 0.5, label: 'ICPS orbital insertion burn' },
  { startMET: 0.83,  endMET: 0.93,    gMin: 0.5, gMax: 0.5, label: 'Perigee raise burn 1' },
  { startMET: 1.83,  endMET: 1.93,    gMin: 0.5, gMax: 0.5, label: 'Perigee raise burn 2' },
  { startMET: 30,    endMET: 30.1,    gMin: 1.3, gMax: 1.3, label: 'Trans-Lunar Injection burn' },
  { startMET: 48,    endMET: 48.01,   gMin: 0.0, gMax: 0.1, label: 'Outbound correction 1' },
  { startMET: 72,    endMET: 72.01,   gMin: 0.0, gMax: 0.1, label: 'Outbound correction 2' },
  { startMET: 102,   endMET: 102.01,  gMin: 0.0, gMax: 0.1, label: 'Outbound correction 3' },
  { startMET: 168,   endMET: 168.01,  gMin: 0.0, gMax: 0.1, label: 'Return correction 1' },
  { startMET: 192,   endMET: 192.01,  gMin: 0.0, gMax: 0.1, label: 'Return correction 2' },
  { startMET: 225,   endMET: 225.5,   gMin: 1.0, gMax: 5.0, label: 'Atmospheric re-entry' }
];

// Human-readable G-force context translations
var GFORCE_CONTEXT = [
  { max: 0,    text: 'Weightless — objects float freely' },
  { max: 0.5,  text: 'Gentle push — like braking in a car' },
  { max: 1.0,  text: 'Normal Earth gravity' },
  { max: 1.5,  text: 'Like a moderate roller coaster' },
  { max: 3.0,  text: 'Like an intense roller coaster or fighter jet turn' },
  { max: 3.5,  text: 'Significant force — breathing requires effort' },
  { max: 999,  text: 'Extreme — vision may narrow, suits help prevent blackout' }
];

// ── Crew Schedule ────────────────────────────────────────────────────────
// Time blocks keyed by MET hours.  Each block has start, end, label, day,
// and an optional description based on NASA's published Artemis II daily agenda.
// Source: nasa.gov/missions/artemis/artemis-2/nasas-artemis-ii-moon-mission-daily-agenda
var CREW_SCHEDULE = [
  // Day 1 — Launch & Earth orbit checkout
  { startMET: 0,    endMET: 0.15, day: 1, label: 'Launch & ascent',
    desc: 'SLS liftoff, main-engine cutoff ~8 min after launch.' },
  { startMET: 0.15, endMET: 1,    day: 1, label: 'Orbital insertion burns',
    desc: 'ICPS perigee-raise burn (~49 min), then high-Earth orbit insertion (~1 hr).' },
  { startMET: 1,    endMET: 3,    day: 1, label: 'Post-insertion checks',
    desc: 'Remove launch suits, reconfigure cabin for living and work.' },
  { startMET: 3,    endMET: 5,    day: 1, label: 'Proximity operations demo',
    desc: 'ICPS becomes docking target; crew practices manual flying toward and around it.' },
  { startMET: 5,    endMET: 8,    day: 1, label: 'Orion systems checkout',
    desc: 'Test potable water dispenser, toilet, CO₂ removal system.' },
  { startMET: 7,    endMET: 7.5,  day: 1, label: 'Crew meal',
    desc: 'First meal in orbit — test food rehydration system.' },
  { startMET: 7.5,  endMET: 12.5, day: 1, label: 'Sleep period',
    desc: 'Brief rest period (~4 hours) after first day in space.' },
  { startMET: 12.5, endMET: 14,   day: 1, label: 'Orbital manoeuvre & DSN checkout',
    desc: 'Engine firing for correct TLI orbital geometry; emergency comms test on Deep Space Network.' },
  { startMET: 13,   endMET: 20, day: 1, label: 'Sleep period',
    desc: 'After perigee raise burn, crew returns to sleep for ~4.5 hours before first full day in space.' },

  // Day 2 — Exercise, TLI burn, first video downlink
  { startMET: 20, endMET: 21.5,   day: 2, label: 'Wake & meal',
    desc: 'Morning routine and breakfast.' },
  { startMET: 21.5, endMET: 24,   day: 2, label: 'Flywheel exercise setup & workout',
    desc: 'Wiseman and Glover set up flywheel exercise device and perform first mission workouts.' },
  { startMET: 24,   endMET: 27,   day: 2, label: 'Koch & Hansen exercise',
    desc: 'Koch and Hansen exercise on the flywheel device.' },
  { startMET: 26,   endMET: 30,   day: 2, label: 'TLI burn preparation',
    desc: 'Koch prepares Orion\'s orbital manoeuvring system engine (~6,000 lbs thrust) for translunar injection.' },
  { startMET: 30,   endMET: 30.3, day: 2, label: 'Translunar injection burn',
    desc: 'The TLI burn — sets course for the Moon and establishes the free-return trajectory for Earth return on Day 10.' },
  { startMET: 30.3, endMET: 32,   day: 2, label: 'Post-TLI checks & acclimation',
    desc: 'Verify spacecraft health after the critical burn; confirm trajectory; crew acclimation time.' },
  { startMET: 32,   endMET: 34,   day: 2, label: 'First video downlink',
    desc: 'First space-to-ground video communication session with Mission Control.' },
  { startMET: 34,   endMET: 42,   day: 2, label: 'Sleep period',
    desc: 'Full rest period after TLI day.' },

  // Day 3 — First outbound trajectory correction, medical demos
  { startMET: 42,   endMET: 44,   day: 3, label: 'Wake & meal',
    desc: 'Morning routine and breakfast.' },
  { startMET: 44,   endMET: 46,   day: 3, label: 'Trajectory correction burn #1 prep',
    desc: 'Hansen prepares for first of three outbound course-correction burns.' },
  { startMET: 46,   endMET: 46.2, day: 3, label: 'Outbound trajectory correction burn #1',
    desc: 'First mid-course correction ensures Orion stays on target for the Moon.' },
  { startMET: 46.2, endMET: 50,   day: 3, label: 'CPR & medical kit demo',
    desc: 'Glover, Koch, and Hansen demonstrate CPR procedures in microgravity; Wiseman and Glover check out medical kit.' },
  { startMET: 50,   endMET: 52,   day: 3, label: 'DSN emergency comms test',
    desc: 'Koch tests Orion\'s emergency communications system on the Deep Space Network.' },
  { startMET: 52,   endMET: 55,   day: 3, label: 'Lunar flyby rehearsal',
    desc: 'Entire crew rehearses choreography for Day 6 lunar flyby scientific observations.' },
  { startMET: 55,   endMET: 57,   day: 3, label: 'Exercise & personal time',
    desc: 'Crew exercise and downtime.' },
  { startMET: 57,   endMET: 58,   day: 3, label: 'Video downlink',
    desc: 'Scheduled space-to-ground video session.' },
  { startMET: 58,   endMET: 66,   day: 3, label: 'Sleep period',
    desc: 'Full rest period.' },

  // Day 4 — Second trajectory correction, lunar target study
  { startMET: 66,   endMET: 68,   day: 4, label: 'Wake & meal',
    desc: 'Morning routine and breakfast.' },
  { startMET: 68,   endMET: 70,   day: 4, label: 'Trajectory correction burn #2 prep',
    desc: 'Preparation for second outbound course correction.' },
  { startMET: 70,   endMET: 70.2, day: 4, label: 'Outbound trajectory correction burn #2',
    desc: 'Second mid-course correction refines lunar approach path.' },
  { startMET: 70.2, endMET: 74,   day: 4, label: 'Lunar target study',
    desc: 'Each astronaut reviews geographic targets for Day 6 imagery — exact targets based on launch day/time.' },
  { startMET: 74,   endMET: 76,   day: 4, label: 'Celestial photography',
    desc: 'Crew photographs celestial bodies from Orion\'s windows.' },
  { startMET: 76,   endMET: 78,   day: 4, label: 'Exercise',
    desc: 'Flywheel workout session.' },
  { startMET: 78,   endMET: 80,   day: 4, label: 'Video downlink & personal time',
    desc: 'Video call with ground and free time.' },
  { startMET: 80,   endMET: 82,   day: 4, label: 'Crew meal',
    desc: 'Evening meal.' },
  { startMET: 82,   endMET: 90,   day: 4, label: 'Sleep period',
    desc: 'Full rest period.' },

  // Day 5 — Spacesuit testing, final outbound correction, enter lunar sphere
  { startMET: 90,   endMET: 92,   day: 5, label: 'Wake & meal',
    desc: 'Morning routine and breakfast.' },
  { startMET: 92,   endMET: 97,   day: 5, label: 'Spacesuit pressure testing',
    desc: 'Test donning suits quickly, pressurizing them, installing seats, eating/drinking through helmet port.' },
  { startMET: 97,   endMET: 99,   day: 5, label: 'Crew meal & rest',
    desc: 'Midday break.' },
  { startMET: 99,  endMET: 100,   day: 5, label: 'Trajectory correction burn #3 prep',
    desc: 'Preparation for final outbound course correction before lunar flyby.' },
  { startMET: 100,  endMET: 100.2, day: 5, label: 'Outbound trajectory correction burn #3',
    desc: 'Final outbound mid-course correction. Orion enters the lunar sphere of influence today.' },
  { startMET: 100.2, endMET: 102, day: 5, label: 'Exercise',
    desc: 'Flywheel workout session.' },
  { startMET: 102,  endMET: 104,  day: 5, label: 'Video downlink & personal time',
    desc: 'Video call with ground and free time.' },
  { startMET: 104,  endMET: 106,  day: 5, label: 'Crew meal',
    desc: 'Evening meal.' },
  { startMET: 106,  endMET: 114,  day: 5, label: 'Sleep period',
    desc: 'Full rest period before lunar flyby day.' },

  // Day 6 — Lunar flyby
  { startMET: 114,  endMET: 116,  day: 6, label: 'Wake early — lunar flyby day',
    desc: 'Early wake-up for the historic lunar flyby.' },
  { startMET: 116,  endMET: 118,  day: 6, label: 'Crew meal & flyby prep',
    desc: 'Breakfast and final preparation for close lunar approach.' },
  { startMET: 118,  endMET: 124,  day: 6, label: 'Lunar flyby — photography & observations',
    desc: 'Closest approach: 4,000–6,000 miles from lunar surface. Moon appears basketball-sized at arm\'s length. Crew photographs and records observations.' },
  { startMET: 124,  endMET: 125,  day: 6, label: 'Far-side transit — loss of signal',
    desc: 'Orion passes behind the Moon. Communications blackout lasting 30–50 minutes.' },
  { startMET: 125,  endMET: 130,  day: 6, label: 'Post-flyby science & observation',
    desc: 'Continued photography and recordings after reacquiring signal. First humans to see parts of the lunar far side with their own eyes.' },
  { startMET: 130,  endMET: 132,  day: 6, label: 'Exercise & crew meal',
    desc: 'Post-flyby meal and exercise.' },
  { startMET: 132,  endMET: 134,  day: 6, label: 'Video downlink',
    desc: 'Share lunar flyby experience with Mission Control and the world.' },
  { startMET: 134,  endMET: 142,  day: 6, label: 'Sleep period',
    desc: 'Rest period after the historic flyby.' },

  // Day 7 — Exit lunar sphere, first return correction, crew debrief
  { startMET: 142,  endMET: 144,  day: 7, label: 'Wake & meal',
    desc: 'Morning routine. Orion exits the lunar sphere of influence today.' },
  { startMET: 144,  endMET: 147,  day: 7, label: 'Crew lunar debrief',
    desc: 'Ground scientists speak with crew while the lunar flyby experience is fresh.' },
  { startMET: 147,  endMET: 148,  day: 7, label: 'Return trajectory correction burn #1',
    desc: 'First of three return course corrections to adjust path home.' },
  { startMET: 148,  endMET: 150,  day: 7, label: 'Exercise',
    desc: 'Flywheel workout session.' },
  { startMET: 150,  endMET: 154,  day: 7, label: 'Off-duty time',
    desc: 'Largely off-duty day for rest before final return phase tasks.' },
  { startMET: 154,  endMET: 156,  day: 7, label: 'Crew meal',
    desc: 'Evening meal.' },
  { startMET: 156,  endMET: 166,  day: 7, label: 'Sleep period',
    desc: 'Extended rest period.' },

  // Day 8 — Radiation shelter demo, manual piloting test
  { startMET: 166,  endMET: 168,  day: 8, label: 'Wake & meal',
    desc: 'Morning routine and breakfast.' },
  { startMET: 168,  endMET: 172,  day: 8, label: 'Radiation shelter demonstration',
    desc: 'Crew builds a protective shelter using Orion supplies — demonstrating shielding from solar particle events.' },
  { startMET: 172,  endMET: 176,  day: 8, label: 'Manual piloting demonstration',
    desc: 'Test Orion manual control: target centering, tail-to-Sun attitude, 6-DOF vs 3-DOF manoeuvres.' },
  { startMET: 176,  endMET: 178,  day: 8, label: 'Exercise',
    desc: 'Flywheel workout session.' },
  { startMET: 178,  endMET: 180,  day: 8, label: 'Video downlink & crew meal',
    desc: 'Video call with ground and evening meal.' },
  { startMET: 180,  endMET: 190,  day: 8, label: 'Sleep period',
    desc: 'Full rest period.' },

  // Day 9 — Re-entry prep, return correction, garment fit checks
  { startMET: 190,  endMET: 192,  day: 9, label: 'Wake & meal',
    desc: 'Morning routine and breakfast.' },
  { startMET: 192,  endMET: 195,  day: 9, label: 'Re-entry & splashdown procedure review',
    desc: 'Crew studies re-entry procedures and talks with flight control team.' },
  { startMET: 195,  endMET: 196,  day: 9, label: 'Return trajectory correction burn #2',
    desc: 'Course correction to keep Orion on target for splashdown zone.' },
  { startMET: 196,  endMET: 198,  day: 9, label: 'Waste system & garment testing',
    desc: 'Test backup waste collection systems; fit-check orthostatic intolerance compression garments.' },
  { startMET: 198,  endMET: 200,  day: 9, label: 'Exercise & personal time',
    desc: 'Final workout session and personal time.' },
  { startMET: 200,  endMET: 202,  day: 9, label: 'Crew meal',
    desc: 'Evening meal — last full evening in space.' },
  { startMET: 202,  endMET: 206,  day: 9, label: 'Sleep period',
    desc: 'Final rest period before re-entry day.' },

  // Day 10 — Re-entry & splashdown
  { startMET: 210,   endMET: 214,   day: 10, label: 'Wake early — re-entry day',
    desc: 'Early wake-up for the final day of the mission.' },
  { startMET: 214,   endMET: 218,   day: 10, label: 'Final stow & cabin prep',
    desc: 'Return cabin to launch configuration: stow equipment, install seats.' },
  { startMET: 218,   endMET: 222,   day: 10, label: 'Don spacesuits for re-entry',
    desc: 'Crew dons OCSS pressure suits, closes visors, and straps in for atmospheric entry.' },
  { startMET: 222,   endMET: 225,   day: 10, label: 'Service module separation',
    desc: 'Crew module separates from European Service Module prior to atmospheric entry.' },
  { startMET: 225,   endMET: 226,   day: 10, label: 'Atmospheric re-entry',
    desc: 'Heat shield faces temperatures up to ~2,760 °C (5,000 °F) during re-entry at ~40,000 km/h.' },
  { startMET: 226,   endMET: 226.5, day: 10, label: 'Parachute descent',
    desc: 'Drogue chutes slow to ~494 km/h, then three main chutes deploy — final descent at ~27 km/h.' },
  { startMET: 226.5, endMET: 228,   day: 10, label: 'Splashdown & recovery',
    desc: 'Splashdown in the Pacific Ocean. NASA and U.S. Navy recovery teams retrieve crew and capsule.' }
];

// ── Comms blackout windows ───────────────────────────────────────────────
// Times when Orion is behind the Moon and cannot communicate with Earth.
var COMMS_BLACKOUT_WINDOWS = [
  { startMET: 128, endMET: 128.7, reason: 'Orion is behind the Moon' },
  { startMET: 225.5, endMET: 225.6, reason: 'Re-entry plasma blackout' }
];
