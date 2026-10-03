# Parking Simulator

Learn the feel of parking from the driver's seat with a multi-view driving
simulator built for practice.

## Run locally

Run `npm run dev`, then open **http://127.0.0.1:4819/**. The explicit address
avoids accidentally opening another development server through `localhost`.

## [Play Parking Simulator](https://chris-kc-cheng.github.io/parking-simulator/)

![Parking Simulator showing the connected city, live traffic, windshield, mirrors, rear camera, and bird's-eye view](screenshot.png)

## Explore the city

Drive one continuous city map with a simple orthogonal street grid inspired by
Berczy Village in Markham, Ontario. Every road is straight and every junction is
a four-way `+` intersection, with no diagonal roads or roundabouts. Stop signs mark intersection corners,
multiple marked parking lots and curbside parking add denser practice areas, and
the highlighted bay gives you a destination for front-in or
back-in practice.

Live traffic keeps to the right of the physical white center line and begins
braking early to leave three car lengths between its bumper and your vehicle.
At intersections, the expanded traffic population can continue straight or choose
a left or right turn, then settles into the correct right-hand lane under Canadian
drive-on-right rules. Non-parking traffic remains part of the live movement system;
if a traffic car stays boxed in for three seconds, it is restarted on its moving route
instead of becoming a permanent stopped street obstacle.
The cross street directly ahead of the learner's starting parking bay also has
eastbound and westbound live traffic, making movement visible immediately.
The windshield renders at 30 FPS while mirrors and camera panels refresh at
12 FPS, leaving enough frame time for continuous traffic physics and steering.
Moving traffic follows the car ahead with a graduated 18-metre braking zone,
preventing collision-box deadlocks while preserving a safe stopped gap.
Every view projects the same map markings, so the windshield, mirrors, rear camera,
and bird's-eye camera always agree. Buildings are solid obstacles,
so use the connected road network to drive around each block.

The neighbourhood structure is a scaled driving interpretation rather than a
survey-accurate navigation map. It was informed by the [City of Markham official
plan](https://www.markham.ca/economic-development-business/planning-development-services/official-plan),
the [City street guide](https://www.markham.ca/about-the-city-of-markham/city-hall/interactive-maps-applications),
and [OpenStreetMap](https://www.openstreetmap.org/#map=15/43.8914/-79.3038).

## Drive

| Action | Keyboard | On-screen control |
| --- | --- | --- |
| Steer left or right | <kbd>←</kbd> / <kbd>→</kbd> | Hold the left or right arrow |
| Drive forward / brake while reversing | <kbd>↑</kbd> | Hold the **↑** button |
| Reverse / brake while driving forward | <kbd>↓</kbd> | Hold the **↓** button |
| Select a gear | — | Choose **P**, **R**, **N**, or **D** on the dashboard |
| Sound the horn | — | Press **Horn** in the centre of the steering wheel |
| Left turn signal | <kbd>L</kbd> | Press **L** in the bottom control bar |
| Right turn signal | <kbd>R</kbd> | Press **R** in the bottom control bar |
| Toggle slow windshield wipers | <kbd>W</kbd> | Press **Wiper** in the bottom control bar |
| Change weather | — | Choose **Sunny**, **Rainy**, or **Night** in the bottom-left toggle group |
| Toggle the learner car headlamps | — | Press **Headlamp On/Off** in the bottom-left group |
| Toggle both camera panels | — | Press **Cameras On/Off** in the bottom-left group |

Hold the accelerator to reach the simulator's 100 km/h maximum. The speed display
and steering wheel move with the car. The gear selector is vertically aligned
below the speedometer. Select **Reset** at any time to return to
the highlighted yellow parking bay, where every drive begins.
Pressing the pedal opposite the current direction applies an 8 m/s² service brake,
which is substantially stronger than the 3.2 m/s² forward or 2.2 m/s² reverse
acceleration. The transmission changes direction only after the car stops.

## Use the driving aids

Watch the side mirrors and rear-view mirror as you maneuver. The rear camera
includes parking guides, while the bird's-eye camera helps you judge the car's
position between the lines. Drag the mirrors and camera panels to move them;
camera panels can also be hidden and restored.
Use the combined camera button to disable or restore the rear and bird's-eye
panels together.

Every parked and moving vehicle includes physical side-mirror solids attached
to its body. The same geometry is rendered in the windshield and bird's-eye
view and participates in vehicle clearance checks. Perspective rendering culls
the vehicle's hidden faces, far-side mirror, and rear-facing headlamp fixtures.
The learner car's headlamps are off by default and can be toggled from the
bottom control bar. Moving street traffic keeps its headlamps on, while parked
vehicles keep their lamps off. These world-space light cones brighten road
surfaces, vehicle bodies, and building faces they physically reach, with stronger
and longer illumination at night. Soft cone edges and distance falloff diffuse
the light across 3D surfaces rather than treating it as a flat road decal. The
beam grows substantially wider with distance while successive lateral and
longitudinal bands become dimmer.

Open the settings button at the bottom left to adjust the mirror fisheye and camera field of view.
Touch controls are available automatically on phones and tablets.
In rainy weather, droplets appear at random positions across the windshield and
remain on the glass while sliding toward the windshield's
bottom unless one of the two overlapping, full-sweep wipers physically crosses
them. Continuous blade-path detection prevents a fast wiper from skipping over
drops, and drops touching a resting blade clear as well. Wiper speed cycles through
off and slow, with matching motor sounds.


## Play on a phone or tablet

Turn a phone **sideways (landscape)**. The game fits the visible screen, including
browser bars and iPhone safe areas. **Drag around the steering-wheel rim** with
your left thumb and hold **FWD** or
**REV** with your right thumb. You can hold steering and a pedal together; releasing
one finger leaves the other control active. The wheel follows the angle you drag
from its current position, with 420° from center to either hard stop. Release it
to return gently toward center; grab it again anywhere on the rim without jumping.
On touch-capable browsers, the wheel and pedals track each finger directly with
non-passive Touch Events; mouse and pen keep Pointer Events. Safari browser-bar
height changes preserve your grip, while rotation/backgrounding clears it.
The center button still honks. Left/right buttons and arrow keys remain available,
and a mouse or pen can drag the rim too. While you hold the wheel it takes priority
over steering buttons/keys. **BRAKE** stops the car without changing
gear (desktop shortcut: **Space**, when a button or form control is not focused).
Holding FWD and REV together also brakes. P/R/N/D remain available on the dashboard.

Tap **TOOLS** to show settings, weather, headlamps, cameras, reset, turn signals and
wipers. Tap it again to close. The tools tray scrolls horizontally on especially
narrow screens. Camera panels and mirrors use fixed compact positions on smaller
screens so they stay visible after rotation; they can still be dragged on larger
desktop windows. Both camera panels can be hidden and restored with the camera
control, and the settings dialog scrolls when necessary.

Switching apps, rotating the device, losing pointer capture, opening settings,
resetting, or changing gears clears held inputs. Opening settings stops the car.
A portrait phone displays a rotate hint and stops driving until turned sideways.
No fullscreen or orientation-lock permission is required. Desktop arrow keys,
mouse controls, and keyboard signal/wiper shortcuts continue to work.

## Checks

Run `npm test` for the dependency-free multi-touch, interruption, cleanup and
braking tests, then `npm run build`. Pull requests run syntax checks, tests and the
static build without publishing the game.

Manual browser/device checks: drag the rim across the ±180° seam, continue around
to both hard stops and reverse, release and re-grab while recentering, move through
the hub, and hold a pedal with another finger throughout. Verify that the center
horn button still works and wheel gestures do not scroll or zoom the page.
Check sizes 568×320, 667×375, 844×390 and 1024×768; hold steering
with either pedal, slide a finger off a held button before releasing, interrupt a
hold by switching apps or rotating, open/close tools and settings, hide/restore
cameras, then return to desktop keyboard control. Verify the notch/home indicator
areas on a physical iPhone. The screenshot above currently shows the desktop
version; an updated mobile screenshot still needs capture in an accessible browser.

